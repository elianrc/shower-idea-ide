import { useEffect } from 'react'
import { AlertCircle, Code2, GitCompareArrows, History, Settings2, X } from 'lucide-react'
import type { Project, Task } from '../shared/types'
import { Dashboard } from './components/Dashboard'
import { NewTaskModal } from './components/NewTaskModal'
import { Onboarding } from './components/Onboarding'
import { Sidebar } from './components/Sidebar'
import { TaskDetail } from './components/TaskDetail'
import { useAppStore } from './store'

export default function App() {
  const initialize = useAppStore((state) => state.initialize)
  const project = useAppStore((state) => state.project)
  const tasks = useAppStore((state) => state.tasks)
  const isLoading = useAppStore((state) => state.isLoading)
  const selectedTaskId = useAppStore((state) => state.selectedTaskId)
  const view = useAppStore((state) => state.view)
  const isNewTaskOpen = useAppStore((state) => state.isNewTaskOpen)
  const setNewTaskOpen = useAppStore((state) => state.setNewTaskOpen)
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
        setNewTaskOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [project, setNewTaskOpen])

  if (!project) return <Onboarding isLoading={isLoading} onOpen={() => void openRepository()} />

  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const selectedTask = projectTasks.find((task) => task.id === selectedTaskId)

  return (
    <div className="app-shell">
      <Sidebar project={project} tasks={projectTasks} />
      <main className="workspace">
        <div className="workspace-titlebar">
          <span>{selectedTask ? selectedTask.title : project.name}</span>
          <button aria-label="Settings" className="icon-button subtle" type="button"><Settings2 size={16} /></button>
        </div>
        {selectedTask ? <TaskDetail task={selectedTask} /> : <WorkspaceView project={project} tasks={projectTasks} view={view} />}
      </main>

      {isNewTaskOpen ? <NewTaskModal /> : null}
      {error ? (
        <div className="error-toast" role="alert">
          <AlertCircle size={17} /><span>{error}</span>
          <button aria-label="Dismiss error" onClick={clearError} type="button"><X size={15} /></button>
        </div>
      ) : null}
    </div>
  )
}

function WorkspaceView({ project, tasks, view }: { project: Project; tasks: Task[]; view: ReturnType<typeof useAppStore.getState>['view'] }) {
  if (view === 'tasks') return <Dashboard project={project} tasks={tasks} />
  if (view === 'changes') {
    return (
      <CollectionView
        description="Tasks waiting for human review, gathered in one place."
        icon={<GitCompareArrows size={21} />}
        tasks={tasks.filter((task) => task.status === 'ready_for_review')}
        title="Changes"
      />
    )
  }
  if (view === 'history') {
    return (
      <CollectionView
        description={`The decisions and completed work that shaped ${project.name}.`}
        icon={<History size={21} />}
        tasks={tasks.filter((task) => task.status === 'committed')}
        title="Development history"
      />
    )
  }
  return (
    <div className="placeholder-page">
      <span className="placeholder-icon"><Code2 size={25} /></span>
      <p className="eyebrow">Code</p>
      <h1>Code is here when context calls for it.</h1>
      <p>Open a task’s Changes tab to inspect its implementation in the built-in Monaco viewer. A general-purpose editor belongs to the next milestone.</p>
    </div>
  )
}

function CollectionView({ title, description, icon, tasks }: { title: string; description: string; icon: React.ReactNode; tasks: Task[] }) {
  const selectTask = useAppStore((state) => state.selectTask)
  return (
    <div className="page collection-page">
      <header className="page-header">
        <div><p className="eyebrow">Project</p><h1>{title}</h1><p className="page-description">{description}</p></div>
      </header>
      {tasks.length === 0 ? (
        <div className="collection-empty">{icon}<h2>Nothing here yet</h2><p>Relevant tasks will appear here automatically.</p></div>
      ) : (
        <div className="collection-list">
          {tasks.map((task) => (
            <button key={task.id} onClick={() => selectTask(task.id)} type="button">
              <span>{task.title}</span><small>{task.summary}</small><time>{new Date(task.updatedAt).toLocaleDateString()}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
