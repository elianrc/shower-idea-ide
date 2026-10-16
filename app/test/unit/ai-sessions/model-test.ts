import assert from 'node:assert'
import { describe, it } from 'node:test'

import {
  normalizeCodexItem,
  normalizeCodexTurns,
} from '../../../src/lib/ai-sessions/model'

describe('AI session model', () => {
  it('normalizes the core Codex transcript items', () => {
    assert.deepEqual(
      normalizeCodexItem({
        type: 'userMessage',
        id: 'user-1',
        content: [{ type: 'text', text: 'Explain this change.' }],
      }),
      { id: 'user-1', kind: 'user', text: 'Explain this change.' }
    )

    assert.deepEqual(
      normalizeCodexItem({
        type: 'commandExecution',
        id: 'command-1',
        command: 'npm test',
        cwd: '/work/repository',
        status: 'completed',
        aggregatedOutput: '42 tests passed',
      }),
      {
        id: 'command-1',
        kind: 'command',
        title: 'npm test',
        text: '42 tests passed',
        status: 'completed',
        detail: '/work/repository',
      }
    )
  })

  it('preserves turn and item order while ignoring unsupported items', () => {
    const items = normalizeCodexTurns([
      {
        items: [
          { type: 'unknown', id: 'ignored' },
          { type: 'agentMessage', id: 'assistant-1', text: 'First' },
        ],
      },
      {
        items: [{ type: 'plan', id: 'plan-1', text: 'Second' }],
      },
    ])

    assert.deepEqual(
      items.map(item => item.id),
      ['assistant-1', 'plan-1']
    )
  })
})
