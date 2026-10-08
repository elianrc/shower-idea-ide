import { ArrowUpRight, Bot, GitBranch, MessageSquarePlus, Plus, TerminalSquare } from 'lucide-react'
import type { Project, Session } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

export function Dashboard({ project, sessions }: { project: Project; sessions: Session[] }) {
  const selectSession = useAppStore((state) => state.selectSession)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const openSessions = sessions.filter((session) => session.status !== 'completed')
  const completed = sessions.filter((session) => session.status === 'completed').slice(0, 5)

  return (
    <div className="page dashboard-page sessions-page">
      <header className="page-header session-home-header">
        <div>
          <p className="eyebrow">Agent workspace</p>
          <h1>{project.name}</h1>
          <div className="repo-meta">
            <span>{project.branch}</span>
            <span className="meta-separator">/</span>
            <span>{project.isClean ? 'Working tree clean' : 'Uncommitted changes'}</span>
          </div>
        </div>
        <button className="primary-button" onClick={() => setNewSessionOpen(true)} type="button">
          <Plus size={17} /> New session
        </button>
      </header>

      {openSessions.length === 0 ? (
        <section className="empty-dashboard session-launcher">
          <div className="empty-orbit"><TerminalSquare size={25} /></div>
          <h2>Open a coding session</h2>
          <p>Talk to Codex in this repository. Use the current branch for quick work or create an isolated worktree for parallel changes.</p>
          <button className="secondary-button" onClick={() => setNewSessionOpen(true)} type="button">
            Start with Codex <ArrowUpRight size={15} />
          </button>
        </section>
      ) : (
        <section className="dashboard-section">
          <div className="section-heading"><h2>Open sessions</h2><span>{openSessions.length}</span></div>
          <div className="task-grid session-grid">
            {openSessions.map((session) => <SessionCard key={session.id} onOpen={() => selectSession(session.id)} session={session} />)}
          </div>
        </section>
      )}

      <section className="dashboard-section recent-section">
        <div className="section-heading"><h2>Committed sessions</h2></div>
        {completed.length === 0 ? (
          <div className="quiet-empty"><MessageSquarePlus size={18} /> Committed sessions will appear here.</div>
        ) : (
          <div className="recent-list">
            {completed.map((session) => (
              <button className="recent-row" key={session.id} onClick={() => selectSession(session.id)} type="button">
                <span className="recent-check"><Bot size={14} /></span>
                <span className="recent-title">{session.title}</span>
                <span>{session.changedFiles.length} files</span>
                <span>{formatRelativeTime(session.updatedAt)}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SessionCard({ session, onOpen }: { session: Session; onOpen(): void }) {
  const lastResponse = [...session.activity].reverse().find((entry) => entry.kind === 'thought')
  return (
    <button className="task-card session-card" onClick={onOpen} type="button">
      <div className="task-card-top">
        <StatusPill status={session.status} />
        <ArrowUpRight className="task-card-arrow" size={16} />
      </div>
      <h3>{session.title}</h3>
      <p>{lastResponse?.text ?? 'Connecting to the agent CLI…'}</p>
      <div className="task-card-footer session-card-footer">
        <span><Bot size={14} /> Codex</span>
        <span><GitBranch size={13} /> {session.branch}</span>
        <span className="task-time">{formatRelativeTime(session.updatedAt)}</span>
      </div>
    </button>
  )
}

function formatRelativeTime(value: string): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
