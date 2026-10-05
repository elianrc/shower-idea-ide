import { create } from 'zustand'
import type { BranchInfo, CreateTaskInput, RepositoryStatus, Task, WorkspaceSnapshot } from '../shared/types'

type View = 'tasks' | 'changes' | 'history' | 'code'

interface AppState extends WorkspaceSnapshot {
  isLoading: boolean
  error: string | null
  selectedTaskId: string | null
  view: View
  isNewTaskOpen: boolean
  branches: BranchInfo[]
  repositoryStatus: RepositoryStatus | null
  initialize(): Promise<() => void>
  openRepository(): Promise<void>
  selectRepository(projectId: string): Promise<void>
  refreshBranches(): Promise<void>
  refreshRepositoryStatus(taskId?: string): Promise<void>
  switchBranch(name: string): Promise<boolean>
  createBranch(name: string, baseBranch?: string): Promise<boolean>
  createTask(input: CreateTaskInput): Promise<Task | null>
  selectTask(taskId: string | null): void
  setView(view: View): void
  setNewTaskOpen(open: boolean): void
  clearError(): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useAppStore = create<AppState>((set, get) => ({
  project: null,
  projects: [],
  tasks: [],
  isLoading: true,
  error: null,
  selectedTaskId: null,
  view: 'tasks',
  isNewTaskOpen: false,
  branches: [],
  repositoryStatus: null,

  async initialize() {
    try {
      const snapshot = await window.showerIdea.workspace.getSnapshot()
      const [branches, repositoryStatus] = snapshot.project
        ? await Promise.all([
            window.showerIdea.branches.list(),
            window.showerIdea.workspace.getRepositoryStatus(),
          ])
        : [[], null]
      set({ ...snapshot, branches, repositoryStatus, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
    return window.showerIdea.events.onWorkspaceChanged((snapshot) => {
      const selectedTaskId = get().selectedTaskId
      set({
        ...snapshot,
        selectedTaskId: selectedTaskId && snapshot.tasks.some((task) => task.id === selectedTaskId)
          ? selectedTaskId
          : null,
      })
    })
  },

  async openRepository() {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.showerIdea.workspace.openRepository()
      const [branches, repositoryStatus] = snapshot.project
        ? await Promise.all([
            window.showerIdea.branches.list(),
            window.showerIdea.workspace.getRepositoryStatus(),
          ])
        : [[], null]
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedTaskId: null, view: 'tasks' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  async selectRepository(projectId) {
    if (projectId === get().project?.id) return
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.showerIdea.workspace.selectRepository(projectId)
      const [branches, repositoryStatus] = await Promise.all([
        window.showerIdea.branches.list(),
        window.showerIdea.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedTaskId: null, view: 'tasks' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  async refreshBranches() {
    if (!get().project) return
    try {
      set({ branches: await window.showerIdea.branches.list() })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  async refreshRepositoryStatus(taskId) {
    if (!get().project) return
    try {
      set({ repositoryStatus: await window.showerIdea.workspace.getRepositoryStatus(taskId) })
    } catch {
      set({ repositoryStatus: null })
    }
  },

  async switchBranch(name) {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.showerIdea.branches.switch(name)
      const [branches, repositoryStatus] = await Promise.all([
        window.showerIdea.branches.list(),
        window.showerIdea.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedTaskId: null, view: 'tasks' })
      return true
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return false
    }
  },

  async createBranch(name, baseBranch) {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.showerIdea.branches.create(name, baseBranch)
      const [branches, repositoryStatus] = await Promise.all([
        window.showerIdea.branches.list(),
        window.showerIdea.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedTaskId: null, view: 'tasks' })
      return true
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return false
    }
  },

  async createTask(input) {
    set({ isLoading: true, error: null })
    try {
      const task = await window.showerIdea.tasks.create(input)
      set({ isLoading: false, isNewTaskOpen: false, selectedTaskId: task.id })
      return task
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return null
    }
  },

  selectTask(selectedTaskId) {
    set({ selectedTaskId })
    void get().refreshRepositoryStatus(selectedTaskId ?? undefined)
  },
  setView(view) {
    set({ view, selectedTaskId: null })
    void get().refreshRepositoryStatus()
  },
  setNewTaskOpen: (isNewTaskOpen) => set({ isNewTaskOpen }),
  clearError: () => set({ error: null }),
}))
