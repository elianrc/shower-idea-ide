import { create } from 'zustand'
import type { BranchInfo, CreateSessionInput, RepositoryStatus, Session, WorkspaceSnapshot } from '../shared/types'

type View = 'sessions' | 'changes' | 'history' | 'code'

interface AppState extends WorkspaceSnapshot {
  isLoading: boolean
  error: string | null
  selectedSessionId: string | null
  view: View
  isNewSessionOpen: boolean
  branches: BranchInfo[]
  repositoryStatus: RepositoryStatus | null
  initialize(): Promise<() => void>
  openRepository(): Promise<void>
  selectRepository(projectId: string): Promise<void>
  refreshBranches(): Promise<void>
  refreshRepositoryStatus(sessionId?: string): Promise<void>
  switchBranch(name: string): Promise<boolean>
  createBranch(name: string, baseBranch?: string): Promise<boolean>
  createSession(input: CreateSessionInput): Promise<Session | null>
  selectSession(sessionId: string | null): void
  setView(view: View): void
  setNewSessionOpen(open: boolean): void
  clearError(): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useAppStore = create<AppState>((set, get) => ({
  project: null,
  projects: [],
  sessions: [],
  isLoading: true,
  error: null,
  selectedSessionId: null,
  view: 'sessions',
  isNewSessionOpen: false,
  branches: [],
  repositoryStatus: null,

  async initialize() {
    try {
      const snapshot = await window.vivlio.workspace.getSnapshot()
      const [branches, repositoryStatus] = snapshot.project
        ? await Promise.all([
            window.vivlio.branches.list(),
            window.vivlio.workspace.getRepositoryStatus(),
          ])
        : [[], null]
      set({ ...snapshot, branches, repositoryStatus, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
    return window.vivlio.events.onWorkspaceChanged((snapshot) => {
      const selectedSessionId = get().selectedSessionId
      set({
        ...snapshot,
        selectedSessionId: selectedSessionId && snapshot.sessions.some((session) => session.id === selectedSessionId)
          ? selectedSessionId
          : null,
      })
    })
  },

  async openRepository() {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.vivlio.workspace.openRepository()
      const [branches, repositoryStatus] = snapshot.project
        ? await Promise.all([
            window.vivlio.branches.list(),
            window.vivlio.workspace.getRepositoryStatus(),
          ])
        : [[], null]
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null, view: 'sessions' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  async selectRepository(projectId) {
    if (projectId === get().project?.id) return
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.vivlio.workspace.selectRepository(projectId)
      const [branches, repositoryStatus] = await Promise.all([
        window.vivlio.branches.list(),
        window.vivlio.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null, view: 'sessions' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  async refreshBranches() {
    if (!get().project) return
    try {
      set({ branches: await window.vivlio.branches.list() })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  async refreshRepositoryStatus(sessionId) {
    if (!get().project) return
    try {
      set({ repositoryStatus: await window.vivlio.workspace.getRepositoryStatus(sessionId) })
    } catch {
      set({ repositoryStatus: null })
    }
  },

  async switchBranch(name) {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.vivlio.branches.switch(name)
      const [branches, repositoryStatus] = await Promise.all([
        window.vivlio.branches.list(),
        window.vivlio.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null, view: 'sessions' })
      return true
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return false
    }
  },

  async createBranch(name, baseBranch) {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.vivlio.branches.create(name, baseBranch)
      const [branches, repositoryStatus] = await Promise.all([
        window.vivlio.branches.list(),
        window.vivlio.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null, view: 'sessions' })
      return true
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return false
    }
  },

  async createSession(input) {
    set({ isLoading: true, error: null })
    try {
      const session = await window.vivlio.sessions.create(input)
      set({ isLoading: false, isNewSessionOpen: false, selectedSessionId: session.id })
      return session
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return null
    }
  },

  selectSession(selectedSessionId) {
    set({ selectedSessionId })
    void get().refreshRepositoryStatus(selectedSessionId ?? undefined)
  },
  setView(view) {
    set({ view, selectedSessionId: null })
    void get().refreshRepositoryStatus()
  },
  setNewSessionOpen: (isNewSessionOpen) => set({ isNewSessionOpen }),
  clearError: () => set({ error: null }),
}))
