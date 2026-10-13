import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, CreateSessionInput, GitHubAuthState, WorkspaceSnapshot } from '../shared/types'

const api: AppApi = {
  github: {
    getStatus: () => ipcRenderer.invoke('github:getStatus'),
    signIn: () => ipcRenderer.invoke('github:signIn'),
    signOut: () => ipcRenderer.invoke('github:signOut'),
  },
  workspace: {
    getSnapshot: () => ipcRenderer.invoke('workspace:getSnapshot'),
    openRepository: () => ipcRenderer.invoke('workspace:openRepository'),
    openRepositoryAt: (path) => ipcRenderer.invoke('workspace:openRepositoryAt', path),
    selectRepository: (projectId) => ipcRenderer.invoke('workspace:selectRepository', projectId),
    getRepositoryStatus: (sessionId) => ipcRenderer.invoke('workspace:getRepositoryStatus', sessionId),
    fetchOrigin: (sessionId) => ipcRenderer.invoke('workspace:fetchOrigin', sessionId),
    commit: (summary, description, sessionId) => ipcRenderer.invoke('workspace:commit', summary, description, sessionId),
  },
  branches: {
    list: () => ipcRenderer.invoke('branches:list'),
    switch: (name) => ipcRenderer.invoke('branches:switch', name),
    create: (name, baseBranch) => ipcRenderer.invoke('branches:create', name, baseBranch),
  },
  files: {
    list: (sessionId) => ipcRenderer.invoke('files:list', sessionId),
    read: (path, sessionId) => ipcRenderer.invoke('files:read', path, sessionId),
    save: (path, contents, sessionId) => ipcRenderer.invoke('files:save', path, contents, sessionId),
    getChangedFiles: (sessionId) => ipcRenderer.invoke('files:getChangedFiles', sessionId),
    getDiff: (filePath, sessionId) => ipcRenderer.invoke('files:getDiff', filePath, sessionId),
  },
  sessions: {
    create: (input: CreateSessionInput) => ipcRenderer.invoke('sessions:create', input),
    get: (sessionId) => ipcRenderer.invoke('sessions:get', sessionId),
    rename: (sessionId, title) => ipcRenderer.invoke('sessions:rename', sessionId, title),
    delete: (sessionId) => ipcRenderer.invoke('sessions:delete', sessionId),
    setPinned: (sessionId, isPinned) => ipcRenderer.invoke('sessions:setPinned', sessionId, isPinned),
    setUnread: (sessionId, isUnread) => ipcRenderer.invoke('sessions:setUnread', sessionId, isUnread),
    sendMessage: (sessionId, message) => ipcRenderer.invoke('sessions:sendMessage', sessionId, message),
    stop: (sessionId) => ipcRenderer.invoke('sessions:stop', sessionId),
    runVerification: (sessionId) => ipcRenderer.invoke('sessions:runVerification', sessionId),
    commit: (sessionId, message) => ipcRenderer.invoke('sessions:commit', sessionId, message),
    getDiff: (sessionId, filePath) => ipcRenderer.invoke('sessions:getDiff', sessionId, filePath),
  },
  events: {
    onWorkspaceChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: WorkspaceSnapshot) => callback(snapshot)
      ipcRenderer.on('workspace:changed', listener)
      return () => ipcRenderer.removeListener('workspace:changed', listener)
    },
    onGitHubAuthChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, state: GitHubAuthState) => callback(state)
      ipcRenderer.on('github:authChanged', listener)
      return () => ipcRenderer.removeListener('github:authChanged', listener)
    },
  },
}

contextBridge.exposeInMainWorld('vivlio', api)
