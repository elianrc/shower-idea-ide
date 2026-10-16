import { spawn, ChildProcessWithoutNullStreams, execFile } from 'child_process'
import { accessSync, constants } from 'fs'
import { stat } from 'fs/promises'
import * as Path from 'path'
import * as readline from 'readline'

import {
  normalizeCodexItem,
  normalizeCodexTurns,
} from '../lib/ai-sessions/model'
import {
  AIApprovalDecision,
  AISessionEvent,
  IAISessionApprovalResponse,
  IAIApprovalRequest,
  IAISessionItem,
  IAISessionModel,
  IAISessionRuntimeInfo,
  IAISessionSnapshot,
  IResumeAISessionRequest,
  ISendAISessionMessageRequest,
  IStartAISessionRequest,
} from '../lib/ai-sessions/types'

type JsonObject = { [key: string]: any }

interface IPendingRequest {
  readonly resolve: (result: any) => void
  readonly reject: (error: Error) => void
  readonly timeout: NodeJS.Timeout
}

interface IMutableSession {
  threadId: string
  repositoryPath: string
  title: string
  model: string | null
  status: IAISessionSnapshot['status']
  currentTurnId: string | null
  items: Array<IAISessionItem>
  approvals: Array<IAIApprovalRequest>
  createdAt: number
  updatedAt: number
  error: string | null
}

const CodexExecutableEnvironmentVariable = 'VIVLIO_CODEX_PATH'
const RequestTimeout = 30000

function executableCandidates(): ReadonlyArray<string> {
  const executableName = process.platform === 'win32' ? 'codex.exe' : 'codex'
  const pathCandidates = (process.env.PATH ?? '')
    .split(Path.delimiter)
    .filter(Boolean)
    .map(directory => Path.join(directory, executableName))
  const configured = process.env[CodexExecutableEnvironmentVariable]

  return [
    ...(configured === undefined ? [] : [configured]),
    ...pathCandidates,
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
    '/usr/bin/codex',
  ]
}

export function findCodexExecutable(
  candidates: ReadonlyArray<string> = executableCandidates()
): string | null {
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next known location.
    }
  }
  return null
}

