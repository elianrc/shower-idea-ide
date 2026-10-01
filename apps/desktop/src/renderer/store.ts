import { create } from 'zustand'
import type { CreateTaskInput, Task, WorkspaceSnapshot } from '../shared/types'

type View = 'tasks' | 'changes' | 'history' | 'code'

interface AppState extends WorkspaceSnapshot {
  isLoading: boolean
  error: string | null
  selectedTaskId: string | null
  view: View
  isNewTaskOpen: boolean
  initialize(): Promise<() => void>
  openRepository(): Promise<void>
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
  tasks: [],
  isLoading: true,
  error: null,
  selectedTaskId: null,
  view: 'tasks',
  isNewTaskOpen: false,

  async initialize() {
    try {
      const snapshot = await window.showerIdea.workspace.getSnapshot()
      set({ ...snapshot, isLoading: false })
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
      set({ ...snapshot, isLoading: false, selectedTaskId: null, view: 'tasks' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
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

  selectTask: (selectedTaskId) => set({ selectedTaskId }),
  setView: (view) => set({ view, selectedTaskId: null }),
  setNewTaskOpen: (isNewTaskOpen) => set({ isNewTaskOpen }),
  clearError: () => set({ error: null }),
}))
