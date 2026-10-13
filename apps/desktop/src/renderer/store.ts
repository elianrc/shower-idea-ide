import { create } from 'zustand'
import type { BranchInfo, CreateSessionInput, RepositoryStatus, Session, WorkspaceSnapshot } from '../shared/types'

interface AppState extends WorkspaceSnapshot {
  isLoading: boolean
  error: string | null
  selectedSessionId: string | null
  isNewSessionOpen: boolean
  branches: BranchInfo[]
  repositoryStatus: RepositoryStatus | null
  initialize(): Promise<() => void>
  openRepository(): Promise<void>
  selectRepository(projectId: string): Promise<void>
  refreshBranches(): Promise<void>
  refreshRepositoryStatus(sessionId?: string): Promise<void>
  fetchOrigin(sessionId?: string): Promise<boolean>
  setRepositoryStatus(status: RepositoryStatus): void
  switchBranch(name: string): Promise<boolean>
  createBranch(name: string, baseBranch?: string): Promise<boolean>
  createSession(input: CreateSessionInput): Promise<Session | null>
  renameSession(sessionId: string, title: string): Promise<boolean>
  deleteSession(sessionId: string): Promise<boolean>
  setSessionPinned(sessionId: string, isPinned: boolean): Promise<boolean>
  setSessionUnread(sessionId: string, isUnread: boolean): Promise<boolean>
  selectSession(sessionId: string | null): void
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
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null })
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
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null })
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

  async fetchOrigin(sessionId) {
    try {
      set({ repositoryStatus: await window.vivlio.workspace.fetchOrigin(sessionId) })
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  setRepositoryStatus: (repositoryStatus) => set({ repositoryStatus }),

  async switchBranch(name) {
    set({ isLoading: true, error: null })
    try {
      const snapshot = await window.vivlio.branches.switch(name)
      const [branches, repositoryStatus] = await Promise.all([
        window.vivlio.branches.list(),
        window.vivlio.workspace.getRepositoryStatus(),
      ])
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null })
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
      set({ ...snapshot, branches, repositoryStatus, isLoading: false, selectedSessionId: null })
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

  async renameSession(sessionId, title) {
    try {
      await window.vivlio.sessions.rename(sessionId, title)
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  async deleteSession(sessionId) {
    try {
      await window.vivlio.sessions.delete(sessionId)
      if (get().selectedSessionId === sessionId) set({ selectedSessionId: null })
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  async setSessionPinned(sessionId, isPinned) {
    try {
      await window.vivlio.sessions.setPinned(sessionId, isPinned)
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  async setSessionUnread(sessionId, isUnread) {
    try {
      await window.vivlio.sessions.setUnread(sessionId, isUnread)
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  selectSession(selectedSessionId) {
    set({ selectedSessionId })
    const session = selectedSessionId ? get().sessions.find((candidate) => candidate.id === selectedSessionId) : null
    if (session?.isUnread) void get().setSessionUnread(session.id, false)
    void get().refreshRepositoryStatus(selectedSessionId ?? undefined)
  },
  setNewSessionOpen: (isNewSessionOpen) => set({ isNewSessionOpen }),
  clearError: () => set({ error: null }),
}))
