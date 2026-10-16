import * as React from 'react'
import classNames from 'classnames'

import {
  AIApprovalDecision,
  AISessionEvent,
  IAISessionCatalogEntry,
  IAISessionItem,
  IAISessionRuntimeInfo,
  IAISessionSnapshot,
} from '../../lib/ai-sessions/types'
import { AppFileStatus } from '../../models/status'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { aiSessionsClient, IAISessionsClient } from './client'
import {
  loadAISessionCatalog,
  removeAISessionCatalogEntry,
  upsertAISessionCatalogEntry,
} from './session-storage'

export interface IAISessionsWorkspaceProps {
  readonly repositoryName: string
  readonly repositoryPath: string
  readonly changedFiles: ReadonlyMap<string, AppFileStatus>
  readonly isActive: boolean
  readonly onRequestCode: () => void
  readonly onRequestReview: () => void
  readonly client?: IAISessionsClient
}

interface IAISessionsWorkspaceState {
  readonly runtime: IAISessionRuntimeInfo | null
  readonly catalog: ReadonlyArray<IAISessionCatalogEntry>
  readonly sessions: ReadonlyMap<string, IAISessionSnapshot>
  readonly selectedThreadId: string | null
  readonly composerText: string
  readonly selectedModel: string
  readonly isLoading: boolean
  readonly error: string | null
}

interface IAISessionTranscriptItemProps {
  readonly item: IAISessionItem
}

class AISessionTranscriptItem extends React.PureComponent<IAISessionTranscriptItemProps> {
  public render() {
    const { item } = this.props
    return (
      <article className={classNames('vivlio-session-item', item.kind)}>
        <header>
          <strong>
            {item.title ??
              (item.kind === 'user'
                ? 'You'
                : item.kind === 'assistant'
                ? 'Codex'
                : item.kind)}
          </strong>
          {item.status === undefined ? null : <span>{item.status}</span>}
        </header>
        {item.detail === undefined ? null : (
          <div className="vivlio-session-item-detail">{item.detail}</div>
        )}
        <div className="vivlio-session-item-text">{item.text}</div>
      </article>
    )
  }
}

function catalogEntryFromSnapshot(
  session: IAISessionSnapshot,
  repositoryName: string
): IAISessionCatalogEntry {
  return {
    threadId: session.threadId,
    provider: session.provider,
    repositoryPath: session.repositoryPath,
    repositoryName,
    title: session.title,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

function formatRelativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < 60000) {
    return 'now'
  }
  if (elapsed < 3600000) {
    return `${Math.floor(elapsed / 60000)}m`
  }
  if (elapsed < 86400000) {
    return `${Math.floor(elapsed / 3600000)}h`
  }
  return `${Math.floor(elapsed / 86400000)}d`
}

export class AISessionsWorkspace extends React.Component<
  IAISessionsWorkspaceProps,
  IAISessionsWorkspaceState
