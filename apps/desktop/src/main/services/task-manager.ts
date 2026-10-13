import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CreateSessionInput,
  Session,
  SessionActivity,
  VerificationResult,
  WorkspaceSnapshot,
} from '../../shared/types'
import type { AgentAdapter } from './agent'
import { GitService } from './git-service'
import { ProcessManager } from './process-manager'
import { WorkspaceStore } from './store'

const MAX_ACTIVITY_ENTRIES = 500

export class SessionManager {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly git: GitService,
    private readonly agent: AgentAdapter,
    private readonly processes: ProcessManager,
    private readonly worktreesRoot: string,
    private readonly onChange: (snapshot: WorkspaceSnapshot) => void,
  ) {}

  get(sessionId: string): Session | null {
    const session = this.store.getSession(sessionId)
    return session ? structuredClone(session) : null
  }

  async getDiff(sessionId: string, filePath?: string) {
    const session = this.requireSession(sessionId)
    return this.git.getDiff(sessionId, session.workspacePath, filePath)
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const project = this.store.getProject()
    if (!project) throw new Error('Open a Git repository before starting a session.')
    const prompt = input.prompt.trim()
    if (!prompt) throw new Error('Enter a message for the agent.')

    const id = randomUUID()
    const useWorktree = input.workspaceMode === 'worktree'
    const branch = useWorktree ? `session/${slugify(prompt)}-${id.slice(0, 6)}` : project.branch
    const workspacePath = useWorktree ? join(this.worktreesRoot, project.id, id) : project.path
    const now = new Date().toISOString()
    const session: Session = {
      id,
      projectId: project.id,
      title: makeTitle(prompt),
      isPinned: false,
      isUnread: false,
      initialPrompt: prompt,
      status: 'starting',
      branch,
      workspacePath,
      workspaceMode: input.workspaceMode,
      agent: input.agent,
      permission: input.permission,
      summary: '',
      createdAt: now,
      updatedAt: now,
      changedFiles: [],
      verification: (input.verificationCommands ?? []).map((command) => ({
        id: randomUUID(),
        command,
        status: 'pending',
        output: '',
      })),
      activity: [],
    }
    await this.store.addSession(session)
    await this.addActivity(id, 'message', prompt)

    try {
      if (useWorktree) {
        await mkdir(join(this.worktreesRoot, project.id), { recursive: true })
        await this.addActivity(id, 'milestone', `Creating an isolated worktree from ${project.branch}.`)
        await this.git.createWorktree(project.path, branch, workspacePath, project.branch)
        await this.addActivity(id, 'milestone', `Worktree ready on ${branch}.`)
      } else {
        await this.addActivity(id, 'milestone', `Connected to the current ${project.branch} branch.`)
      }
      await this.store.updateSession(id, (current) => {
        current.status = 'running'
      })
      void this.runAgent(id, prompt)
      return this.requireSession(id)
    } catch (error) {
      return this.failSession(id, error)
    }
  }

  async rename(sessionId: string, title: string): Promise<Session> {
    const nextTitle = title.trim()
    if (!nextTitle) throw new Error('Enter a session title.')
    if (nextTitle.length > 120) throw new Error('Session titles must be 120 characters or fewer.')
    const session = await this.store.updateSession(sessionId, (current) => {
      current.title = nextTitle
    }, { touch: false })
    this.emit()
    return session
  }

  async setPinned(sessionId: string, isPinned: boolean): Promise<Session> {
    const session = await this.store.updateSession(sessionId, (current) => {
      current.isPinned = isPinned
    }, { touch: false })
    this.emit()
    return session
  }

  async setUnread(sessionId: string, isUnread: boolean): Promise<Session> {
    const session = await this.store.updateSession(sessionId, (current) => {
      current.isUnread = isUnread
    }, { touch: false })
    this.emit()
    return session
  }

  async delete(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    this.agent.cancel(sessionId)
    this.processes.cancel(`verify:${sessionId}`)

    if (session.workspaceMode === 'worktree') {
      const project = this.store.getProjectById(session.projectId)
      if (!project) throw new Error('The repository for this session is no longer available.')
      await this.git.removeWorktree(project.path, session.workspacePath)
    }

    await this.store.removeSession(sessionId)
    this.emit()
  }

  async setChangedFiles(sessionId: string, changedFiles: Session['changedFiles']): Promise<Session> {
    const session = await this.store.updateSession(sessionId, (current) => {
      current.changedFiles = changedFiles
    })
    this.emit()
    return session
  }

  async sendMessage(sessionId: string, message: string): Promise<Session> {
    const followUp = message.trim()
    if (!followUp) throw new Error('Enter a message for the agent.')
    const session = this.requireSession(sessionId)
    if (session.status === 'running' || session.status === 'starting' || session.status === 'verifying') {
      throw new Error('Wait for the current agent turn to finish.')
    }
    if (session.status === 'completed') {
      throw new Error('This session has already been committed. Start a new session to continue.')
    }
    await this.store.updateSession(sessionId, (current) => {
      current.status = 'running'
      current.error = undefined
    })
    await this.addActivity(sessionId, 'message', followUp)
    void this.runAgent(sessionId, followUp)
    return this.requireSession(sessionId)
  }

  async stop(sessionId: string): Promise<Session> {
    this.agent.cancel(sessionId)
    this.processes.cancel(`verify:${sessionId}`)
    await this.store.updateSession(sessionId, (session) => {
      session.status = 'stopped'
    })
    await this.addActivity(sessionId, 'milestone', 'Session stopped. You can resume it with another message.')
    return this.requireSession(sessionId)
  }

  async runVerification(sessionId: string): Promise<Session> {
    const session = this.requireSession(sessionId)
    if (session.status === 'running' || session.status === 'starting') {
      throw new Error('Wait for the agent turn to finish before running checks.')
    }
    const commands = session.verification.length
      ? session.verification.map((result) => result.command)
      : await inferVerificationCommands(session.workspacePath)

    await this.store.updateSession(sessionId, (current) => {
      current.status = 'verifying'
      current.verification = commands.map((command) => ({
        id: randomUUID(),
        command,
        status: 'pending',
        output: '',
      }))
    })
    this.emit()

    if (commands.length === 0) {
      await this.addActivity(sessionId, 'milestone', 'No verification commands were detected.')
      await this.store.updateSession(sessionId, (current) => {
        current.status = 'waiting'
      })
      this.emit()
      return this.requireSession(sessionId)
    }

    let failed = false
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]
      await this.updateVerification(sessionId, index, { status: 'running' })
      await this.addActivity(sessionId, 'command', command)
      const startedAt = Date.now()
      const result = await this.processes.runShell(command, session.workspacePath, `verify:${sessionId}`)
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
      const status = result.code === 0 ? 'passed' : 'failed'
      await this.updateVerification(sessionId, index, {
        status,
        output: output.slice(-20_000),
        durationMs: Date.now() - startedAt,
      })
      if (this.requireSession(sessionId).status === 'stopped') return this.requireSession(sessionId)
      if (result.code !== 0) failed = true
    }

    await this.refreshChanges(sessionId)
    await this.store.updateSession(sessionId, (current) => {
      current.status = 'waiting'
    })
    await this.addActivity(
      sessionId,
      failed ? 'error' : 'milestone',
      failed ? 'Checks completed with failures.' : 'All checks passed.',
    )
    this.emit()
    return this.requireSession(sessionId)
  }

  async commit(sessionId: string, message?: string): Promise<Session> {
    const session = this.requireSession(sessionId)
    if (session.status === 'running' || session.status === 'starting' || session.status === 'verifying') {
      throw new Error('Wait for the active process to finish before committing.')
    }
    await this.refreshChanges(sessionId)
    if (this.requireSession(sessionId).changedFiles.length === 0) throw new Error('There are no changes to commit.')
    try {
      const commit = await this.git.commit(session.workspacePath, message?.trim() || session.title)
      await this.store.updateSession(sessionId, (current) => {
        current.status = 'completed'
        current.commit = commit
        current.completedAt = new Date().toISOString()
        current.changedFiles = []
      })
      await this.addActivity(sessionId, 'milestone', `Committed changes as ${commit}.`)
      return this.requireSession(sessionId)
    } catch (error) {
      return this.failSession(sessionId, error)
    }
  }

  private async runAgent(sessionId: string, prompt: string): Promise<void> {
    const session = this.requireSession(sessionId)
    this.emit()
    try {
      const result = await this.agent.run(session, prompt, {
        onEvent: (kind, text) => {
          void this.addActivity(sessionId, kind, text.slice(0, 8_000))
        },
        onProviderSessionId: (providerSessionId) => {
          void this.store.updateSession(sessionId, (current) => {
            current.providerSessionId = providerSessionId
          }).then(() => this.emit())
        },
      })
      if (this.requireSession(sessionId).status === 'stopped') return
      if (result.code !== 0) {
        throw new Error(result.stderr.trim() || `Agent exited with status ${result.code}.`)
      }
      await this.refreshChanges(sessionId)
      await this.store.updateSession(sessionId, (current) => {
        current.status = 'waiting'
        current.summary = summarizeSession(current)
      })
      await this.addActivity(sessionId, 'milestone', 'Codex is ready for your next message.')
      this.emit()
    } catch (error) {
      await this.failSession(sessionId, error)
    }
  }

  private async refreshChanges(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    const changedFiles = await this.git.getChangedFiles(session.workspacePath)
    await this.store.updateSession(sessionId, (current) => {
      current.changedFiles = changedFiles
    })
  }

  private async updateVerification(
    sessionId: string,
    index: number,
    update: Partial<VerificationResult>,
  ): Promise<void> {
    await this.store.updateSession(sessionId, (session) => {
      session.verification[index] = { ...session.verification[index], ...update }
    })
    this.emit()
  }

  private async addActivity(
    sessionId: string,
    kind: SessionActivity['kind'],
    text: string,
  ): Promise<void> {
    if (!text.trim()) return
    await this.store.updateSession(sessionId, (session) => {
      session.activity.push({ id: randomUUID(), sessionId, kind, text, createdAt: new Date().toISOString() })
      if (session.activity.length > MAX_ACTIVITY_ENTRIES) {
        session.activity = session.activity.slice(-MAX_ACTIVITY_ENTRIES)
      }
    })
    this.emit()
  }

  private async failSession(sessionId: string, error: unknown): Promise<Session> {
    const message = error instanceof Error ? error.message : String(error)
    await this.store.updateSession(sessionId, (session) => {
      session.status = 'failed'
      session.error = message
    })
    await this.addActivity(sessionId, 'error', message)
    return this.requireSession(sessionId)
  }

  private requireSession(sessionId: string): Session {
    const session = this.store.getSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} was not found.`)
    return structuredClone(session)
  }

  private emit(): void {
    this.onChange(this.store.snapshot())
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'session'
}

export function makeTitle(prompt: string): string {
  const firstLine = prompt.split('\n')[0].trim()
  const title = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine
  return title.charAt(0).toUpperCase() + title.slice(1)
}

function summarizeSession(session: Session): string {
  const count = session.changedFiles.length
  if (count === 0) return 'Codex responded without changing project files.'
  return `${count} changed ${count === 1 ? 'file' : 'files'} in this session.`
}

async function inferVerificationCommands(workspacePath: string): Promise<string[]> {
  try {
    const packageJson = JSON.parse(await readFile(join(workspacePath, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const scripts = packageJson.scripts ?? {}
    return ['lint', 'typecheck', 'test', 'build']
      .filter((name) => Boolean(scripts[name]))
      .map((name) => `npm run ${name}`)
  } catch {
    return []
  }
}
