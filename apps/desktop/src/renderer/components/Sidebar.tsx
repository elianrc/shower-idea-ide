import { Clock3, Code2, GitCompareArrows, ListTodo, Plus } from 'lucide-react'
import type { Project, Task } from '../../shared/types'
import { useAppStore } from '../store'
import { BrandMark } from './BrandMark'
import { StatusPill } from './StatusPill'

const navigation = [
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'changes' as const, label: 'Changes', icon: GitCompareArrows },
  { id: 'history' as const, label: 'History', icon: Clock3 },
  { id: 'code' as const, label: 'Code', icon: Code2 },
]

export function Sidebar({ project, tasks }: { project: Project; tasks: Task[] }) {
  const view = useAppStore((state) => state.view)
  const selectedTaskId = useAppStore((state) => state.selectedTaskId)
  const setView = useAppStore((state) => state.setView)
  const selectTask = useAppStore((state) => state.selectTask)
  const setNewTaskOpen = useAppStore((state) => state.setNewTaskOpen)
  const activeTasks = tasks.filter((task) => !['committed', 'cancelled'].includes(task.status)).slice(0, 5)

  return (
    <aside className="sidebar">
      <div className="sidebar-drag-region">
        <BrandMark size={25} />
        <span>Vivlio</span>
      </div>

      <nav aria-label="Workspace" className="main-nav">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={view === item.id && !selectedTaskId ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-section">
        <div className="section-label-row">
          <span className="section-label">Active tasks</span>
          <button aria-label="Create task" className="icon-button subtle" onClick={() => setNewTaskOpen(true)} type="button">
            <Plus size={15} />
          </button>
        </div>
        <div className="compact-task-list">
          {activeTasks.length === 0 ? <p className="sidebar-empty">Nothing in flight</p> : null}
          {activeTasks.map((task) => (
            <button
              className={selectedTaskId === task.id ? 'compact-task active' : 'compact-task'}
              key={task.id}
              onClick={() => selectTask(task.id)}
              type="button"
            >
              <StatusPill compact status={task.status} />
              <span>{task.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <span className={project.isClean ? 'branch-dot clean' : 'branch-dot'} />
        <span>{project.branch}</span>
        <span className="footer-state">{project.isClean ? 'clean' : 'changes'}</span>
      </div>
    </aside>
  )
}
