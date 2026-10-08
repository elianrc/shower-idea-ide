import { useEffect, useRef, useState } from 'react'
import { Bot, Box, ChevronDown, Command, FolderGit2, Sparkles, X } from 'lucide-react'
import type { CreateSessionInput, Session, WorkspaceMode } from '../../shared/types'
import { useAppStore } from '../store'

const suggestions = [
  'Explore this codebase and explain its architecture',
  'Fix a bug on the current branch',
  'Implement a product improvement',
]

export function NewSessionModal() {
  const createSession = useAppStore((state) => state.createSession)
  const project = useAppStore((state) => state.project)
  const isLoading = useAppStore((state) => state.isLoading)
  const setOpen = useAppStore((state) => state.setNewSessionOpen)
  const [prompt, setPrompt] = useState('')
  const [permission, setPermission] = useState<Session['permission']>('standard')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('current-branch')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [setOpen])

  const submit = async () => {
    const input: CreateSessionInput = { prompt, agent: 'codex', permission, workspaceMode }
    await createSession(input)
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
      <section
        aria-labelledby="new-session-title"
        aria-modal="true"
        className="new-task-modal new-session-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">New agent session</p>
            <h2 id="new-session-title">Start in {project?.name}</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
        </div>

        <div className="agent-picker" role="group" aria-label="Coding agent">
          <button className="agent-option selected" type="button">
            <span className="agent-option-icon"><Bot size={18} /></span>
            <span><strong>Codex</strong><small>Installed CLI · ready</small></span>
          </button>
          <button className="agent-option" disabled type="button">
            <span className="agent-option-icon">C</span>
            <span><strong>Claude Code</strong><small>Adapter coming next</small></span>
          </button>
        </div>

        <label className="prompt-field">
          <span>Message</span>
          <textarea
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && prompt.trim()) void submit()
            }}
            placeholder="Ask Codex to explore, explain, or change this repository…"
            ref={textareaRef}
            rows={6}
            value={prompt}
          />
          <small><Command size={11} /> Enter to start</small>
        </label>

        {!prompt ? (
          <div className="suggestion-row">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => setPrompt(suggestion)} type="button">{suggestion}</button>
            ))}
          </div>
        ) : null}

        <div className="session-options">
          <div className="workspace-mode" role="group" aria-label="Session workspace">
            <button className={workspaceMode === 'current-branch' ? 'selected' : ''} onClick={() => setWorkspaceMode('current-branch')} type="button">
              <FolderGit2 size={15} /><span><strong>Current branch</strong><small>{project?.branch}</small></span>
            </button>
            <button className={workspaceMode === 'worktree' ? 'selected' : ''} onClick={() => setWorkspaceMode('worktree')} type="button">
              <Box size={15} /><span><strong>New worktree</strong><small>Run in isolation</small></span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <label className="permission-select">
            <span>Permissions</span>
            <span className="select-wrap">
              <select onChange={(event) => setPermission(event.target.value as Session['permission'])} value={permission}>
                <option value="review-only">Review only</option>
                <option value="standard">Workspace write</option>
                <option value="autonomous">Full access</option>
              </select>
              <ChevronDown size={13} />
            </span>
          </label>
          <button className="primary-button" disabled={!prompt.trim() || isLoading} onClick={() => void submit()} type="button">
            <Sparkles size={16} /> {isLoading ? 'Starting…' : 'Start session'}
          </button>
        </div>
      </section>
    </div>
  )
}
