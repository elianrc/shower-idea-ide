import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, CreateTaskInput, WorkspaceSnapshot } from '../shared/types'

const api: AppApi = {
  workspace: {
    getSnapshot: () => ipcRenderer.invoke('workspace:getSnapshot'),
    openRepository: () => ipcRenderer.invoke('workspace:openRepository'),
    openRepositoryAt: (path) => ipcRenderer.invoke('workspace:openRepositoryAt', path),
    selectRepository: (projectId) => ipcRenderer.invoke('workspace:selectRepository', projectId),
  },
  branches: {
    list: () => ipcRenderer.invoke('branches:list'),
    switch: (name) => ipcRenderer.invoke('branches:switch', name),
    create: (name, baseBranch) => ipcRenderer.invoke('branches:create', name, baseBranch),
  },
  tasks: {
    create: (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input),
    get: (taskId) => ipcRenderer.invoke('tasks:get', taskId),
    sendMessage: (taskId, message) => ipcRenderer.invoke('tasks:sendMessage', taskId, message),
    cancel: (taskId) => ipcRenderer.invoke('tasks:cancel', taskId),
    runVerification: (taskId) => ipcRenderer.invoke('tasks:runVerification', taskId),
    approve: (taskId) => ipcRenderer.invoke('tasks:approve', taskId),
    getDiff: (taskId, filePath) => ipcRenderer.invoke('tasks:getDiff', taskId, filePath),
  },
  events: {
    onWorkspaceChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: WorkspaceSnapshot) => callback(snapshot)
      ipcRenderer.on('workspace:changed', listener)
      return () => ipcRenderer.removeListener('workspace:changed', listener)
    },
  },
}

contextBridge.exposeInMainWorld('showerIdea', api)
