export type TaskStatus =
  | 'draft'
  | 'planning'
  | 'working'
  | 'verifying'
  | 'ready_for_review'
  | 'changes_requested'
  | 'approved'
  | 'committed'
  | 'failed'
  | 'cancelled'
  | 'blocked'

export type ActivityKind = 'thought' | 'command' | 'output' | 'milestone' | 'error' | 'message'

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  isClean: boolean
  remote?: string
  openedAt: string
}

export interface TaskActivity {
  id: string
  taskId: string
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

export interface Task {
  id: string
  projectId: string
  title: string
  prompt: string
  status: TaskStatus
  branch: string
  worktreePath: string
  agent: 'codex'
  permission: 'review-only' | 'standard' | 'autonomous'
  summary: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  commit?: string
  error?: string
  changedFiles: ChangedFile[]
  verification: VerificationResult[]
  activity: TaskActivity[]
}

export interface WorkspaceSnapshot {
  project: Project | null
  tasks: Task[]
}

export interface CreateTaskInput {
  prompt: string
  permission: Task['permission']
  verificationCommands?: string[]
}

export interface TaskDiff {
  taskId: string
  raw: string
  files: ChangedFile[]
}

export interface AppApi {
  workspace: {
    getSnapshot(): Promise<WorkspaceSnapshot>
    openRepository(): Promise<WorkspaceSnapshot>
    openRepositoryAt(path: string): Promise<WorkspaceSnapshot>
  }
  tasks: {
    create(input: CreateTaskInput): Promise<Task>
    get(taskId: string): Promise<Task | null>
    sendMessage(taskId: string, message: string): Promise<Task>
    cancel(taskId: string): Promise<Task>
    runVerification(taskId: string): Promise<Task>
    approve(taskId: string): Promise<Task>
    getDiff(taskId: string, filePath?: string): Promise<TaskDiff>
  }
  events: {
    onWorkspaceChanged(callback: (snapshot: WorkspaceSnapshot) => void): () => void
  }
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  planning: 'Planning',
  working: 'Working',
  verifying: 'Verifying',
  ready_for_review: 'Ready for review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  committed: 'Committed',
  failed: 'Needs attention',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
}
