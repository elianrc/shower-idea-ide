import { lazy, Suspense, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  MessageSquareText,
  Play,
  Send,
  Square,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import type { Task, VerificationResult } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

const DiffViewer = lazy(() => import('./DiffViewer'))
type DetailTab = 'overview' | 'activity' | 'changes'

export function TaskDetail({ task }: { task: Task }) {
  const selectTask = useAppStore((state) => state.selectTask)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const additions = task.changedFiles.reduce((sum, file) => sum + file.additions, 0)
  const deletions = task.changedFiles.reduce((sum, file) => sum + file.deletions, 0)
  const isRunning = ['planning', 'working', 'verifying', 'changes_requested'].includes(task.status)
  const canReview = task.status === 'ready_for_review' || task.status === 'failed' || task.status === 'committed'

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
    if (!value) return
    await run(() => window.vivlio.tasks.sendMessage(task.id, value))
    setMessage('')
    setTab('activity')
  }

  return (
    <div className="task-detail">
      <header className="task-detail-header">
        <button aria-label="Back to tasks" className="icon-button" onClick={() => selectTask(null)} type="button"><ArrowLeft size={18} /></button>
        <div className="task-title-block">
          <h1>{task.title}</h1>
          <div className="task-meta"><StatusPill status={task.status} /><span><GitBranch size={13} />{task.branch}</span></div>
        </div>
        <div className="task-actions">
          {isRunning ? (
            <button className="secondary-button danger" disabled={busy} onClick={() => void run(() => window.vivlio.tasks.cancel(task.id))} type="button">
              <Square size={13} /> Stop
            </button>
          ) : null}
          {canReview && task.status !== 'committed' ? (
            <button className="secondary-button" disabled={busy} onClick={() => void run(() => window.vivlio.tasks.runVerification(task.id))} type="button">
              <Play size={14} /> Verify again
            </button>
          ) : null}
          {task.status === 'ready_for_review' ? (
            <button className="primary-button" disabled={busy || task.changedFiles.length === 0} onClick={() => void run(() => window.vivlio.tasks.approve(task.id))} type="button">
              <Check size={15} /> Approve & commit
            </button>
          ) : null}
          {task.status === 'committed' ? <span className="commit-badge"><GitCommitHorizontal size={15} />{task.commit}</span> : null}
        </div>
      </header>

      <nav aria-label="Task detail" className="detail-tabs">
        {(['overview', 'activity', 'changes'] as const).map((item) => (
          <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)} type="button">
            {item === 'overview' ? 'Review' : item === 'activity' ? 'Activity' : `Changes ${task.changedFiles.length ? `(${task.changedFiles.length})` : ''}`}
          </button>
        ))}
      </nav>

      {error || task.error ? <div className="task-error"><AlertCircle size={16} /><span>{error ?? task.error}</span></div> : null}

      <div className={`detail-content detail-${tab}`}>
        {tab === 'overview' ? <ReviewOverview additions={additions} deletions={deletions} task={task} /> : null}
        {tab === 'activity' ? <ActivityView task={task} /> : null}
        {tab === 'changes' ? (
          <ChangesView task={task} />
        ) : null}
      </div>

      {!isRunning && task.status !== 'committed' && task.status !== 'cancelled' ? (
        <div className="follow-up-bar">
          <MessageSquareText size={17} />
          <input
            aria-label="Ask about changes or request a correction"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage() }}
            placeholder="Ask about the changes or request a correction…"
            value={message}
          />
          <button aria-label="Send" className="send-button" disabled={!message.trim() || busy} onClick={() => void sendMessage()} type="button"><Send size={15} /></button>
        </div>
      ) : null}
    </div>
  )
}

