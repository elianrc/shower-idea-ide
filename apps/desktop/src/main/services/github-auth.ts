import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BrowserWindow, safeStorage, shell } from 'electron'
import type { GitHubAuthState, GitHubUser } from '../../shared/types'

interface StoredCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshTokenExpiresAt?: number
  user: GitHubUser
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}

interface PendingAuthorization {
  state: string
  verifier: string
  resolve: (state: GitHubAuthState) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export interface GitCredentialEnvironment {
  [key: string]: string
}

const redirectUri = 'vivlio://auth/github'
const githubApiHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

export class GitHubAuthService {
  private readonly credentialsPath: string
  private readonly askPassPath: string
  private pending: PendingAuthorization | null = null

  constructor(
    userDataPath: string,
    private readonly clientId = __VIVLIO_GITHUB_CLIENT_ID__,
    private readonly brokerUrl = __VIVLIO_GITHUB_AUTH_BROKER_URL__,
  ) {
    this.credentialsPath = join(userDataPath, 'github-auth.json')
    this.askPassPath = join(userDataPath, 'bin', 'vivlio-git-askpass')
  }

  async getStatus(): Promise<GitHubAuthState> {
    const credentials = await this.readCredentials()
    return {
      configured: this.isConfigured,
      signedIn: Boolean(credentials),
      user: credentials?.user,
    }
  }

