import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
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

export function SessionDetail({ session }: { session: Session }) {
  const selectSession = useAppStore((state) => state.selectSession)
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
    <div className="session-chat">
      <header className="session-chat-header">
        <button aria-label="Back to sessions" className="session-chat-back" onClick={() => selectSession(null)} type="button"><ArrowLeft size={17} /></button>
        <div className="session-chat-title">
          <h1>{session.title}</h1>
          <div className="session-chat-meta">
            <StatusPill status={session.status} />
            <span><GitBranch size={11} />{session.branch}</span>
            <span><Bot size={11} />Codex</span>
          </div>
        </div>
        <div className="session-chat-actions">
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
          {session.status === 'completed' ? <span className="commit-badge"><GitCommitHorizontal size={15} />{session.commit}</span> : null}
        </div>
      </header>

      {error || session.error ? <div className="task-error"><AlertCircle size={16} /><span>{error ?? session.error}</span></div> : null}

      <Conversation activity={session.activity} verification={session.verification} />

      {session.status !== 'completed' ? (
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

function Conversation({ activity, verification }: { activity: SessionActivity[]; verification: VerificationResult[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [activity.length])

  return (
    <div className="conversation-view">
      <div className="conversation-stream">
        {activity.length === 0 ? <p className="panel-empty">Waiting for the session to begin…</p> : null}
        {activity.map((entry) => <ConversationEntry entry={entry} key={entry.id} />)}
        {verification.length > 0 ? <VerificationSummary results={verification} /> : null}
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
          <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
        </div>
        <p>{entry.text}</p>
      </article>
    )
  }

  if (entry.kind === 'command' || entry.kind === 'output') {
    return (
      <details className="conversation-tool" open={entry.kind === 'command'}>
        <summary><TerminalSquare size={13} /><span>{entry.kind === 'command' ? 'Command' : 'Output'}</span><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time><ChevronDown size={13} /></summary>
        <pre>{entry.text}</pre>
      </details>
    )
  }

  return (
    <div className={`conversation-event event-${entry.kind}`}>
      {entry.kind === 'error' ? <AlertCircle size={13} /> : <Check size={13} />}
      <span>{entry.text}</span><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
    </div>
  )
}

function VerificationSummary({ results }: { results: VerificationResult[] }) {
  const passed = results.filter((result) => result.status === 'passed').length
  return (
    <details className="chat-verification" open={results.some((result) => result.status === 'failed')}>
      <summary>
        {passed === results.length ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        <span>Checks</span>
        <small>{passed} of {results.length} passed</small>
        <ChevronDown size={13} />
      </summary>
      <div className="chat-verification-results">
        {results.map((result) => <VerificationRow key={result.id} result={result} />)}
      </div>
    </details>
  )
}

function VerificationRow({ result }: { result: VerificationResult }) {
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : Circle
  return (
    <div className={`chat-verification-row verify-${result.status}`}>
      <Icon size={13} />
      <code>{result.command}</code>
      {result.durationMs ? <span>{(result.durationMs / 1000).toFixed(1)}s</span> : null}
      {result.output ? (
        <details>
          <summary aria-label={`Show output for ${result.command}`}><ChevronDown size={12} /></summary>
          <pre>{result.output}</pre>
        </details>
      ) : null}
    </div>
  )
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
