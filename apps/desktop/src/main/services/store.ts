import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Project, Session, SessionStatus, WorkspaceSnapshot } from '../../shared/types'

interface PersistedState {
  version: 4
  activeProjectId: string | null
  projects: Project[]
  sessions: Session[]
}

interface Version3PersistedState {
  version: 3
  activeProjectId: string | null
  projects: Project[]
  sessions: Array<Omit<Session, 'isPinned' | 'isUnread'> & Partial<Pick<Session, 'isPinned' | 'isUnread'>>>
}

interface LegacyTask {
  id: string
  projectId: string
  title: string
  prompt: string
  status: string
  branch: string
  worktreePath: string
  permission: Session['permission']
  summary: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  commit?: string
  error?: string
  changedFiles: Session['changedFiles']
  verification: Session['verification']
  activity: Array<Omit<Session['activity'][number], 'sessionId'> & { taskId?: string }>
}

interface LegacyPersistedState {
  version: 1 | 2
  activeProjectId?: string | null
  project?: Project | null
  projects?: Project[]
  tasks: LegacyTask[]
}

const EMPTY_STATE: PersistedState = { version: 4, activeProjectId: null, projects: [], sessions: [] }

export class WorkspaceStore {
  private state: PersistedState = structuredClone(EMPTY_STATE)
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const contents = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(contents) as PersistedState | Version3PersistedState | LegacyPersistedState
      if (parsed.version === 4) {
        this.state = { ...parsed, sessions: parsed.sessions.map(normalizeSession) }
        return
      }

      if (parsed.version === 3) {
        this.state = {
          version: 4,
          activeProjectId: parsed.activeProjectId,
          projects: parsed.projects,
          sessions: parsed.sessions.map(normalizeSession),
        }
        await this.persist()
        return
      }

      const projects = parsed.version === 1
        ? parsed.project ? [parsed.project] : []
        : parsed.projects ?? []
      this.state = {
        version: 4,
        activeProjectId: parsed.version === 1 ? parsed.project?.id ?? null : parsed.activeProjectId ?? null,
        projects,
        sessions: parsed.tasks.map(migrateTask),
      }
      await this.persist()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') console.warn('Unable to load workspace state:', error)
    }
  }

  snapshot(): WorkspaceSnapshot {
    const project = this.getProject()
    const projects = [...this.state.projects].sort(
      (left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime(),
    )
    return structuredClone({ project, projects, sessions: this.state.sessions })
  }

  getProject(): Project | null {
    return this.state.projects.find((project) => project.id === this.state.activeProjectId) ?? null
  }

  getProjectById(projectId: string): Project | null {
    return this.state.projects.find((project) => project.id === projectId) ?? null
  }

  getSession(sessionId: string): Session | undefined {
    return this.state.sessions.find((session) => session.id === sessionId)
  }

  async setProject(project: Project): Promise<void> {
    const existingIndex = this.state.projects.findIndex((candidate) => candidate.id === project.id)
    if (existingIndex === -1) {
      this.state.projects.push(project)
    } else {
      this.state.projects[existingIndex] = project
    }
    this.state.activeProjectId = project.id
    await this.persist()
  }

  async addSession(session: Session): Promise<void> {
    this.state.sessions.unshift(session)
    await this.persist()
  }

  async updateSession(
    sessionId: string,
    update: (session: Session) => void,
    options: { touch?: boolean } = {},
  ): Promise<Session> {
    const session = this.getSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} was not found.`)
    update(session)
    if (options.touch !== false) session.updatedAt = new Date().toISOString()
    await this.persist()
    return structuredClone(session)
  }

  async removeSession(sessionId: string): Promise<void> {
    const index = this.state.sessions.findIndex((session) => session.id === sessionId)
    if (index === -1) throw new Error(`Session ${sessionId} was not found.`)
    this.state.sessions.splice(index, 1)
    await this.persist()
  }

  private async persist(): Promise<void> {
    this.persistQueue = this.persistQueue.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.tmp`
      await writeFile(temporaryPath, JSON.stringify(this.state, null, 2), 'utf8')
      await rename(temporaryPath, this.filePath)
    })
    await this.persistQueue
  }
}

function migrateTask(task: LegacyTask): Session {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    isPinned: false,
    isUnread: false,
    initialPrompt: task.prompt,
    status: migrateStatus(task.status),
    branch: task.branch,
    workspacePath: task.worktreePath,
    workspaceMode: 'worktree',
    agent: 'codex',
    permission: task.permission,
    summary: task.summary,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    commit: task.commit,
    error: task.error,
    changedFiles: task.changedFiles,
    verification: task.verification,
    activity: task.activity.map(({ taskId: _taskId, ...entry }) => ({ ...entry, sessionId: task.id })),
  }
}

function normalizeSession(session: Version3PersistedState['sessions'][number] | Session): Session {
  return {
    ...session,
    isPinned: session.isPinned ?? false,
    isUnread: session.isUnread ?? false,
  }
}

function migrateStatus(status: string): SessionStatus {
  if (status === 'committed' || status === 'approved') return 'completed'
  if (status === 'ready_for_review') return 'waiting'
  if (status === 'failed' || status === 'blocked') return 'failed'
  return 'stopped'
}
