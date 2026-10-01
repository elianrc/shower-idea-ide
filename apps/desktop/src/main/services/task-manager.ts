import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CreateTaskInput,
  Task,
  TaskActivity,
  VerificationResult,
  WorkspaceSnapshot,
} from '../../shared/types'
import type { AgentAdapter } from './agent'
import { GitService } from './git-service'
import { ProcessManager } from './process-manager'
import { WorkspaceStore } from './store'

const MAX_ACTIVITY_ENTRIES = 500

export class TaskManager {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly git: GitService,
    private readonly agent: AgentAdapter,
    private readonly processes: ProcessManager,
    private readonly worktreesRoot: string,
    private readonly onChange: (snapshot: WorkspaceSnapshot) => void,
  ) {}

  get(taskId: string): Task | null {
    const task = this.store.getTask(taskId)
    return task ? structuredClone(task) : null
  }

  async getDiff(taskId: string, filePath?: string) {
    const task = this.requireTask(taskId)
    return this.git.getDiff(taskId, task.worktreePath, filePath)
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const project = this.store.getProject()
    if (!project) throw new Error('Open a Git repository before creating a task.')
    const prompt = input.prompt.trim()
    if (!prompt) throw new Error('Describe what you want to change.')

    const id = randomUUID()
    const branch = `task/${slugify(prompt)}-${id.slice(0, 6)}`
    const worktreePath = join(this.worktreesRoot, project.id, id)
    const now = new Date().toISOString()
    const task: Task = {
      id,
      projectId: project.id,
      title: makeTitle(prompt),
      prompt,
      status: 'planning',
      branch,
      worktreePath,
      agent: 'codex',
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
    await this.store.addTask(task)
    this.emit()

    try {
      await mkdir(join(this.worktreesRoot, project.id), { recursive: true })
      await this.addActivity(id, 'milestone', `Creating ${branch} from ${project.branch}.`)
      await this.git.createWorktree(project.path, branch, worktreePath, project.branch)
      await this.store.updateTask(id, (current) => {
        current.status = 'working'
      })
      await this.addActivity(id, 'milestone', 'Isolated worktree is ready.')
      void this.runAgent(id)
      return this.requireTask(id)
    } catch (error) {
      return this.failTask(id, error)
    }
  }

  async sendMessage(taskId: string, message: string): Promise<Task> {
    const followUp = message.trim()
    if (!followUp) throw new Error('Enter feedback for the agent.')
    const task = this.requireTask(taskId)
    if (task.status === 'working' || task.status === 'verifying') {
      throw new Error('Wait for the current run to finish before requesting changes.')
    }
    await this.store.updateTask(taskId, (current) => {
      current.status = 'changes_requested'
      current.prompt = `${current.prompt}\n\nFollow-up request:\n${followUp}`
      current.error = undefined
      for (const result of current.verification) {
        result.status = 'pending'
        result.output = ''
        result.durationMs = undefined
      }
    })
    await this.addActivity(taskId, 'message', followUp)
    await this.store.updateTask(taskId, (current) => {
      current.status = 'working'
    })
    void this.runAgent(taskId)
    return this.requireTask(taskId)
  }

  async cancel(taskId: string): Promise<Task> {
    this.agent.cancel(taskId)
    this.processes.cancel(`verify:${taskId}`)
    await this.store.updateTask(taskId, (task) => {
      task.status = 'cancelled'
      task.completedAt = new Date().toISOString()
    })
    await this.addActivity(taskId, 'milestone', 'Task cancelled by the user.')
    return this.requireTask(taskId)
  }

  async runVerification(taskId: string): Promise<Task> {
    const task = this.requireTask(taskId)
    const commands = task.verification.length
      ? task.verification.map((result) => result.command)
      : await inferVerificationCommands(task.worktreePath)

    await this.store.updateTask(taskId, (current) => {
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
      await this.addActivity(taskId, 'milestone', 'No verification commands were detected.')
      await this.store.updateTask(taskId, (current) => {
        current.status = 'ready_for_review'
      })
      this.emit()
      return this.requireTask(taskId)
    }

    let failed = false
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]
      await this.updateVerification(taskId, index, { status: 'running' })
      await this.addActivity(taskId, 'command', command)
      const startedAt = Date.now()
      const result = await this.processes.runShell(command, task.worktreePath, `verify:${taskId}`)
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
      const status = result.code === 0 ? 'passed' : 'failed'
      await this.updateVerification(taskId, index, {
        status,
        output: output.slice(-20_000),
        durationMs: Date.now() - startedAt,
      })
      if (this.requireTask(taskId).status === 'cancelled') return this.requireTask(taskId)
      if (result.code !== 0) failed = true
    }

    await this.refreshChanges(taskId)
    await this.store.updateTask(taskId, (current) => {
      current.status = 'ready_for_review'
      if (failed) current.summary = 'Implementation is ready for review, with verification warnings.'
    })
    await this.addActivity(
      taskId,
      failed ? 'error' : 'milestone',
      failed ? 'Verification completed with failures.' : 'All verification checks passed.',
    )
    this.emit()
    return this.requireTask(taskId)
  }

  async approve(taskId: string): Promise<Task> {
    const task = this.requireTask(taskId)
    if (!['ready_for_review', 'approved'].includes(task.status)) {
      throw new Error('This task is not ready for approval.')
    }
    if (task.changedFiles.length === 0) throw new Error('There are no changes to commit.')
    await this.store.updateTask(taskId, (current) => {
      current.status = 'approved'
    })
    this.emit()
    try {
      const commit = await this.git.commit(task.worktreePath, task.title)
      await this.store.updateTask(taskId, (current) => {
        current.status = 'committed'
        current.commit = commit
        current.completedAt = new Date().toISOString()
      })
      await this.addActivity(taskId, 'milestone', `Approved and committed as ${commit}.`)
      return this.requireTask(taskId)
    } catch (error) {
      return this.failTask(taskId, error)
    }
  }

  private async runAgent(taskId: string): Promise<void> {
    const task = this.requireTask(taskId)
    this.emit()
    try {
      const result = await this.agent.startTask(task, {
        onEvent: (kind, text) => {
          void this.addActivity(taskId, kind, text.slice(0, 8_000))
        },
      })
      if (this.requireTask(taskId).status === 'cancelled') return
      if (result.code !== 0) {
        throw new Error(result.stderr.trim() || `Agent exited with status ${result.code}.`)
      }
      await this.refreshChanges(taskId)
      await this.store.updateTask(taskId, (current) => {
        current.summary = summarizeTask(current)
      })
      await this.addActivity(taskId, 'milestone', 'Agent completed its implementation.')
      await this.runVerification(taskId)
    } catch (error) {
      await this.failTask(taskId, error)
    }
  }

  private async refreshChanges(taskId: string): Promise<void> {
    const task = this.requireTask(taskId)
    const changedFiles = await this.git.getChangedFiles(task.worktreePath)
    await this.store.updateTask(taskId, (current) => {
      current.changedFiles = changedFiles
    })
  }

  private async updateVerification(
    taskId: string,
    index: number,
    update: Partial<VerificationResult>,
  ): Promise<void> {
    await this.store.updateTask(taskId, (task) => {
      task.verification[index] = { ...task.verification[index], ...update }
    })
    this.emit()
  }

  private async addActivity(
    taskId: string,
    kind: TaskActivity['kind'],
    text: string,
  ): Promise<void> {
    if (!text.trim()) return
    await this.store.updateTask(taskId, (task) => {
      task.activity.push({ id: randomUUID(), taskId, kind, text, createdAt: new Date().toISOString() })
      if (task.activity.length > MAX_ACTIVITY_ENTRIES) {
        task.activity = task.activity.slice(-MAX_ACTIVITY_ENTRIES)
      }
    })
    this.emit()
  }

  private async failTask(taskId: string, error: unknown): Promise<Task> {
    const message = error instanceof Error ? error.message : String(error)
    await this.store.updateTask(taskId, (task) => {
      task.status = 'failed'
      task.error = message
    })
    await this.addActivity(taskId, 'error', message)
    return this.requireTask(taskId)
  }

  private requireTask(taskId: string): Task {
    const task = this.store.getTask(taskId)
    if (!task) throw new Error(`Task ${taskId} was not found.`)
    return structuredClone(task)
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
    .slice(0, 36) || 'task'
}

export function makeTitle(prompt: string): string {
  const firstLine = prompt.split('\n')[0].trim()
  const title = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine
  return title.charAt(0).toUpperCase() + title.slice(1)
}

function summarizeTask(task: Task): string {
  const count = task.changedFiles.length
  if (count === 0) return 'The agent completed without changing tracked project files.'
  return `Implemented the request across ${count} changed ${count === 1 ? 'file' : 'files'}.`
}

async function inferVerificationCommands(worktreePath: string): Promise<string[]> {
  try {
    const packageJson = JSON.parse(await readFile(join(worktreePath, 'package.json'), 'utf8')) as {
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
