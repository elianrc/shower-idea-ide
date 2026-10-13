import { ArrowRight, GitBranch, MessageCircle, MessageSquarePlus, Plus } from 'lucide-react'
import type { Project, Session } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

export function Dashboard({ project, sessions }: { project: Project; sessions: Session[] }) {
  const selectSession = useAppStore((state) => state.selectSession)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const orderedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <div className="repository-sessions">
      <header className="repository-sessions-header">
        <div className="repository-sessions-title">
          <h1>{project.name}</h1>
          <span><GitBranch size={12} />{project.branch}</span>
        </div>
        <button className="new-chat-button" onClick={() => setNewSessionOpen(true)} type="button">
          <Plus size={15} /> New session
        </button>
      </header>

      <section className="repository-session-list" aria-labelledby="repository-sessions-heading">
        <div className="repository-session-list-heading">
          <h2 id="repository-sessions-heading">Sessions</h2>
          <span>{orderedSessions.length}</span>
        </div>
        {orderedSessions.length === 0 ? (
          <div className="repository-sessions-empty">
            <MessageSquarePlus size={22} />
            <h2>No sessions yet</h2>
            <p>Start a conversation with Codex for this repository.</p>
            <button className="secondary-button" onClick={() => setNewSessionOpen(true)} type="button">
              Start a session
            </button>
          </div>
        ) : (
          <div className="repository-session-rows">
            {orderedSessions.map((session) => (
              <SessionRow key={session.id} onOpen={() => selectSession(session.id)} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SessionRow({ session, onOpen }: { session: Session; onOpen(): void }) {
  const lastResponse = [...session.activity].reverse().find((entry) => entry.kind === 'thought')
  return (
    <button className="repository-session-row" onClick={onOpen} type="button">
      <MessageCircle aria-hidden="true" size={16} />
      <span className="repository-session-copy">
        <strong>{session.title}</strong>
        <small>{lastResponse?.text ?? session.summary ?? session.initialPrompt}</small>
      </span>
      <span className="repository-session-meta">
        <StatusPill status={session.status} />
        <span><GitBranch size={11} />{session.branch}</span>
        <time dateTime={session.updatedAt}>{formatRelativeTime(session.updatedAt)}</time>
      </span>
      <ArrowRight aria-hidden="true" size={15} />
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
