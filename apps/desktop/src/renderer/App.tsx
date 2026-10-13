import { useEffect } from 'react'
import { AlertCircle, LoaderCircle, LogIn, X } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Dashboard } from './components/Dashboard'
import { CodeWorkbench } from './components/CodeWorkbench'
import { NewSessionModal } from './components/NewTaskModal'
import { Onboarding } from './components/Onboarding'
import { RepositoryBar } from './components/RepositoryBar'
import { SessionDetail } from './components/TaskDetail'
import { useAppStore } from './store'

export default function App() {
  const initialize = useAppStore((state) => state.initialize)
  const project = useAppStore((state) => state.project)
  const sessions = useAppStore((state) => state.sessions)
  const isLoading = useAppStore((state) => state.isLoading)
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const isNewSessionOpen = useAppStore((state) => state.isNewSessionOpen)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const openRepository = useAppStore((state) => state.openRepository)
  const error = useAppStore((state) => state.error)
  const clearError = useAppStore((state) => state.clearError)
  const githubAuthRequired = useAppStore((state) => state.githubAuthRequired)
  const isSigningInToGitHub = useAppStore((state) => state.isSigningInToGitHub)
  const signInWithGitHub = useAppStore((state) => state.signInWithGitHub)

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
      <main className="workspace-shell">
        <Group className="main-split" defaultLayout={{ workbench: 40, session: 60 }} orientation="horizontal">
          <Panel className="workbench-panel" defaultSize="40%" id="workbench" minSize="28%" maxSize="65%">
            <CodeWorkbench project={project} session={selectedSession ?? null} />
          </Panel>
          <Separator className="main-split-separator" />
          <Panel className="session-panel" defaultSize="60%" id="session" minSize="35%">
            <section className="session-workspace">
              {selectedSession ? <SessionDetail session={selectedSession} /> : <Dashboard project={project} sessions={projectSessions} />}
            </section>
          </Panel>
        </Group>
      </main>

      {isNewSessionOpen ? <NewSessionModal /> : null}
      {error ? (
        <div className="error-toast" role="alert">
          <AlertCircle size={17} /><span>{error}</span>
          {githubAuthRequired ? (
            <button className="error-toast-action" disabled={isSigningInToGitHub} onClick={() => void signInWithGitHub()} type="button">
              {isSigningInToGitHub ? <LoaderCircle className="spin-slow" size={14} /> : <LogIn size={14} />}
              {isSigningInToGitHub ? 'Waiting…' : 'Sign in'}
            </button>
          ) : null}
          <button aria-label="Dismiss error" onClick={clearError} type="button"><X size={15} /></button>
        </div>
      ) : null}
    </div>
  )
}