function ReviewOverview({ task, additions, deletions }: { task: Task; additions: number; deletions: number }) {
  return (
    <div className="review-overview">
      <section className="review-hero">
        <p className="eyebrow">Implementation summary</p>
        <h2>{task.summary || liveSummary(task)}</h2>
        <p className="original-request">“{task.prompt.split('\n\nFollow-up request:')[0]}”</p>
        <div className="change-totals">
          <span><FileCode2 size={15} /> {task.changedFiles.length} changed {task.changedFiles.length === 1 ? 'file' : 'files'}</span>
          <span className="diff-add">+{additions}</span>
          <span className="diff-remove">−{deletions}</span>
        </div>
      </section>

      <div className="review-columns">
        <section className="review-panel">
          <div className="panel-heading"><h3>Files changed</h3><span>{task.changedFiles.length}</span></div>
          {task.changedFiles.length === 0 ? <p className="panel-empty">Changes will appear as the agent works.</p> : (
            <div className="file-list">
              {task.changedFiles.map((file) => (
                <div className="file-row" key={file.path}>
                  <span className={`file-status file-${file.status}`}>{file.status.slice(0, 1).toUpperCase()}</span>
                  <span className="file-path">{file.path}</span>
                  <span className="diff-add">+{file.additions}</span>
                  <span className="diff-remove">−{file.deletions}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="review-panel">
          <div className="panel-heading"><h3>Verification</h3><span>{task.verification.length}</span></div>
          {task.verification.length === 0 ? <p className="panel-empty">No project checks were detected.</p> : (
            <div className="verification-list">
              {task.verification.map((result) => <VerificationRow key={result.id} result={result} />)}
            </div>
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
      <summary>
        <Icon size={15} />
        <code>{result.command}</code>
        {result.durationMs ? <span>{(result.durationMs / 1000).toFixed(1)}s</span> : null}
        {result.output ? <ChevronDown size={13} /> : null}
      </summary>
      {result.output ? <pre>{result.output}</pre> : null}
    </details>
  )
}

function ActivityView({ task }: { task: Task }) {
  return (
    <div className="activity-view">
      <div className="activity-heading">
        <div><p className="eyebrow">Agent session</p><h2>Meaningful progress, as it happens.</h2></div>
        <span>{task.activity.length} events</span>
      </div>
      <div className="activity-stream">
        {task.activity.length === 0 ? <p className="panel-empty">Waiting for the agent to begin…</p> : null}
        {task.activity.map((entry, index) => (
          <div className={`activity-entry activity-${entry.kind}`} key={entry.id}>
            <span className="activity-rail"><span />{index < task.activity.length - 1 ? <i /> : null}</span>
            <div className="activity-body">
              <div className="activity-meta">
                {entry.kind === 'command' ? <TerminalSquare size={13} /> : entry.kind === 'error' ? <AlertCircle size={13} /> : <Check size={13} />}
                <span>{entry.kind}</span>
                <time>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              <p>{entry.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangesView({ task }: { task: Task }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="changes-layout">
      <aside className="changed-files-pane">
        <div className="changed-files-heading">Changed files <span>{task.changedFiles.length}</span></div>
        <button className={!selected ? 'changed-file active' : 'changed-file'} onClick={() => setSelected(null)} type="button">
          <FileCode2 size={14} /><span>All changes</span>
        </button>
        {task.changedFiles.map((file) => (
          <button className={selected === file.path ? 'changed-file active' : 'changed-file'} key={file.path} onClick={() => setSelected(file.path)} type="button">
            <span className={`file-status file-${file.status}`}>{file.status.slice(0, 1).toUpperCase()}</span>
            <span>{file.path}</span>
          </button>
        ))}
      </aside>
      <section className="raw-diff-pane">
        <Suspense fallback={<div className="loading-row">Loading code viewer…</div>}>
          <DiffViewer filePath={selected ?? undefined} taskId={task.id} />
        </Suspense>
      </section>
    </div>
  )
}

function liveSummary(task: Task): string {
  if (task.status === 'working') return 'The agent is implementing your request.'
  if (task.status === 'verifying') return 'Implementation complete. Verification is running.'
  if (task.status === 'failed') return 'The task needs your attention before it can continue.'
  return 'Preparing an isolated workspace for this task.'
}
