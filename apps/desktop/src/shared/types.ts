export type SessionStatus =
  | 'starting'
  | 'running'
  | 'waiting'
  | 'verifying'
  | 'completed'
  | 'stopped'
  | 'failed'

export type ActivityKind = 'thought' | 'command' | 'output' | 'milestone' | 'error' | 'message'
export type AgentProvider = 'codex'
export type WorkspaceMode = 'current-branch' | 'worktree'

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  isClean: boolean
  remote?: string
  openedAt: string
}

export interface BranchInfo {
  name: string
  isCurrent: boolean
  isWorktree: boolean
  updatedAt?: string
}

export interface RepositoryStatus {
  path: string
  branch: string
  isClean: boolean
  isDetached: boolean
  hasRemote: boolean
  upstream?: string
  ahead: number
  behind: number
}

export interface SessionActivity {
  id: string
  sessionId: string
  kind: ActivityKind
  text: string
  createdAt: string
}

export interface ChangedFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
  additions: number
  deletions: number
}

export interface VerificationResult {
  id: string
  command: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  output: string
  durationMs?: number
}

export interface Session {
  id: string
  projectId: string
  title: string
  isPinned: boolean
  isUnread: boolean
  initialPrompt: string
  status: SessionStatus
  branch: string
  workspacePath: string
  workspaceMode: WorkspaceMode
  agent: AgentProvider
  providerSessionId?: string
  permission: 'review-only' | 'standard' | 'autonomous'
  summary: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  commit?: string
  error?: string
  changedFiles: ChangedFile[]
  verification: VerificationResult[]
  activity: SessionActivity[]
}

export interface WorkspaceSnapshot {
  project: Project | null
  projects: Project[]
  sessions: Session[]
}

export interface CreateSessionInput {
  prompt: string
  agent: AgentProvider
  permission: Session['permission']
  workspaceMode: WorkspaceMode
  verificationCommands?: string[]
}

export interface SessionDiff {
  sessionId: string
  raw: string
  files: ChangedFile[]
}

export interface WorkspaceFileNode {
  id: string
  name: string
  path: string
  kind: 'file' | 'directory'
  children?: WorkspaceFileNode[]
}

export interface SourceFile {
  path: string
  name: string
  contents: string
  language: string
  size: number
}

export interface FileSaveResult {
  file: SourceFile
  changedFiles: ChangedFile[]
  repositoryStatus: RepositoryStatus
}

export interface AppApi {
  workspace: {
    getSnapshot(): Promise<WorkspaceSnapshot>
    openRepository(): Promise<WorkspaceSnapshot>
    openRepositoryAt(path: string): Promise<WorkspaceSnapshot>
    selectRepository(projectId: string): Promise<WorkspaceSnapshot>
    getRepositoryStatus(sessionId?: string): Promise<RepositoryStatus>
    fetchOrigin(sessionId?: string): Promise<RepositoryStatus>
  }
  branches: {
    list(): Promise<BranchInfo[]>
    switch(name: string): Promise<WorkspaceSnapshot>
    create(name: string, baseBranch?: string): Promise<WorkspaceSnapshot>
  }
  files: {
    list(sessionId?: string): Promise<WorkspaceFileNode[]>
    read(path: string, sessionId?: string): Promise<SourceFile>
    save(path: string, contents: string, sessionId?: string): Promise<FileSaveResult>
    getChangedFiles(sessionId?: string): Promise<ChangedFile[]>
    getDiff(filePath?: string, sessionId?: string): Promise<SessionDiff>
  }
  sessions: {
    create(input: CreateSessionInput): Promise<Session>
    get(sessionId: string): Promise<Session | null>
    rename(sessionId: string, title: string): Promise<Session>
    delete(sessionId: string): Promise<void>
    setPinned(sessionId: string, isPinned: boolean): Promise<Session>
    setUnread(sessionId: string, isUnread: boolean): Promise<Session>
    sendMessage(sessionId: string, message: string): Promise<Session>
    stop(sessionId: string): Promise<Session>
    runVerification(sessionId: string): Promise<Session>
    commit(sessionId: string): Promise<Session>
    getDiff(sessionId: string, filePath?: string): Promise<SessionDiff>
  }
  events: {
    onWorkspaceChanged(callback: (snapshot: WorkspaceSnapshot) => void): () => void
  }
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  waiting: 'Ready',
  verifying: 'Checking',
  completed: 'Committed',
  stopped: 'Stopped',
  failed: 'Needs attention',
}
