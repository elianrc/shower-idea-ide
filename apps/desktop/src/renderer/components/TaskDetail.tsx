import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  Play,
  Send,
  Square,
  TerminalSquare,
  UserRound,
  XCircle,
} from 'lucide-react'
import type { Session, SessionActivity, VerificationResult } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

type DetailTab = 'conversation' | 'checks'

export function SessionDetail({ session }: { session: Session }) {
  const selectSession = useAppStore((state) => state.selectSession)
  const [tab, setTab] = useState<DetailTab>('conversation')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRunning = ['starting', 'running', 'verifying'].includes(session.status)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    const value = message.trim()
    if (!value || isRunning) return
    setMessage('')
    await run(() => window.vivlio.sessions.sendMessage(session.id, value))
  }

  return (
    <div className="task-detail session-detail">
      <header className="task-detail-header session-detail-header">
        <button aria-label="Back to sessions" className="icon-button" onClick={() => selectSession(null)} type="button"><ArrowLeft size={18} /></button>
        <div className="task-title-block">
          <h1>{session.title}</h1>
          <div className="task-meta">
            <StatusPill status={session.status} />
            <span><Bot size={13} />Codex</span>
            <span><GitBranch size={13} />{session.branch}</span>
            <span>{session.workspaceMode === 'worktree' ? 'Isolated worktree' : 'Current branch'}</span>
          </div>
        </div>
        <div className="task-actions">
          {isRunning ? (
            <button className="secondary-button danger" disabled={busy} onClick={() => void run(() => window.vivlio.sessions.stop(session.id))} type="button">
              <Square size={13} /> Stop
            </button>
          ) : null}
          {!isRunning && session.status !== 'completed' ? (
            <button className="secondary-button" disabled={busy} onClick={() => void run(() => window.vivlio.sessions.runVerification(session.id))} type="button">
              <Play size={14} /> Run checks
            </button>
          ) : null}
          {!isRunning && session.status !== 'completed' && session.changedFiles.length > 0 ? (
            <button className="primary-button" disabled={busy} onClick={() => void run(() => window.vivlio.sessions.commit(session.id))} type="button">
              <GitCommitHorizontal size={15} /> Commit changes
            </button>
          ) : null}
          {session.status === 'completed' ? <span className="commit-badge"><GitCommitHorizontal size={15} />{session.commit}</span> : null}
        </div>
      </header>

      <nav aria-label="Session detail" className="detail-tabs">
        {(['conversation', 'checks'] as const).map((item) => (
          <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)} type="button">
            {item === 'conversation' ? 'Conversation' : 'Checks'}
          </button>
        ))}
      </nav>

      {error || session.error ? <div className="task-error"><AlertCircle size={16} /><span>{error ?? session.error}</span></div> : null}

      <div className={`detail-content detail-${tab}`}>
        {tab === 'conversation' ? <Conversation activity={session.activity} /> : null}
        {tab === 'checks' ? <ChecksView session={session} /> : null}
      </div>

      {tab === 'conversation' && session.status !== 'completed' ? (
        <div className="session-composer">
          <textarea
            aria-label="Message Codex"
            disabled={isRunning || busy}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void sendMessage()
            }}
            placeholder={isRunning ? 'Codex is working…' : 'Message Codex…'}
            rows={2}
            value={message}
          />
          <div className="composer-footer">
            <span>{isRunning ? 'Stop the current turn to send another message' : '⌘ Enter to send'}</span>
            <button aria-label="Send message" className="send-button" disabled={!message.trim() || isRunning || busy} onClick={() => void sendMessage()} type="button"><Send size={15} /></button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Conversation({ activity }: { activity: SessionActivity[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [activity.length])

  return (
    <div className="conversation-view">
      <div className="conversation-stream">
        {activity.length === 0 ? <p className="panel-empty">Waiting for the session to begin…</p> : null}
        {activity.map((entry) => <ConversationEntry entry={entry} key={entry.id} />)}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function ConversationEntry({ entry }: { entry: SessionActivity }) {
  if (entry.kind === 'message' || entry.kind === 'thought') {
    const isUser = entry.kind === 'message'
    return (
      <article className={isUser ? 'conversation-message user-message' : 'conversation-message agent-message'}>
        <div className="message-author">
          {isUser ? <UserRound size={14} /> : <Bot size={14} />}
          <strong>{isUser ? 'You' : 'Codex'}</strong>
          <time>{formatTime(entry.createdAt)}</time>
        </div>
        <p>{entry.text}</p>
      </article>
    )
  }

  if (entry.kind === 'command' || entry.kind === 'output') {
    return (
      <details className="conversation-tool" open={entry.kind === 'command'}>
        <summary><TerminalSquare size={13} /><span>{entry.kind === 'command' ? 'Command' : 'Output'}</span><time>{formatTime(entry.createdAt)}</time><ChevronDown size={13} /></summary>
        <pre>{entry.text}</pre>
      </details>
    )
  }

  return (
    <div className={`conversation-event event-${entry.kind}`}>
      {entry.kind === 'error' ? <AlertCircle size={13} /> : <Check size={13} />}
      <span>{entry.text}</span><time>{formatTime(entry.createdAt)}</time>
    </div>
  )
}

function ChecksView({ session }: { session: Session }) {
  const additions = session.changedFiles.reduce((sum, file) => sum + file.additions, 0)
  const deletions = session.changedFiles.reduce((sum, file) => sum + file.deletions, 0)
  return (
    <div className="review-overview checks-view">
      <section className="review-hero">
        <p className="eyebrow">Session workspace</p>
        <h2>{session.summary || 'Changes and checks stay attached to this conversation.'}</h2>
        <div className="change-totals">
          <span><FileCode2 size={15} /> {session.changedFiles.length} changed {session.changedFiles.length === 1 ? 'file' : 'files'}</span>
          <span className="diff-add">+{additions}</span>
          <span className="diff-remove">−{deletions}</span>
        </div>
      </section>
      <div className="review-columns">
        <section className="review-panel">
          <div className="panel-heading"><h3>Files changed</h3><span>{session.changedFiles.length}</span></div>
          {session.changedFiles.length === 0 ? <p className="panel-empty">No files have changed in this session.</p> : (
            <div className="file-list">
              {session.changedFiles.map((file) => (
                <div className="file-row" key={file.path}>
                  <span className={`file-status file-${file.status}`}>{file.status.slice(0, 1).toUpperCase()}</span>
                  <span className="file-path">{file.path}</span><span className="diff-add">+{file.additions}</span><span className="diff-remove">−{file.deletions}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="review-panel">
          <div className="panel-heading"><h3>Checks</h3><span>{session.verification.length}</span></div>
          {session.verification.length === 0 ? <p className="panel-empty">Run checks when you want validation.</p> : (
            <div className="verification-list">{session.verification.map((result) => <VerificationRow key={result.id} result={result} />)}</div>
          )}
        </section>
      </div>
    </div>
  )
}

function VerificationRow({ result }: { result: VerificationResult }) {
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : Circle
  return (
    <details className={`verification-row verify-${result.status}`}>
      <summary><Icon size={15} /><code>{result.command}</code>{result.durationMs ? <span>{(result.durationMs / 1000).toFixed(1)}s</span> : null}{result.output ? <ChevronDown size={13} /> : null}</summary>
      {result.output ? <pre>{result.output}</pre> : null}
    </details>
  )
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
