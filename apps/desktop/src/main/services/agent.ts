import type { Session } from '../../shared/types'
import { ProcessManager, type ProcessResult } from './process-manager'

interface AgentCallbacks {
  onEvent(kind: 'thought' | 'command' | 'output' | 'milestone' | 'error', text: string): void
  onProviderSessionId(providerSessionId: string): void
}

export interface AgentAdapter {
  run(session: Session, prompt: string, callbacks: AgentCallbacks): Promise<ProcessResult>
  cancel(sessionId: string): boolean
}

interface CodexEvent {
  type?: string
  thread_id?: string
  message?: string
  item?: {
    type?: string
    text?: string
    command?: string
    aggregated_output?: string
  }
  error?: { message?: string }
}

export class CodexAdapter implements AgentAdapter {
  constructor(private readonly processes: ProcessManager) {}

  run(session: Session, prompt: string, callbacks: AgentCallbacks): Promise<ProcessResult> {
    const sandbox = session.permission === 'review-only'
      ? 'read-only'
      : session.permission === 'autonomous'
        ? 'danger-full-access'
        : 'workspace-write'
    const args = [
      'exec',
      '--json',
      '--color',
      'never',
      '--skip-git-repo-check',
      '--sandbox',
      sandbox,
    ]

    if (session.providerSessionId) {
      args.push('resume', session.providerSessionId, prompt)
      callbacks.onEvent('milestone', 'Resumed the Codex CLI session.')
    } else {
      args.push(prompt)
      callbacks.onEvent('milestone', `Started Codex on ${session.branch}.`)
    }

    return this.processes.run('codex', args, {
      cwd: session.workspacePath,
      processId: session.id,
      onStdout: (line) => this.handleLine(line, callbacks),
      onStderr: (line) => this.handleStderr(line, callbacks),
    })
  }

  cancel(sessionId: string): boolean {
    return this.processes.cancel(sessionId)
  }

  private handleLine(line: string, callbacks: AgentCallbacks): void {
    if (!line.trim()) return
    try {
      const event = JSON.parse(line) as CodexEvent
      if (event.type === 'thread.started' && event.thread_id) {
        callbacks.onProviderSessionId(event.thread_id)
        return
      }
      const item = event.item
      if (item?.type === 'agent_message' && item.text) {
        callbacks.onEvent('thought', item.text)
        return
      }
      if (item?.type === 'command_execution') {
        if (event.type === 'item.started' && item.command) callbacks.onEvent('command', item.command)
        if (item.aggregated_output?.trim()) callbacks.onEvent('output', item.aggregated_output.trim())
        return
      }
      if (event.type === 'error') {
        callbacks.onEvent('error', event.message ?? event.error?.message ?? 'Agent error')
        return
      }
      const message = item?.text ?? event.message
      if (message) callbacks.onEvent('output', message)
    } catch {
      callbacks.onEvent('output', line)
    }
  }

  private handleStderr(line: string, callbacks: AgentCallbacks): void {
    if (!line.trim()) return
    if (line === 'Reading additional input from stdin...') return
    if (line.includes('WARN codex_core_skills::loader:')) return
    callbacks.onEvent('output', line)
  }
}
