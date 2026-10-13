import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, CreateSessionInput, WorkspaceSnapshot } from '../shared/types'

const api: AppApi = {
  workspace: {
    getSnapshot: () => ipcRenderer.invoke('workspace:getSnapshot'),
    openRepository: () => ipcRenderer.invoke('workspace:openRepository'),
    openRepositoryAt: (path) => ipcRenderer.invoke('workspace:openRepositoryAt', path),
    selectRepository: (projectId) => ipcRenderer.invoke('workspace:selectRepository', projectId),
    getRepositoryStatus: (sessionId) => ipcRenderer.invoke('workspace:getRepositoryStatus', sessionId),
  },
  branches: {
    list: () => ipcRenderer.invoke('branches:list'),
    switch: (name) => ipcRenderer.invoke('branches:switch', name),
    create: (name, baseBranch) => ipcRenderer.invoke('branches:create', name, baseBranch),
  },
  files: {
    list: (sessionId) => ipcRenderer.invoke('files:list', sessionId),
    read: (path, sessionId) => ipcRenderer.invoke('files:read', path, sessionId),
    getChangedFiles: (sessionId) => ipcRenderer.invoke('files:getChangedFiles', sessionId),
    getDiff: (filePath, sessionId) => ipcRenderer.invoke('files:getDiff', filePath, sessionId),
  },
  sessions: {
    create: (input: CreateSessionInput) => ipcRenderer.invoke('sessions:create', input),
    get: (sessionId) => ipcRenderer.invoke('sessions:get', sessionId),
    sendMessage: (sessionId, message) => ipcRenderer.invoke('sessions:sendMessage', sessionId, message),
    stop: (sessionId) => ipcRenderer.invoke('sessions:stop', sessionId),
    runVerification: (sessionId) => ipcRenderer.invoke('sessions:runVerification', sessionId),
    commit: (sessionId) => ipcRenderer.invoke('sessions:commit', sessionId),
    getDiff: (sessionId, filePath) => ipcRenderer.invoke('sessions:getDiff', sessionId, filePath),
  },
  events: {
    onWorkspaceChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: WorkspaceSnapshot) => callback(snapshot)
      ipcRenderer.on('workspace:changed', listener)
      return () => ipcRenderer.removeListener('workspace:changed', listener)
    },
  },
}

contextBridge.exposeInMainWorld('vivlio', api)
