import { useEffect, useState } from 'react'
import {
  GitBranch,
  Mail,
  MailOpen,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Project, Session } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

export function Dashboard({ project, sessions }: { project: Project; sessions: Session[] }) {
  const selectSession = useAppStore((state) => state.selectSession)
  const setNewSessionOpen = useAppStore((state) => state.setNewSessionOpen)
  const renameSession = useAppStore((state) => state.renameSession)
  const deleteSession = useAppStore((state) => state.deleteSession)
  const setSessionPinned = useAppStore((state) => state.setSessionPinned)
  const setSessionUnread = useAppStore((state) => state.setSessionUnread)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingSession, setRenamingSession] = useState<Session | null>(null)
  const [deletingSession, setDeletingSession] = useState<Session | null>(null)
  const orderedSessions = [...sessions].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  useEffect(() => {
    if (!openMenuId) return
    const closeMenu = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('[data-session-actions]')) setOpenMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenuId])

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
              <SessionRow
                isMenuOpen={openMenuId === session.id}
                key={session.id}
                onDelete={() => { setOpenMenuId(null); setDeletingSession(session) }}
                onMenu={() => setOpenMenuId((current) => current === session.id ? null : session.id)}
                onOpen={() => selectSession(session.id)}
                onPin={() => { setOpenMenuId(null); void setSessionPinned(session.id, !session.isPinned) }}
                onRename={() => { setOpenMenuId(null); setRenamingSession(session) }}
                onUnread={() => { setOpenMenuId(null); void setSessionUnread(session.id, !session.isUnread) }}
                session={session}
              />
            ))}
          </div>
        )}
      </section>

      {renamingSession ? (
        <RenameSessionDialog
          onCancel={() => setRenamingSession(null)}
          onRename={async (title) => {
            const renamed = await renameSession(renamingSession.id, title)
            if (renamed) setRenamingSession(null)
          }}
          session={renamingSession}
        />
      ) : null}
      {deletingSession ? (
        <DeleteSessionDialog
          onCancel={() => setDeletingSession(null)}
          onDelete={async () => {
            const deleted = await deleteSession(deletingSession.id)
            if (deleted) setDeletingSession(null)
          }}
          session={deletingSession}
        />
      ) : null}
    </div>
  )
}

function SessionRow({
  isMenuOpen,
  onDelete,
  onMenu,
  onOpen,
  onPin,
  onRename,
  onUnread,
  session,
}: {
  isMenuOpen: boolean
  onDelete(): void
  onMenu(): void
  onOpen(): void
  onPin(): void
  onRename(): void
  onUnread(): void
  session: Session
}) {
  const lastResponse = [...session.activity].reverse().find((entry) => entry.kind === 'thought')
  return (
    <div className={session.isUnread ? 'repository-session-row-wrap unread' : 'repository-session-row-wrap'}>
      <button className="repository-session-row" onClick={onOpen} type="button">
        <span className="repository-session-icon">
          <MessageCircle aria-hidden="true" size={16} />
          {session.isUnread ? <i aria-label="Unread session" /> : null}
        </span>
        <span className="repository-session-copy">
          <strong>{session.title}{session.isPinned ? <Pin aria-label="Pinned session" size={11} /> : null}</strong>
          <small>{lastResponse?.text ?? session.summary ?? session.initialPrompt}</small>
        </span>
        <span className="repository-session-meta">
          <StatusPill status={session.status} />
          <span><GitBranch size={11} />{session.branch}</span>
          <time dateTime={session.updatedAt}>{formatRelativeTime(session.updatedAt)}</time>
        </span>
      </button>
      <div className="session-actions" data-session-actions>
        <button aria-expanded={isMenuOpen} aria-haspopup="menu" aria-label={`Actions for ${session.title}`} className="session-actions-trigger" onClick={onMenu} type="button">
          <MoreHorizontal size={16} />
        </button>
        {isMenuOpen ? (
          <div className="session-actions-menu" role="menu">
            <button onClick={onRename} role="menuitem" type="button"><Pencil size={13} />Rename</button>
            <button onClick={onPin} role="menuitem" type="button">{session.isPinned ? <PinOff size={13} /> : <Pin size={13} />}{session.isPinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={onUnread} role="menuitem" type="button">{session.isUnread ? <MailOpen size={13} /> : <Mail size={13} />}{session.isUnread ? 'Mark as read' : 'Mark as unread'}</button>
            <button className="danger" onClick={onDelete} role="menuitem" type="button"><Trash2 size={13} />Delete session</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function RenameSessionDialog({ session, onCancel, onRename }: { session: Session; onCancel(): void; onRename(title: string): Promise<void> }) {
  const [title, setTitle] = useState(session.title)
  const [isSaving, setSaving] = useState(false)
  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onRename(title)
    setSaving(false)
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="session-dialog" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <h2>Rename session</h2>
        <label><span>Session title</span><input autoFocus maxLength={120} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <div className="session-dialog-actions">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">Cancel</button>
          <button className="primary-button" disabled={isSaving || !title.trim()} type="submit">Rename</button>
        </div>
      </form>
    </div>
  )
}

function DeleteSessionDialog({ session, onCancel, onDelete }: { session: Session; onCancel(): void; onDelete(): Promise<void> }) {
  const [isDeleting, setDeleting] = useState(false)
  const remove = async () => {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="delete-session-title" aria-modal="true" className="session-dialog" role="dialog">
        <h2 id="delete-session-title">Delete “{session.title}”?</h2>
        <p>{session.workspaceMode === 'worktree'
          ? 'This removes the chat and its isolated worktree, including any uncommitted changes. The Git branch is kept.'
          : 'This removes the chat history from Vivlio. Files in the current branch are not deleted.'}</p>
        <div className="session-dialog-actions">
          <button className="secondary-button" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button>
          <button className="danger-button" disabled={isDeleting} onClick={() => void remove()} type="button">Delete session</button>
        </div>
      </div>
    </div>
  )
}

function formatRelativeTime(value: string): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
