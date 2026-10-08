import { describe, expect, it } from 'vitest'
import type { Session } from '../apps/desktop/src/shared/types'
import { CodexAdapter } from '../apps/desktop/src/main/services/agent'
import type { ProcessManager, ProcessResult } from '../apps/desktop/src/main/services/process-manager'

class FakeProcessManager {
  command = ''
  args: string[] = []

  async run(command: string, args: string[]): Promise<ProcessResult> {
    this.command = command
    this.args = args
    return { code: 0, stdout: '', stderr: '' }
  }

  cancel(): boolean {
    return true
  }
}

const callbacks = {
  onEvent: () => undefined,
  onProviderSessionId: () => undefined,
}

describe('Codex sessions', () => {
  it('starts a new persisted Codex thread', async () => {
    const processes = new FakeProcessManager()
    const adapter = new CodexAdapter(processes as unknown as ProcessManager)
    await adapter.run(makeSession(), 'Inspect the project', callbacks)

    expect(processes.command).toBe('codex')
    expect(processes.args).not.toContain('resume')
    expect(processes.args.at(-1)).toBe('Inspect the project')
  })

  it('resumes the provider thread for follow-up messages', async () => {
    const processes = new FakeProcessManager()
    const adapter = new CodexAdapter(processes as unknown as ProcessManager)
    await adapter.run(makeSession('thread-123'), 'Now implement it', callbacks)

    expect(processes.args.slice(-3)).toEqual(['resume', 'thread-123', 'Now implement it'])
  })
})

function makeSession(providerSessionId?: string): Session {
  return {
    id: 'session-1',
    projectId: 'project-1',
    title: 'Inspect the project',
    initialPrompt: 'Inspect the project',
    status: 'running',
    branch: 'main',
    workspacePath: '/tmp/project',
    workspaceMode: 'current-branch',
    agent: 'codex',
    providerSessionId,
    permission: 'standard',
    summary: '',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    changedFiles: [],
    verification: [],
    activity: [],
  }
}