> {
  private unsubscribe: (() => void) | null = null
  private transcript = React.createRef<HTMLDivElement>()

  public constructor(props: IAISessionsWorkspaceProps) {
    super(props)
    const catalog = this.getRepositoryCatalog(props.repositoryPath)
    this.state = {
      runtime: null,
      catalog,
      sessions: new Map(),
      selectedThreadId: catalog[0]?.threadId ?? null,
      composerText: '',
      selectedModel: '',
      isLoading: true,
      error: null,
    }
  }

  private get client(): IAISessionsClient {
    return this.props.client ?? aiSessionsClient
  }

  public componentDidMount() {
    this.unsubscribe = this.client.subscribe(this.onSessionEvent)
    void this.loadWorkspace()
  }

  public componentDidUpdate(
    prevProps: IAISessionsWorkspaceProps,
    prevState: IAISessionsWorkspaceState
  ) {
    if (prevProps.repositoryPath !== this.props.repositoryPath) {
      const catalog = this.getRepositoryCatalog(this.props.repositoryPath)
      this.setState(
        {
          catalog,
          sessions: new Map(),
          selectedThreadId: catalog[0]?.threadId ?? null,
          composerText: '',
          isLoading: true,
          error: null,
        },
        () => void this.loadWorkspace()
      )
      return
    }

    const selected = this.selectedSession
    const previousSelected =
      prevState.selectedThreadId === null
        ? undefined
        : prevState.sessions.get(prevState.selectedThreadId)
    if (
      this.props.isActive &&
      (selected?.items.length !== previousSelected?.items.length ||
        selected?.items[selected.items.length - 1]?.text !==
          previousSelected?.items[previousSelected.items.length - 1]?.text)
    ) {
      this.scrollTranscriptToBottom()
    }
  }

  public componentWillUnmount() {
    this.unsubscribe?.()
  }

  private get selectedSession(): IAISessionSnapshot | undefined {
    return this.state.selectedThreadId === null
      ? undefined
      : this.state.sessions.get(this.state.selectedThreadId)
  }

  private getRepositoryCatalog(
    repositoryPath: string
  ): ReadonlyArray<IAISessionCatalogEntry> {
    return loadAISessionCatalog()
      .filter(entry => entry.repositoryPath === repositoryPath)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  private loadWorkspace = async () => {
    const selectedThreadId = this.state.selectedThreadId
    try {
      const runtime = await this.client.getRuntimeInfo()
      this.setState({
        runtime,
        selectedModel:
          this.state.selectedModel ||
          runtime.models.find(model => model.isDefault)?.id ||
          runtime.models[0]?.id ||
          '',
        isLoading: selectedThreadId !== null,
        error: runtime.error,
      })
      if (selectedThreadId !== null && runtime.available) {
        const session = await this.client.resumeSession({
          threadId: selectedThreadId,
          repositoryPath: this.props.repositoryPath,
        })
        this.acceptSession(session)
      }
    } catch (error) {
      this.setState({ error: String(error), isLoading: false })
    } finally {
      this.setState({ isLoading: false })
    }
  }

  private onSessionEvent = (event: AISessionEvent) => {
    if (event.type === 'runtime-changed') {
      this.setState({ runtime: event.runtime })
    } else if (event.session.repositoryPath === this.props.repositoryPath) {
      this.acceptSession(event.session)
    }
  }

  private acceptSession(session: IAISessionSnapshot) {
    const entry = catalogEntryFromSnapshot(session, this.props.repositoryName)
    const existing = this.state.catalog.find(
      item => item.threadId === session.threadId
    )
    const shouldPersist =
      existing === undefined ||
      existing.title !== entry.title ||
      existing.model !== entry.model ||
      (session.status !== 'running' &&
        session.status !== 'waiting-for-approval')
    const catalog = (
      shouldPersist
        ? upsertAISessionCatalogEntry(entry).filter(
            item => item.repositoryPath === this.props.repositoryPath
          )
        : [
            entry,
            ...this.state.catalog.filter(
              item => item.threadId !== session.threadId
            ),
          ]
    ).sort((a, b) => b.updatedAt - a.updatedAt)
    this.setState(state => {
      const sessions = new Map(state.sessions)
      sessions.set(session.threadId, session)
      return { sessions, catalog, isLoading: false, error: session.error }
    })
  }

  private onNewSession = async () => {
    this.setState({ isLoading: true, error: null })
    try {
      const session = await this.client.startSession({
        repositoryPath: this.props.repositoryPath,
        title: `Work on ${this.props.repositoryName}`,
        model: this.state.selectedModel || undefined,
      })
      this.setState({ selectedThreadId: session.threadId, composerText: '' })
      this.acceptSession(session)
    } catch (error) {
      this.setState({ error: String(error), isLoading: false })
    }
  }

  private onSelectSession = (event: React.MouseEvent<HTMLButtonElement>) => {
    const threadId = event.currentTarget.dataset.threadId
    if (threadId === undefined || threadId === this.state.selectedThreadId) {
      return
    }
    this.setState({ selectedThreadId: threadId, isLoading: true, error: null })
    void this.client
      .resumeSession({ threadId, repositoryPath: this.props.repositoryPath })
      .then(session => this.acceptSession(session))
      .catch(error => this.setState({ error: String(error), isLoading: false }))
  }

  private onComposerChanged = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    this.setState({ composerText: event.currentTarget.value })
  }

  private onComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void this.onSendMessage()
    }
  }

  private onModelChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ selectedModel: event.currentTarget.value })
  }

  private onSendMessage = async () => {
    let session = this.selectedSession
    if (session === undefined) {
      await this.onNewSession()
      session = this.selectedSession
    }
    const text = this.state.composerText.trim()
    if (session === undefined || text.length === 0) {
      return
    }
    this.setState({ composerText: '', error: null })
    try {
      const updated = await this.client.sendMessage({
        threadId: session.threadId,
        repositoryPath: this.props.repositoryPath,
        text,
      })
      this.acceptSession(updated)
    } catch (error) {
      this.setState({ composerText: text, error: String(error) })
    }
  }

  private onInterrupt = async () => {
    const session = this.selectedSession
    if (session === undefined) {
      return
    }
    try {
      this.acceptSession(await this.client.interruptSession(session.threadId))
    } catch (error) {
      this.setState({ error: String(error) })
    }
  }

  private onApproval = (event: React.MouseEvent<HTMLButtonElement>) => {
    const session = this.selectedSession
    const requestId = event.currentTarget.dataset.requestId
    const decision = event.currentTarget.dataset.decision as
      | AIApprovalDecision
      | undefined
    if (
      session === undefined ||
      requestId === undefined ||
      decision === undefined
    ) {
      return
    }
    void this.client
      .respondToApproval(session.threadId, requestId, decision)
      .then(updated => this.acceptSession(updated))
      .catch(error => this.setState({ error: String(error) }))
  }

  private onRename = async () => {
    const session = this.selectedSession
    if (session === undefined) {
      return
    }
    const title = window.prompt('Session name', session.title)?.trim()
    if (title === undefined || title.length === 0 || title === session.title) {
      return
    }
    try {
      this.acceptSession(
        await this.client.renameSession(session.threadId, title)
      )
    } catch (error) {
      this.setState({ error: String(error) })
    }
  }

  private onArchive = async () => {
    const session = this.selectedSession
    if (
      session === undefined ||
      !window.confirm(
        `Archive “${session.title}”? You can still find it in Codex.`
      )
    ) {
      return
    }
    try {
      await this.client.archiveSession(session.threadId)
      removeAISessionCatalogEntry(session.threadId)
      const catalog = this.getRepositoryCatalog(this.props.repositoryPath)
      this.setState(state => {
        const sessions = new Map(state.sessions)
        sessions.delete(session.threadId)
        return {
          catalog,
          sessions,
          selectedThreadId: catalog[0]?.threadId ?? null,
        }
      })
    } catch (error) {
      this.setState({ error: String(error) })
    }
  }

  private scrollTranscriptToBottom() {
    const transcript = this.transcript.current
    if (transcript !== null) {
      transcript.scrollTop = transcript.scrollHeight
    }
  }

  private renderSidebar() {
    const runtime = this.state.runtime
    return (
      <aside className="vivlio-sessions-sidebar">
        <header>
          <div>
            <strong>Sessions</strong>
            <span>{this.props.repositoryName}</span>
          </div>
          <button
            type="button"
            aria-label="New Codex session"
            disabled={runtime?.available !== true || this.state.isLoading}
            onClick={this.onNewSession}
          >
            <Octicon symbol={octicons.plus} />
          </button>
        </header>
        <div className="vivlio-provider-status">
          <span className={classNames('dot', { ready: runtime?.available })} />
          <div>
            <strong>Codex</strong>
            <span>
              {runtime === null
                ? 'Checking…'
                : runtime.available
                ? runtime.accountLabel ?? 'Ready'
                : 'Not installed'}
            </span>
          </div>
        </div>
        <div className="vivlio-provider-status unavailable">
          <span className="dot" />
          <div>
            <strong>Claude Code</strong>
            <span>Coming next</span>
          </div>
        </div>
        {runtime === null || runtime.models.length === 0 ? null : (
          <label className="vivlio-session-model-picker">
            <span>Model for new sessions</span>
            <select
              value={this.state.selectedModel}
              onChange={this.onModelChanged}
            >
              {runtime.models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="vivlio-session-list">
          {this.state.catalog.map(entry => {
            const live = this.state.sessions.get(entry.threadId)
            const status = live?.status ?? 'idle'
            return (
              <button
                type="button"
                key={entry.threadId}
                data-thread-id={entry.threadId}
                className={classNames('vivlio-session-list-item', {
                  selected: entry.threadId === this.state.selectedThreadId,
                })}
                onClick={this.onSelectSession}
              >
                <span className={classNames('status-dot', status)} />
                <span className="details">
                  <strong>{live?.title ?? entry.title}</strong>
                  <span>
                    Codex ·{' '}
                    {formatRelativeTime(live?.updatedAt ?? entry.updatedAt)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  private renderEmptyState() {
    const runtime = this.state.runtime
    return (
      <div className="vivlio-sessions-empty">
        <Octicon symbol={octicons.commentDiscussion} />
        <h1>Work with Codex, then review the code</h1>
        <p>
          Sessions stay attached to this repository. Commands and file changes
          remain visible, and elevated actions wait for your approval.
        </p>
        {runtime?.error === null || runtime?.error === undefined ? null : (
          <p className="error">{runtime.error}</p>
        )}
        <button
          type="button"
          className="primary"
          disabled={runtime?.available !== true || this.state.isLoading}
          onClick={this.onNewSession}
        >
          <Octicon symbol={octicons.plus} /> New Codex session
        </button>
      </div>
    )
  }

  private renderSession(session: IAISessionSnapshot) {
    const isRunning =
      session.status === 'running' || session.status === 'waiting-for-approval'
    return (
      <section className="vivlio-session-main">
        <header className="vivlio-session-header">
          <div>
            <div className="title-row">
              <h1>{session.title}</h1>
              <button
                type="button"
                aria-label="Rename session"
                onClick={this.onRename}
              >
                <Octicon symbol={octicons.pencil} />
              </button>
            </div>
            <span>
              Codex · {session.model ?? 'default model'} · {session.status}
            </span>
          </div>
          <div className="actions">
            <button type="button" onClick={this.props.onRequestCode}>
              <Octicon symbol={octicons.code} /> Code
            </button>
            <button type="button" onClick={this.props.onRequestReview}>
              <Octicon symbol={octicons.fileDiff} /> Review{' '}
              {this.props.changedFiles.size === 0
                ? ''
                : `(${this.props.changedFiles.size})`}
            </button>
            <button
              type="button"
              aria-label="Archive session"
              onClick={this.onArchive}
            >
              <Octicon symbol={octicons.archive} />
            </button>
          </div>
        </header>
        <div className="vivlio-session-transcript" ref={this.transcript}>
          {session.items.length === 0 ? (
            <div className="vivlio-session-first-prompt">
              <h2>What should Codex help you understand or change?</h2>
              <p>
                Ask for a plan, an explanation, or an implementation. Vivlio
                keeps the work next to the code and review surfaces.
              </p>
            </div>
          ) : (
            session.items.map(item => (
              <AISessionTranscriptItem key={item.id} item={item} />
            ))
          )}
          {session.approvals.map(approval => (
            <article
              className="vivlio-session-approval"
              key={String(approval.requestId)}
            >
              <header>
                <Octicon symbol={octicons.shield} />
                <strong>{approval.title}</strong>
              </header>
              {approval.reason === undefined ? null : <p>{approval.reason}</p>}
              <pre>{approval.detail}</pre>
              {approval.cwd === undefined ? null : <code>{approval.cwd}</code>}
              <div className="actions">
                <button
                  type="button"
                  data-request-id={String(approval.requestId)}
                  data-decision="decline"
                  onClick={this.onApproval}
                >
                  Deny
                </button>
                <button
                  type="button"
                  data-request-id={String(approval.requestId)}
                  data-decision="acceptForSession"
                  onClick={this.onApproval}
                >
                  Allow for session
                </button>
                <button
                  type="button"
                  className="primary"
                  data-request-id={String(approval.requestId)}
                  data-decision="accept"
                  onClick={this.onApproval}
                >
                  Allow once
                </button>
              </div>
            </article>
          ))}
        </div>
        {this.state.error === null ? null : (
          <div className="vivlio-session-error" role="alert">
            {this.state.error}
          </div>
        )}
        <div className="vivlio-session-composer">
          <textarea
            value={this.state.composerText}
            placeholder="Ask Codex about this repository…"
            aria-label="Message Codex"
            rows={3}
            disabled={isRunning}
            onChange={this.onComposerChanged}
            onKeyDown={this.onComposerKeyDown}
          />
          <footer>
            <span>⌘↵ to send · current checkout</span>
            {isRunning ? (
              <button type="button" onClick={this.onInterrupt}>
                <Octicon symbol={octicons.stop} /> Stop
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={this.state.composerText.trim().length === 0}
                onClick={this.onSendMessage}
              >
                Send <Octicon symbol={octicons.play} />
              </button>
            )}
          </footer>
        </div>
      </section>
    )
  }

  public render() {
    const session = this.selectedSession
    return (
      <main className="vivlio-sessions-workspace">
        {this.renderSidebar()}
        <div className="vivlio-sessions-content">
          {session === undefined
            ? this.renderEmptyState()
            : this.renderSession(session)}
        </div>
      </main>
    )
  }
}
