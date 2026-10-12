import { useEffect } from 'react'
import { AlertCircle, Code2, GitCompareArrows, History, X } from 'lucide-react'
import type { Project, Session } from '../shared/types'
import { Dashboard } from './components/Dashboard'
import { NewSessionModal } from './components/NewTaskModal'
import { Onboarding } from './components/Onboarding'
import { RepositoryBar } from './components/RepositoryBar'
import { Sidebar } from './components/Sidebar'
import { SessionDetail } from './components/TaskDetail'
import { useAppStore } from './store'

export default function App() {
  const initialize = useAppStore((state) => state.initialize)
  const project = useAppStore((state) => state.project)
  const sessions = useAppStore((state) => state.sessions)
  const isLoading = useAppStore((state) => state.isLoading)
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const view = useAppStore((state) => state.view)
  const isNewSessionOpen = useAppStore((state) => state.isNewSessionOpen)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const openRepository = useAppStore((state) => state.openRepository)
  const error = useAppStore((state) => state.error)
  const clearError = useAppStore((state) => state.clearError)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    void initialize().then((cleanup) => { unsubscribe = cleanup })
    return () => unsubscribe?.()
  }, [initialize])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && project) {
        event.preventDefault()
        setNewSessionOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [project, setNewSessionOpen])

  if (!project) return <Onboarding isLoading={isLoading} onOpen={() => void openRepository()} />

  const projectSessions = sessions.filter((session) => session.projectId === project.id)
  const selectedSession = projectSessions.find((session) => session.id === selectedSessionId)

  return (
    <div className="app-shell">
      <div aria-hidden="true" className="window-titlebar" />
      <RepositoryBar project={project} selectedSession={selectedSession ?? null} />
      <Sidebar project={project} sessions={projectSessions} />
      <main className="workspace">
        {selectedSession ? <SessionDetail session={selectedSession} /> : <WorkspaceView project={project} sessions={projectSessions} view={view} />}
      </main>

      {isNewSessionOpen ? <NewSessionModal /> : null}
      {error ? (
        <div className="error-toast" role="alert">
          <AlertCircle size={17} /><span>{error}</span>
          <button aria-label="Dismiss error" onClick={clearError} type="button"><X size={15} /></button>
        </div>
      ) : null}
    </div>
  )
}

function WorkspaceView({ project, sessions, view }: { project: Project; sessions: Session[]; view: ReturnType<typeof useAppStore.getState>['view'] }) {
  if (view === 'sessions') return <Dashboard project={project} sessions={sessions} />
  if (view === 'changes') {
    return (
      <CollectionView
        description="Sessions with uncommitted file changes."
        empty="No session changes yet."
        icon={<GitCompareArrows size={21} />}
        sessions={sessions.filter((session) => session.changedFiles.length > 0 && session.status !== 'completed')}
        title="Changes"
      />
    )
  }
  if (view === 'history') {
    return (
      <CollectionView
        description={`Committed agent sessions that shaped ${project.name}.`}
        empty="Committed sessions will appear here."
        icon={<History size={21} />}
        sessions={sessions.filter((session) => session.status === 'completed')}
        title="Session history"
      />
    )
  }
  return (
    <div className="placeholder-page">
      <span className="placeholder-icon"><Code2 size={25} /></span>
      <p className="eyebrow">Code</p>
      <h1>Inspect code in context.</h1>
      <p>Open a session’s Changes tab to review its diff. A repository-wide editor can build on this session-first foundation later.</p>
    </div>
  )
}

function CollectionView({ title, description, empty, icon, sessions }: { title: string; description: string; empty: string; icon: React.ReactNode; sessions: Session[] }) {
  const selectSession = useAppStore((state) => state.selectSession)
  return (
    <div className="page collection-page">
      <header className="page-header"><div><p className="eyebrow">Repository</p><h1>{title}</h1><p className="page-description">{description}</p></div></header>
      {sessions.length === 0 ? (
        <div className="collection-empty">{icon}<h2>Nothing here yet</h2><p>{empty}</p></div>
      ) : (
        <div className="collection-list">
          {sessions.map((session) => (
            <button key={session.id} onClick={() => selectSession(session.id)} type="button">
              <span>{session.title}</span><small>{session.summary}</small><time>{new Date(session.updatedAt).toLocaleDateString()}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