  async signIn(): Promise<GitHubAuthState> {
    if (!this.isConfigured) {
      throw new Error('GitHub sign-in is not configured in this build.')
    }
    if (this.pending) this.rejectPending(new Error('A newer GitHub sign-in attempt was started.'))

    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(48).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
    authorizeUrl.searchParams.set('client_id', this.clientId)
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('code_challenge', challenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('prompt', 'select_account')

    const result = new Promise<GitHubAuthState>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.rejectPending(new Error('GitHub sign-in timed out. Please try again.'))
      }, 10 * 60 * 1000)
      this.pending = { state, verifier, resolve, reject, timeout }
    })

    try {
      await shell.openExternal(authorizeUrl.toString())
    } catch (error) {
      this.rejectPending(new Error('Unable to open GitHub sign-in in your browser.'))
      throw error
    }
    return result
  }

  async signOut(): Promise<GitHubAuthState> {
    await rm(this.credentialsPath, { force: true })
    const state = await this.getStatus()
    this.broadcast(state)
    return state
  }

  async handleCallback(rawUrl: string): Promise<boolean> {
    let callback: URL
    try {
      callback = new URL(rawUrl)
    } catch {
      return false
    }
    if (callback.protocol !== 'vivlio:' || callback.hostname !== 'auth' || callback.pathname !== '/github') return false
    if (!this.pending) return true

    const returnedState = callback.searchParams.get('state') ?? ''
    if (!secureEqual(returnedState, this.pending.state)) {
      this.rejectPending(new Error('GitHub sign-in could not be verified. Please try again.'))
      return true
    }
    const providerError = callback.searchParams.get('error_description') ?? callback.searchParams.get('error')
    if (providerError) {
      this.rejectPending(new Error(providerError === 'access_denied' ? 'GitHub sign-in was cancelled.' : 'GitHub sign-in failed.'))
      return true
    }
    const code = callback.searchParams.get('code')
    if (!code) {
      this.rejectPending(new Error('GitHub did not return an authorization code.'))
      return true
    }

    const pending = this.pending
    try {
      const tokens = await this.exchange('/api/github/exchange', {
        code,
        codeVerifier: pending.verifier,
        redirectUri,
      })
      const user = await this.fetchUser(tokens.access_token)
      const now = Date.now()
      await this.writeCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? now + tokens.expires_in * 1000 : undefined,
        refreshTokenExpiresAt: tokens.refresh_token_expires_in ? now + tokens.refresh_token_expires_in * 1000 : undefined,
        user,
      })
      const status = await this.getStatus()
      this.resolvePending(status)
      this.broadcast(status)
    } catch (error) {
      this.rejectPending(new Error(safeErrorMessage(error, 'GitHub sign-in failed.')))
    }
    return true
  }

  async getGitEnvironment(): Promise<GitCredentialEnvironment | null> {
    let credentials = await this.readCredentials()
    if (!credentials) return null
    if (credentials.expiresAt && credentials.expiresAt < Date.now() + 60_000) {
      credentials = await this.refresh(credentials)
    }
    await this.ensureAskPass()
    return {
      GCM_INTERACTIVE: 'Never',
      GIT_ASKPASS: this.askPassPath,
      GIT_ASKPASS_REQUIRE: 'force',
      GIT_TERMINAL_PROMPT: '0',
      VIVLIO_GIT_USERNAME: 'x-access-token',
      VIVLIO_GIT_TOKEN: credentials.accessToken,
    }
  }

  private get isConfigured(): boolean {
    return Boolean(this.clientId.trim() && this.brokerUrl.trim())
  }

  private async exchange(path: string, body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(new URL(path, ensureTrailingSlash(this.brokerUrl)), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({})) as TokenResponse & { error?: string }
    if (!response.ok || !data.access_token) throw new Error(data.error || 'The GitHub authentication service rejected the request.')
    return data
  }

  private async fetchUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: { ...githubApiHeaders, Authorization: `Bearer ${accessToken}` },
    })
    const data = await response.json().catch(() => ({})) as { login?: string; name?: string | null; avatar_url?: string; message?: string }
    if (!response.ok || !data.login || !data.avatar_url) throw new Error(data.message || 'Unable to load your GitHub profile.')
    return { login: data.login, name: data.name ?? undefined, avatarUrl: data.avatar_url }
  }

  private async refresh(credentials: StoredCredentials): Promise<StoredCredentials> {
    if (!credentials.refreshToken) {
      await rm(this.credentialsPath, { force: true })
      throw new Error('Your GitHub session expired. Sign in again.')
    }
    const tokens = await this.exchange('/api/github/refresh', { refreshToken: credentials.refreshToken })
    const now = Date.now()
    const refreshed: StoredCredentials = {
      ...credentials,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? credentials.refreshToken,
      expiresAt: tokens.expires_in ? now + tokens.expires_in * 1000 : undefined,
      refreshTokenExpiresAt: tokens.refresh_token_expires_in ? now + tokens.refresh_token_expires_in * 1000 : credentials.refreshTokenExpiresAt,
    }
    await this.writeCredentials(refreshed)
    return refreshed
  }

  private async readCredentials(): Promise<StoredCredentials | null> {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null
      const stored = JSON.parse(await readFile(this.credentialsPath, 'utf8')) as { version: number; encrypted: string }
      if (stored.version !== 1 || !stored.encrypted) return null
      return JSON.parse(safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64'))) as StoredCredentials
    } catch {
      return null
    }
  }

  private async writeCredentials(credentials: StoredCredentials): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this Mac.')
    await mkdir(dirname(this.credentialsPath), { recursive: true })
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials)).toString('base64')
    const temporaryPath = `${this.credentialsPath}.tmp`
    await writeFile(temporaryPath, JSON.stringify({ version: 1, encrypted }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.credentialsPath)
    await chmod(this.credentialsPath, 0o600)
  }

  private async ensureAskPass(): Promise<void> {
    await mkdir(dirname(this.askPassPath), { recursive: true })
    await writeFile(this.askPassPath, '#!/bin/sh\ncase "$1" in\n  *Username*) printf "%s\\n" "$VIVLIO_GIT_USERNAME" ;;\n  *) printf "%s\\n" "$VIVLIO_GIT_TOKEN" ;;\nesac\n', { encoding: 'utf8', mode: 0o700 })
    await chmod(this.askPassPath, 0o700)
  }

  private resolvePending(state: GitHubAuthState): void {
    if (!this.pending) return
    clearTimeout(this.pending.timeout)
    this.pending.resolve(state)
    this.pending = null
  }

  private rejectPending(error: Error): void {
    if (!this.pending) return
    clearTimeout(this.pending.timeout)
    this.pending.reject(error)
    this.pending = null
  }

  private broadcast(state: GitHubAuthState): void {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('github:authChanged', state)
  }
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function safeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  return /token|secret|authorization/i.test(message) ? fallback : message
}
