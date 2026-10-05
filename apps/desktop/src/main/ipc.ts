import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { CreateTaskInput, Project, WorkspaceSnapshot } from '../shared/types'
import { CodexAdapter } from './services/agent'
import { GitService } from './services/git-service'
import { ProcessManager } from './services/process-manager'
import { WorkspaceStore } from './services/store'
import { TaskManager } from './services/task-manager'

export async function registerIpc(userDataPath: string): Promise<void> {
  const store = new WorkspaceStore(join(userDataPath, 'workspace.json'))
  await store.load()
  const processes = new ProcessManager()
  const git = new GitService(processes)
  const agent = new CodexAdapter(processes)
  const broadcast = (snapshot: WorkspaceSnapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('workspace:changed', snapshot)
    }
  }
  const tasks = new TaskManager(
    store,
    git,
    agent,
    processes,
    join(userDataPath, 'worktrees'),
    broadcast,
  )

  ipcMain.handle('workspace:getSnapshot', () => store.snapshot())
  ipcMain.handle('workspace:openRepository', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Open a Git repository',
      properties: ['openDirectory'],
      buttonLabel: 'Open repository',
    })
    if (selection.canceled || selection.filePaths.length === 0) return store.snapshot()
    return openRepository(selection.filePaths[0], store, git, broadcast)
  })
  ipcMain.handle('workspace:openRepositoryAt', (_event, path: string) =>
    openRepository(path, store, git, broadcast),
  )
  ipcMain.handle('workspace:selectRepository', (_event, projectId: string) => {
    const project = store.getProjectById(projectId)
    if (!project) throw new Error('That repository is no longer in the recent repository list.')
    return openRepository(project.path, store, git, broadcast)
  })
  ipcMain.handle('workspace:getRepositoryStatus', (_event, taskId?: string) => {
    const project = requireProject(store)
    if (!taskId) return git.getRepositoryStatus(project.path)
    const task = store.getTask(taskId)
    if (!task || task.projectId !== project.id) throw new Error('That task is not part of the current repository.')
    return git.getRepositoryStatus(task.worktreePath)
  })
  ipcMain.handle('branches:list', () => {
    const project = requireProject(store)
    return git.listBranches(project.path)
  })
  ipcMain.handle('branches:switch', async (_event, name: string) => {
    const project = requireProject(store)
    await git.switchBranch(project.path, name)
    return openRepository(project.path, store, git, broadcast)
  })
  ipcMain.handle('branches:create', async (_event, name: string, baseBranch?: string) => {
    const project = requireProject(store)
    await git.createBranch(project.path, name, baseBranch)
    return openRepository(project.path, store, git, broadcast)
  })
  ipcMain.handle('tasks:create', (_event, input: CreateTaskInput) => tasks.create(input))
  ipcMain.handle('tasks:get', (_event, taskId: string) => tasks.get(taskId))
  ipcMain.handle('tasks:sendMessage', (_event, taskId: string, message: string) =>
    tasks.sendMessage(taskId, message),
  )
  ipcMain.handle('tasks:cancel', (_event, taskId: string) => tasks.cancel(taskId))
  ipcMain.handle('tasks:runVerification', (_event, taskId: string) => tasks.runVerification(taskId))
  ipcMain.handle('tasks:approve', (_event, taskId: string) => tasks.approve(taskId))
  ipcMain.handle('tasks:getDiff', (_event, taskId: string, filePath?: string) => tasks.getDiff(taskId, filePath))
}

function requireProject(store: WorkspaceStore): Project {
  const project = store.getProject()
  if (!project) throw new Error('Open a Git repository first.')
  return project
}

async function openRepository(
  path: string,
  store: WorkspaceStore,
  git: GitService,
  broadcast: (snapshot: WorkspaceSnapshot) => void,
): Promise<WorkspaceSnapshot> {
  const inspected = await git.inspectRepository(path)
  const project: Project = {
    ...inspected,
    id: createHash('sha256').update(inspected.path).digest('hex').slice(0, 16),
    openedAt: new Date().toISOString(),
  }
  await store.setProject(project)
  const snapshot = store.snapshot()
  broadcast(snapshot)
  return snapshot
}