function runVersion(executablePath: string): Promise<string | null> {
  return new Promise(resolve => {
    execFile(
      executablePath,
      ['--version'],
      { timeout: 5000 },
      (error, stdout) => {
        resolve(error === null ? stdout.trim() || null : null)
      }
    )
  })
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function errorMessage(value: any): string {
  if (typeof value === 'string') {
    return value
  }
  if (value !== null && typeof value === 'object') {
    if (typeof value.message === 'string') {
      return value.message
    }
    if (typeof value.error === 'string') {
      return value.error
    }
  }
  return 'Codex reported an unknown error.'
}

function accountLabel(account: JsonObject | null): string | null {
  if (account === null) {
    return null
  }
  if (account.type === 'chatgpt') {
    return typeof account.email === 'string' ? account.email : 'ChatGPT'
  }
  if (account.type === 'apiKey') {
    return 'API key'
  }
  if (account.type === 'amazonBedrock') {
    return 'Amazon Bedrock'
  }
  return 'Signed in'
}

function snapshot(session: IMutableSession): IAISessionSnapshot {
  return {
    threadId: session.threadId,
    provider: 'codex',
    repositoryPath: session.repositoryPath,
    title: session.title,
    model: session.model,
    status: session.status,
    currentTurnId: session.currentTurnId,
    items: [...session.items],
    approvals: [...session.approvals],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    error: session.error,
  }
}

function updateItem(
  session: IMutableSession,
  item: IAISessionItem,
  appendText = false
) {
  const index = session.items.findIndex(existing => existing.id === item.id)
  if (index === -1) {
    session.items.push(item)
    return
  }

  const existing = session.items[index]
  session.items[index] = {
    ...existing,
    ...item,
    text: appendText ? existing.text + item.text : item.text,
  }
}

async function assertRepositoryPath(repositoryPath: string): Promise<void> {
  const result = await stat(repositoryPath)
  if (!result.isDirectory()) {
    throw new Error('The selected repository path is not a directory.')
  }
}

export class CodexSessionManager {
  private process: ChildProcessWithoutNullStreams | null = null
  private startPromise: Promise<void> | null = null
  private requestId = 0
  private readonly pendingRequests = new Map<string, IPendingRequest>()
  private readonly sessions = new Map<string, IMutableSession>()
  private readonly emitTimers = new Map<string, NodeJS.Timeout>()
  private executablePath: string | null = null
  private userAgent: string | null = null
  private runtime: IAISessionRuntimeInfo | null = null

  public constructor(private readonly emit: (event: AISessionEvent) => void) {}

  public async getRuntimeInfo(): Promise<IAISessionRuntimeInfo> {
    if (this.runtime !== null && this.process !== null) {
      return this.runtime
    }

    try {
      await this.ensureServer()
      const [modelsResult, accountResult, version] = await Promise.all([
        this.request('model/list', { limit: 100, includeHidden: false }),
        this.request('account/read', { refreshToken: false }),
        this.executablePath === null
          ? Promise.resolve(null)
          : runVersion(this.executablePath),
      ])
      const models: ReadonlyArray<IAISessionModel> = Array.isArray(
        modelsResult.data
      )
        ? modelsResult.data.map((model: JsonObject) => ({
            id:
              typeof model.model === 'string'
                ? model.model
                : String(model.id ?? ''),
            label:
              typeof model.displayName === 'string'
                ? model.displayName
                : String(model.model ?? model.id ?? 'Codex'),
            description:
              typeof model.description === 'string' ? model.description : '',
            isDefault: model.isDefault === true,
          }))
        : []
      const account = accountResult.account ?? null
      this.runtime = {
        provider: 'codex',
        available: true,
        authenticated:
          account !== null || accountResult.requiresOpenaiAuth === false,
        executablePath: this.executablePath,
        version: version ?? this.userAgent,
        accountLabel: accountLabel(account),
        models,
        error: null,
      }
    } catch (error) {
      this.runtime = {
        provider: 'codex',
        available: this.executablePath !== null,
        authenticated: null,
        executablePath: this.executablePath,
        version: null,
        accountLabel: null,
        models: [],
        error: asError(error).message,
      }
    }

    this.emit({ type: 'runtime-changed', runtime: this.runtime })
    return this.runtime
  }

  public async startSession(
    request: IStartAISessionRequest
  ): Promise<IAISessionSnapshot> {
    await assertRepositoryPath(request.repositoryPath)
    await this.ensureServer()
    const response = await this.request('thread/start', {
      cwd: request.repositoryPath,
      model: request.model ?? null,
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      sandbox: 'workspace-write',
      threadSource: 'vivlio',
    })
    const thread = response.thread as JsonObject
    const now = Date.now()
    const session: IMutableSession = {
      threadId: String(thread.id),
      repositoryPath: request.repositoryPath,
      title: request.title?.trim() || 'New Codex session',
      model:
        typeof response.model === 'string'
          ? response.model
          : typeof thread.model === 'string'
          ? thread.model
          : null,
      status: 'idle',
      currentTurnId: null,
      items: [],
      approvals: [],
      createdAt:
        typeof thread.createdAt === 'number' ? thread.createdAt * 1000 : now,
      updatedAt: now,
      error: null,
    }
    this.sessions.set(session.threadId, session)
    if (request.title?.trim()) {
      await this.request('thread/name/set', {
        threadId: session.threadId,
        name: request.title.trim(),
      })
    }
    this.emitSession(session)
    return snapshot(session)
  }

  public async resumeSession(
    request: IResumeAISessionRequest
  ): Promise<IAISessionSnapshot> {
    await assertRepositoryPath(request.repositoryPath)
    await this.ensureServer()
    const response = await this.request('thread/resume', {
      threadId: request.threadId,
      cwd: request.repositoryPath,
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      sandbox: 'workspace-write',
      excludeTurns: false,
    })
    const thread = response.thread as JsonObject
    const now = Date.now()
    const existing = this.sessions.get(request.threadId)
    const session: IMutableSession = {
      threadId: request.threadId,
      repositoryPath: request.repositoryPath,
      title:
        typeof thread.name === 'string' && thread.name.trim().length > 0
          ? thread.name
          : typeof thread.preview === 'string' &&
            thread.preview.trim().length > 0
          ? thread.preview
          : existing?.title ?? 'Codex session',
      model:
        typeof response.model === 'string'
          ? response.model
          : typeof thread.model === 'string'
          ? thread.model
          : existing?.model ?? null,
      status: existing?.status === 'running' ? 'running' : 'idle',
      currentTurnId: existing?.currentTurnId ?? null,
      items: Array.isArray(thread.turns)
        ? [...normalizeCodexTurns(thread.turns)]
        : existing?.items ?? [],
      approvals: existing?.approvals ?? [],
      createdAt:
        typeof thread.createdAt === 'number'
          ? thread.createdAt * 1000
          : existing?.createdAt ?? now,
      updatedAt:
        typeof thread.updatedAt === 'number' ? thread.updatedAt * 1000 : now,
      error: null,
    }
    this.sessions.set(session.threadId, session)
    this.emitSession(session)
    return snapshot(session)
  }

  public async sendMessage(
    request: ISendAISessionMessageRequest
  ): Promise<IAISessionSnapshot> {
    const text = request.text.trim()
    if (text.length === 0) {
      throw new Error('Write a message before sending it to Codex.')
    }
    let session = this.sessions.get(request.threadId)
    if (session === undefined) {
      await this.resumeSession({
        threadId: request.threadId,
        repositoryPath: request.repositoryPath,
      })
      session = this.sessions.get(request.threadId)!
    }
    if (
      session.status === 'running' ||
      session.status === 'waiting-for-approval'
    ) {
      throw new Error('This Codex session is already running.')
    }

    session.status = 'running'
    session.error = null
    session.updatedAt = Date.now()
    this.emitSession(session)
    try {
      const response = await this.request('turn/start', {
        threadId: request.threadId,
        input: [{ type: 'text', text, text_elements: [] }],
        cwd: request.repositoryPath,
        approvalPolicy: 'on-request',
        approvalsReviewer: 'user',
      })
      if (response.turn !== undefined && typeof response.turn.id === 'string') {
        session.currentTurnId = response.turn.id
      }
      this.emitSession(session)
      return snapshot(session)
    } catch (error) {
      session.status = 'failed'
      session.error = asError(error).message
      this.emitSession(session)
      throw error
    }
  }

  public async interruptSession(threadId: string): Promise<IAISessionSnapshot> {
    const session = this.requireSession(threadId)
    if (session.currentTurnId !== null) {
      await this.request('turn/interrupt', {
        threadId,
        turnId: session.currentTurnId,
      })
    }
    session.status = 'interrupted'
    session.updatedAt = Date.now()
    this.emitSession(session)
    return snapshot(session)
  }

  public async respondToApproval(
    response: IAISessionApprovalResponse
  ): Promise<IAISessionSnapshot> {
    const session = this.requireSession(response.threadId)
    const approval = session.approvals.find(
      item => String(item.requestId) === String(response.requestId)
    )
    if (approval === undefined) {
      throw new Error('This approval request is no longer pending.')
    }
    if (approval.kind === 'permissions') {
      const requested = approval.requestedPermissions ?? {}
      const permissions =
        response.decision === 'accept' ||
        response.decision === 'acceptForSession'
          ? Object.fromEntries(
              Object.entries(requested).filter(([, value]) => value != null)
            )
          : {}
      this.write({
        id: approval.requestId,
        result: {
          permissions,
          scope: response.decision === 'acceptForSession' ? 'session' : 'turn',
        },
      })
    } else {
      this.write({
        id: approval.requestId,
        result: { decision: response.decision },
      })
    }
    session.approvals = session.approvals.filter(
      item => String(item.requestId) !== String(response.requestId)
    )
    session.status =
      session.approvals.length === 0 ? 'running' : 'waiting-for-approval'
    session.updatedAt = Date.now()
    this.emitSession(session)
    return snapshot(session)
  }

  public async renameSession(
    threadId: string,
    title: string
  ): Promise<IAISessionSnapshot> {
    const session = this.requireSession(threadId)
    const name = title.trim()
    if (name.length === 0) {
      throw new Error('A session name cannot be empty.')
    }
    await this.request('thread/name/set', { threadId, name })
    session.title = name
    session.updatedAt = Date.now()
    this.emitSession(session)
    return snapshot(session)
  }

  public async archiveSession(threadId: string): Promise<void> {
    await this.request('thread/archive', { threadId })
    this.sessions.delete(threadId)
  }

  public dispose() {
    for (const timer of this.emitTimers.values()) {
      clearTimeout(timer)
    }
    this.emitTimers.clear()
    if (this.process !== null) {
      this.process.kill()
      this.process = null
    }
    this.rejectPending(new Error('Codex app-server stopped.'))
  }

  private requireSession(threadId: string): IMutableSession {
    const session = this.sessions.get(threadId)
    if (session === undefined) {
      throw new Error('The Codex session is not loaded.')
    }
    return session
  }

  private async ensureServer(): Promise<void> {
    if (this.process !== null) {
      return
    }
    if (this.startPromise !== null) {
      return this.startPromise
    }
    this.startPromise = this.startServer()
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async startServer(): Promise<void> {
    const executablePath = findCodexExecutable()
    this.executablePath = executablePath
    if (executablePath === null) {
      throw new Error(
        'Codex CLI was not found. Install Codex or set VIVLIO_CODEX_PATH.'
      )
    }

    const child = spawn(executablePath, ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })
    this.process = child
    const lines = readline.createInterface({ input: child.stdout })
    lines.on('line', line => this.handleLine(line))
    child.stderr.on('data', data => {
      const message = String(data).trim()
      if (message.length > 0) {
        log.info(`[codex app-server] ${message}`)
      }
    })
    child.once('error', error => this.handleProcessExit(error))
    child.once('exit', (code, signal) => {
      this.handleProcessExit(
        new Error(
          `Codex app-server exited (${signal ?? String(code ?? 'unknown')}).`
        )
      )
    })

    const initialized = await this.request('initialize', {
      clientInfo: {
        name: 'vivlio',
        title: 'Vivlio',
        version: '0.1.0',
      },
      capabilities: null,
    })
    this.userAgent =
      typeof initialized.userAgent === 'string' ? initialized.userAgent : null
    this.write({ method: 'initialized' })
  }

  private request(method: string, params: JsonObject): Promise<any> {
    if (this.process === null) {
      return Promise.reject(new Error('Codex app-server is not running.'))
    }
    const id = ++this.requestId
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(String(id))
        reject(new Error(`Codex did not respond to ${method}.`))
      }, RequestTimeout)
      this.pendingRequests.set(String(id), { resolve, reject, timeout })
      this.write({ id, method, params })
    })
  }

  private write(message: JsonObject) {
    if (this.process === null || this.process.stdin.destroyed) {
      throw new Error('Codex app-server is not running.')
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private handleLine(line: string) {
    let message: JsonObject
    try {
      message = JSON.parse(line)
    } catch {
      log.warn(`Ignoring invalid Codex app-server message: ${line}`)
      return
    }

    if (message.id !== undefined && message.method === undefined) {
      const pending = this.pendingRequests.get(String(message.id))
      if (pending === undefined) {
        return
      }
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(String(message.id))
      if (message.error !== undefined) {
        pending.reject(new Error(errorMessage(message.error)))
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (message.id !== undefined && typeof message.method === 'string') {
      this.handleServerRequest(message)
      return
    }

    if (typeof message.method === 'string') {
      this.handleNotification(message.method, message.params ?? {})
    }
  }

  private handleServerRequest(message: JsonObject) {
    const params = message.params ?? {}
    if (
      message.method !== 'item/commandExecution/requestApproval' &&
      message.method !== 'item/fileChange/requestApproval' &&
      message.method !== 'item/permissions/requestApproval'
    ) {
      this.write({
        id: message.id,
        error: { code: -32601, message: 'Unsupported request in Vivlio.' },
      })
      return
    }

    const session = this.sessions.get(String(params.threadId))
    if (session === undefined) {
      this.write({ id: message.id, result: { decision: 'decline' } })
      return
    }
    const kind =
      message.method === 'item/commandExecution/requestApproval'
        ? 'command'
        : message.method === 'item/fileChange/requestApproval'
        ? 'file-change'
        : 'permissions'
    const detail =
      kind === 'command'
        ? String(params.command ?? 'Run a command')
        : kind === 'file-change'
        ? String(params.grantRoot ?? 'Modify files in the repository')
        : JSON.stringify(params.permissions ?? {}, null, 2)
    const approval: IAIApprovalRequest = {
      requestId: message.id,
      threadId: session.threadId,
      turnId: String(params.turnId ?? ''),
      itemId: String(params.itemId ?? ''),
      kind,
      title:
        kind === 'command'
          ? 'Run command?'
          : kind === 'file-change'
          ? 'Allow file changes?'
          : 'Grant additional permissions?',
      detail,
      command: typeof params.command === 'string' ? params.command : undefined,
      cwd: typeof params.cwd === 'string' ? params.cwd : undefined,
      reason: typeof params.reason === 'string' ? params.reason : undefined,
      requestedPermissions:
        params.permissions !== null && typeof params.permissions === 'object'
          ? params.permissions
          : undefined,
    }
    session.approvals.push(approval)
    session.status = 'waiting-for-approval'
    session.updatedAt = Date.now()
    this.emitSession(session)
  }

  private handleNotification(method: string, params: JsonObject) {
    const threadId =
      typeof params.threadId === 'string'
        ? params.threadId
        : typeof params.thread?.id === 'string'
        ? params.thread.id
        : null
    if (threadId === null) {
      return
    }
    const session = this.sessions.get(threadId)
    if (session === undefined) {
      return
    }

    if (method === 'turn/started') {
      session.status = 'running'
      session.currentTurnId =
        typeof params.turn?.id === 'string' ? params.turn.id : null
      if (Array.isArray(params.turn?.items)) {
        for (const item of params.turn.items) {
          const normalized = normalizeCodexItem(item)
          if (normalized !== null) {
            updateItem(session, normalized)
          }
        }
      }
    } else if (method === 'turn/completed') {
      const turnStatus = params.turn?.status
      session.status =
        turnStatus === 'failed'
          ? 'failed'
          : turnStatus === 'interrupted'
          ? 'interrupted'
          : 'idle'
      session.currentTurnId = null
      session.approvals = []
      if (params.turn?.error !== null && params.turn?.error !== undefined) {
        session.error = errorMessage(params.turn.error)
      }
    } else if (method === 'item/started' || method === 'item/completed') {
      const normalized = normalizeCodexItem(params.item)
      if (normalized !== null) {
        updateItem(session, normalized)
      }
    } else if (
      method === 'item/agentMessage/delta' ||
      method === 'item/plan/delta' ||
      method === 'item/commandExecution/outputDelta' ||
      method === 'item/fileChange/outputDelta'
    ) {
      const kind =
        method === 'item/agentMessage/delta'
          ? 'assistant'
          : method === 'item/plan/delta'
          ? 'plan'
          : method === 'item/commandExecution/outputDelta'
          ? 'command'
          : 'file-change'
      updateItem(
        session,
        {
          id: String(params.itemId),
          kind,
          title:
            kind === 'plan'
              ? 'Plan'
              : kind === 'command'
              ? 'Command output'
              : kind === 'file-change'
              ? 'File changes'
              : undefined,
          text: String(params.delta ?? ''),
        },
        true
      )
    } else if (method === 'thread/name/updated') {
      if (typeof params.threadName === 'string') {
        session.title = params.threadName
      }
    } else if (method === 'serverRequest/resolved') {
      session.approvals = session.approvals.filter(
        approval => String(approval.requestId) !== String(params.requestId)
      )
      if (
        session.approvals.length === 0 &&
        session.status === 'waiting-for-approval'
      ) {
        session.status = 'running'
      }
    } else if (method === 'error') {
      session.error = errorMessage(params.error)
      session.status = params.willRetry === true ? 'running' : 'failed'
    } else if (method === 'warning' || method === 'guardianWarning') {
      updateItem(session, {
        id: `${method}-${Date.now()}`,
        kind: 'status',
        title: 'Codex warning',
        text: String(params.message ?? 'Codex reported a warning.'),
      })
    } else if (method === 'thread/status/changed') {
      const statusType = params.status?.type
      if (statusType === 'idle') {
        session.status = 'idle'
      } else if (statusType === 'systemError') {
        session.status = 'failed'
      } else if (statusType === 'active') {
        session.status =
          Array.isArray(params.status.activeFlags) &&
          params.status.activeFlags.includes('waitingOnApproval')
            ? 'waiting-for-approval'
            : 'running'
      }
    }

    session.updatedAt = Date.now()
    const isStreamingDelta =
      method === 'item/agentMessage/delta' ||
      method === 'item/plan/delta' ||
      method === 'item/commandExecution/outputDelta' ||
      method === 'item/fileChange/outputDelta'
    this.emitSession(session, isStreamingDelta)
  }

  private emitSession(session: IMutableSession, throttle = false) {
    const pending = this.emitTimers.get(session.threadId)
    if (throttle) {
      if (pending !== undefined) {
        return
      }
      const timer = setTimeout(() => {
        this.emitTimers.delete(session.threadId)
        this.emit({ type: 'session-updated', session: snapshot(session) })
      }, 40)
      this.emitTimers.set(session.threadId, timer)
      return
    }
    if (pending !== undefined) {
      clearTimeout(pending)
      this.emitTimers.delete(session.threadId)
    }
    this.emit({ type: 'session-updated', session: snapshot(session) })
  }

  private handleProcessExit(error: Error) {
    if (this.process === null) {
      return
    }
    this.process = null
    this.runtime = null
    this.rejectPending(error)
    for (const session of this.sessions.values()) {
      if (
        session.status === 'running' ||
        session.status === 'waiting-for-approval'
      ) {
        session.status = 'disconnected'
        session.error = error.message
        this.emitSession(session)
      }
    }
  }

  private rejectPending(error: Error) {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }
}

export function isApprovalDecision(value: string): value is AIApprovalDecision {
  return (
    value === 'accept' ||
    value === 'acceptForSession' ||
    value === 'decline' ||
    value === 'cancel'
  )
}
