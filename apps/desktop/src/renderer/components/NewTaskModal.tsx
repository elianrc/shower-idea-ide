import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Command, Sparkles, X } from 'lucide-react'
import type { CreateTaskInput, Task } from '../../shared/types'
import { useAppStore } from '../store'

const suggestions = [
  'Fix a bug in the current project',
  'Add a small product improvement',
  'Refactor code that is hard to maintain',
]

export function NewTaskModal() {
  const createTask = useAppStore((state) => state.createTask)
  const isLoading = useAppStore((state) => state.isLoading)
  const setOpen = useAppStore((state) => state.setNewTaskOpen)
  const [prompt, setPrompt] = useState('')
  const [permission, setPermission] = useState<Task['permission']>('standard')
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
    const input: CreateTaskInput = { prompt, permission }
    await createTask(input)
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
      <section
        aria-labelledby="new-task-title"
        aria-modal="true"
        className="new-task-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Delegate work</p>
            <h2 id="new-task-title">Create a new task</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
        </div>

        <label className="prompt-field">
          <span>What do you want to change?</span>
          <textarea
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && prompt.trim()) void submit()
            }}
            placeholder="Describe the outcome, not the implementation…"
            ref={textareaRef}
            rows={7}
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

        <div className="modal-footer">
          <label className="permission-select">
            <span>Agent permission</span>
            <span className="select-wrap">
              <select onChange={(event) => setPermission(event.target.value as Task['permission'])} value={permission}>
                <option value="review-only">Review only</option>
                <option value="standard">Standard</option>
                <option value="autonomous">Autonomous</option>
              </select>
              <ChevronDown size={13} />
            </span>
          </label>
          <button className="primary-button" disabled={!prompt.trim() || isLoading} onClick={() => void submit()} type="button">
            <Sparkles size={16} /> {isLoading ? 'Preparing…' : 'Start task'}
          </button>
        </div>
      </section>
    </div>
  )
}
