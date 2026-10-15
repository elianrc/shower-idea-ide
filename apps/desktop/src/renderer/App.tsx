import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AlertCircle, LoaderCircle, LogIn, X } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Dashboard } from './components/Dashboard'
import { CodeWorkbench } from './components/CodeWorkbench'
import { NewSessionModal } from './components/NewTaskModal'
import { Onboarding } from './components/Onboarding'
import { RepositoryBar } from './components/RepositoryBar'
import { SessionDetail } from './components/TaskDetail'
import { useAppStore } from './store'

const defaultNavigatorWidth = 244
const minimumNavigatorWidth = 180
const maximumNavigatorWidth = 380
const navigatorWidthStorageKey = 'vivlio:navigator-width:v1'

export default function App() {
  const [navigatorWidth, setNavigatorWidth] = useState(readNavigatorWidth)
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
    <div className="app-shell" style={{ '--navigator-width': `${navigatorWidth}px` } as CSSProperties}>
      <div aria-hidden="true" className="window-titlebar" />
      <RepositoryBar project={project} selectedSession={selectedSession ?? null} />
      <NavigatorResizeHandle onResize={setNavigatorWidth} width={navigatorWidth} />
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

function NavigatorResizeHandle({ onResize, width }: { onResize(width: number): void; width: number }) {
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null)
  const latestWidth = useRef(width)
  latestWidth.current = width

  const resize = (nextWidth: number) => {
    const clampedWidth = clampNavigatorWidth(nextWidth)
    latestWidth.current = clampedWidth
    onResize(clampedWidth)
  }
  const save = (nextWidth: number) => window.localStorage.setItem(navigatorWidthStorageKey, String(clampNavigatorWidth(nextWidth)))

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointerX: event.clientX, width }
    document.body.classList.add('is-resizing-navigator')
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    resize(dragStart.current.width + event.clientX - dragStart.current.pointerX)
  }

  const finishPointerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    dragStart.current = null
    document.body.classList.remove('is-resizing-navigator')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    save(latestWidth.current)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 8
    let nextWidth = width
    if (event.key === 'ArrowLeft') nextWidth -= step
    else if (event.key === 'ArrowRight') nextWidth += step
    else if (event.key === 'Home') nextWidth = minimumNavigatorWidth
    else if (event.key === 'End') nextWidth = maximumNavigatorWidth
    else return
    event.preventDefault()
    resize(nextWidth)
    save(nextWidth)
  }

  return (
    <div
      aria-label="Resize repository sidebar"
      aria-orientation="vertical"
      aria-valuemax={maximumNavigatorWidth}
      aria-valuemin={minimumNavigatorWidth}
      aria-valuenow={Math.round(width)}
      className="navigator-resize-handle"
      onDoubleClick={() => { resize(defaultNavigatorWidth); save(defaultNavigatorWidth) }}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={finishPointerResize}
      onPointerCancel={finishPointerResize}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerResize}
      role="separator"
      tabIndex={0}
    />
  )
}

function readNavigatorWidth(): number {
  const stored = Number(window.localStorage.getItem(navigatorWidthStorageKey))
  return Number.isFinite(stored) && stored > 0 ? clampNavigatorWidth(stored) : defaultNavigatorWidth
}

function clampNavigatorWidth(width: number): number {
  return Math.min(maximumNavigatorWidth, Math.max(minimumNavigatorWidth, Math.round(width)))
}
