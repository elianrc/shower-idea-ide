import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Project, Task, WorkspaceSnapshot } from '../../shared/types'

interface PersistedState {
  version: 1
  project: Project | null
  tasks: Task[]
}

const EMPTY_STATE: PersistedState = { version: 1, project: null, tasks: [] }

export class WorkspaceStore {
  private state: PersistedState = structuredClone(EMPTY_STATE)
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const contents = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(contents) as PersistedState
      if (parsed.version === 1) this.state = parsed
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') console.warn('Unable to load workspace state:', error)
    }
  }

  snapshot(): WorkspaceSnapshot {
    return structuredClone({ project: this.state.project, tasks: this.state.tasks })
  }

  getProject(): Project | null {
    return this.state.project
  }

  getTask(taskId: string): Task | undefined {
    return this.state.tasks.find((task) => task.id === taskId)
  }

  async setProject(project: Project): Promise<void> {
    this.state.project = project
    await this.persist()
  }

  async addTask(task: Task): Promise<void> {
    this.state.tasks.unshift(task)
    await this.persist()
  }

  async updateTask(taskId: string, update: (task: Task) => void): Promise<Task> {
    const task = this.getTask(taskId)
    if (!task) throw new Error(`Task ${taskId} was not found.`)
    update(task)
    task.updatedAt = new Date().toISOString()
    await this.persist()
    return structuredClone(task)
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
