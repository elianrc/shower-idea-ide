import type { IncomingMessage, ServerResponse } from 'node:http'

const githubTokenUrl = 'https://github.com/login/oauth/access_token'
const maximumBodyBytes = 16_384

export interface JsonRequest extends IncomingMessage {
  body?: unknown
}

export type JsonResponse = ServerResponse<IncomingMessage>

export function sendJson(response: JsonResponse, status: number, data: unknown): void {
  response.statusCode = status
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(data))
}

export async function readJsonBody(request: JsonRequest): Promise<Record<string, unknown>> {
  if (request.body && typeof request.body === 'object') return request.body as Record<string, unknown>
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumBodyBytes) throw new Error('Request body is too large.')
    chunks.push(buffer)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed as Record<string, unknown>
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

export function requireString(body: Record<string, unknown>, key: string, minimum = 1, maximum = 2048): string {
  const value = body[key]
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) {
    throw new Error(`Invalid ${key}.`)
  }
  return value
}

export function requireBrokerConfiguration(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim()
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim()
  const redirectUri = process.env.VIVLIO_GITHUB_REDIRECT_URI?.trim() || 'vivlio://auth/github'
  if (!clientId || !clientSecret) throw new Error('Authentication service is not configured.')
  return { clientId, clientSecret, redirectUri }
}

export async function requestGitHubToken(parameters: Record<string, string>): Promise<Record<string, unknown>> {
  const { clientId, clientSecret } = requireBrokerConfiguration()
  const response = await fetch(githubTokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Vivlio-Auth-Broker',
    },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...parameters }),
  })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new Error(typeof data.error_description === 'string' ? data.error_description : 'GitHub rejected the authorization request.')
  }
  return pickTokenFields(data)
}

function pickTokenFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { access_token: data.access_token }
  for (const key of ['refresh_token', 'expires_in', 'refresh_token_expires_in', 'scope', 'token_type']) {
    if (typeof data[key] === 'string' || typeof data[key] === 'number') result[key] = data[key]
  }
  return result
}

export function methodAllowed(request: JsonRequest, response: JsonResponse): boolean {
  if (request.method === 'POST') return true
  response.setHeader('Allow', 'POST')
  sendJson(response, 405, { error: 'Method not allowed.' })
  return false
}

export function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication request failed.'
  return /secret|token/i.test(message) ? 'Authentication request failed.' : message
}
