import { Clock3, Code2, GitCompareArrows, MessagesSquare, Plus } from 'lucide-react'
import type { Project, Session } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

const navigation = [
  { id: 'sessions' as const, label: 'Sessions', icon: MessagesSquare },
  { id: 'changes' as const, label: 'Changes', icon: GitCompareArrows },
  { id: 'history' as const, label: 'History', icon: Clock3 },
  { id: 'code' as const, label: 'Code', icon: Code2 },
]

export function Sidebar({ project, sessions }: { project: Project; sessions: Session[] }) {
  const view = useAppStore((state) => state.view)
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const setView = useAppStore((state) => state.setView)
  const selectSession = useAppStore((state) => state.selectSession)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const recentSessions = sessions.filter((session) => session.status !== 'completed').slice(0, 8)

  return (
    <aside className="sidebar">
      <nav aria-label="Workspace" className="main-nav">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={view === item.id && !selectedSessionId ? 'nav-item active' : 'nav-item'}
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

      <div className="sidebar-section sessions-sidebar-section">
        <div className="section-label-row">
          <span className="section-label">Agent sessions</span>
          <button aria-label="Start session" className="icon-button subtle" onClick={() => setNewSessionOpen(true)} type="button">
            <Plus size={15} />
          </button>
        </div>
        <div className="compact-task-list">
          {recentSessions.length === 0 ? <p className="sidebar-empty">No sessions yet</p> : null}
          {recentSessions.map((session) => (
            <button
              className={selectedSessionId === session.id ? 'compact-task active' : 'compact-task'}
              key={session.id}
              onClick={() => selectSession(session.id)}
              type="button"
            >
              <StatusPill compact status={session.status} />
              <span>{session.title}</span>
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
