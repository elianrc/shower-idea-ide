import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { CreateSessionInput, Project, WorkspaceSnapshot } from '../shared/types'
import { CodexAdapter } from './services/agent'
import { GitService } from './services/git-service'
import { ProcessManager } from './services/process-manager'
import { WorkspaceStore } from './services/store'
import { SessionManager } from './services/task-manager'
import { WorkspaceFilesService } from './services/workspace-files'

export async function registerIpc(userDataPath: string): Promise<void> {
  const store = new WorkspaceStore(join(userDataPath, 'workspace.json'))
  await store.load()
  const processes = new ProcessManager()
  const git = new GitService(processes)
  const agent = new CodexAdapter(processes)
  const files = new WorkspaceFilesService(processes)
  const broadcast = (snapshot: WorkspaceSnapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('workspace:changed', snapshot)
    }
  }
  const sessions = new SessionManager(
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
  ipcMain.handle('workspace:getRepositoryStatus', (_event, sessionId?: string) => {
    const project = requireProject(store)
    if (!sessionId) return git.getRepositoryStatus(project.path)
    const session = store.getSession(sessionId)
    if (!session || session.projectId !== project.id) throw new Error('That session is not part of the current repository.')
    return git.getRepositoryStatus(session.workspacePath)
  })
  ipcMain.handle('workspace:fetchOrigin', async (_event, sessionId?: string) => {
    const project = requireProject(store)
    await git.fetchOrigin(project.path)
    return git.getRepositoryStatus(resolveWorkspacePath(store, sessionId))
  })
  ipcMain.handle('workspace:commit', async (_event, summary: string, description?: string, sessionId?: string) => {
    const title = summary.trim()
    if (!title) throw new Error('Enter a commit summary.')
    if (title.length > 120) throw new Error('Keep the commit summary under 120 characters.')
    const body = description?.trim()
    const message = body ? `${title}\n\n${body}` : title
    const workspacePath = resolveWorkspacePath(store, sessionId)
    let commit: string
    if (sessionId) {
      const committedSession = await sessions.commit(sessionId, message)
      if (!committedSession.commit) throw new Error(committedSession.error || 'Unable to commit session changes.')
      commit = committedSession.commit
    } else {
      commit = await git.commit(workspacePath, message)
    }
    const [changedFiles, repositoryStatus] = await Promise.all([
      git.getChangedFiles(workspacePath),
      git.getRepositoryStatus(workspacePath),
    ])
    return { commit, changedFiles, repositoryStatus }
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
  ipcMain.handle('files:list', (_event, sessionId?: string) =>
    files.list(resolveWorkspacePath(store, sessionId)),
  )
  ipcMain.handle('files:read', (_event, path: string, sessionId?: string) =>
    files.read(resolveWorkspacePath(store, sessionId), path),
  )
  ipcMain.handle('files:save', async (_event, path: string, contents: string, sessionId?: string) => {
    const workspacePath = resolveWorkspacePath(store, sessionId)
    const file = await files.write(workspacePath, path, contents)
    const [changedFiles, repositoryStatus] = await Promise.all([
      git.getChangedFiles(workspacePath),
      git.getRepositoryStatus(workspacePath),
    ])
    if (sessionId) await sessions.setChangedFiles(sessionId, changedFiles)
    return { file, changedFiles, repositoryStatus }
  })
  ipcMain.handle('files:getChangedFiles', (_event, sessionId?: string) =>
    git.getChangedFiles(resolveWorkspacePath(store, sessionId)),
  )
  ipcMain.handle('files:getDiff', (_event, filePath?: string, sessionId?: string) =>
    git.getDiff(sessionId ?? 'workspace', resolveWorkspacePath(store, sessionId), filePath),
  )
  ipcMain.handle('sessions:create', (_event, input: CreateSessionInput) => sessions.create(input))
  ipcMain.handle('sessions:get', (_event, sessionId: string) => sessions.get(sessionId))
  ipcMain.handle('sessions:rename', (_event, sessionId: string, title: string) => sessions.rename(sessionId, title))
  ipcMain.handle('sessions:delete', (_event, sessionId: string) => sessions.delete(sessionId))
  ipcMain.handle('sessions:setPinned', (_event, sessionId: string, isPinned: boolean) => sessions.setPinned(sessionId, isPinned))
  ipcMain.handle('sessions:setUnread', (_event, sessionId: string, isUnread: boolean) => sessions.setUnread(sessionId, isUnread))
  ipcMain.handle('sessions:sendMessage', (_event, sessionId: string, message: string) =>
    sessions.sendMessage(sessionId, message),
  )
  ipcMain.handle('sessions:stop', (_event, sessionId: string) => sessions.stop(sessionId))
  ipcMain.handle('sessions:runVerification', (_event, sessionId: string) => sessions.runVerification(sessionId))
  ipcMain.handle('sessions:commit', (_event, sessionId: string, message?: string) => sessions.commit(sessionId, message))
  ipcMain.handle('sessions:getDiff', (_event, sessionId: string, filePath?: string) => sessions.getDiff(sessionId, filePath))
}

function requireProject(store: WorkspaceStore): Project {
  const project = store.getProject()
  if (!project) throw new Error('Open a Git repository first.')
  return project
}

function resolveWorkspacePath(store: WorkspaceStore, sessionId?: string): string {
  const project = requireProject(store)
  if (!sessionId) return project.path
  const session = store.getSession(sessionId)
  if (!session || session.projectId !== project.id) throw new Error('That session is not part of the current repository.')
  return session.workspacePath
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
