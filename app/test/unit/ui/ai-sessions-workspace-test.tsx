import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import {
  IAISessionRuntimeInfo,
  IAISessionSnapshot,
} from '../../../src/lib/ai-sessions/types'
import { AISessionsWorkspace } from '../../../src/ui/ai-sessions/ai-sessions-workspace'
import { IAISessionsClient } from '../../../src/ui/ai-sessions/client'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

const runtime: IAISessionRuntimeInfo = {
  provider: 'codex',
  available: true,
  authenticated: true,
  executablePath: '/usr/local/bin/codex',
  version: 'codex-cli 1.0.0',
  accountLabel: 'developer@example.com',
  models: [
    {
      id: 'codex-model',
      label: 'Codex Model',
      description: 'Test model',
      isDefault: true,
    },
  ],
  error: null,
}

const session: IAISessionSnapshot = {
  threadId: 'thread-1',
  provider: 'codex',
  repositoryPath: '/work/repository',
  title: 'Work on repository',
  model: 'codex-model',
  status: 'idle',
  currentTurnId: null,
  items: [],
  approvals: [],
  createdAt: 1,
  updatedAt: 1,
  error: null,
}

function createClient(): IAISessionsClient {
  return {
    getRuntimeInfo: async () => runtime,
    startSession: async () => session,
    resumeSession: async () => session,
    sendMessage: async () => session,
    interruptSession: async () => session,
    respondToApproval: async () => session,
    renameSession: async () => session,
    archiveSession: async () => {},
    subscribe: () => () => {},
  }
}

describe('AI sessions workspace', () => {
  it('creates a Codex session and exposes code-review handoffs', async () => {
    let requestedCode = false
    let requestedReview = false
    render(
      <AISessionsWorkspace
        repositoryName="repository"
        repositoryPath="/work/repository"
        changedFiles={new Map()}
        isActive={true}
        onRequestCode={() => {
          requestedCode = true
        }}
        onRequestReview={() => {
          requestedReview = true
        }}
        client={createClient()}
      />
    )

    await waitFor(() =>
      assert.ok(
        screen.getAllByRole('button', { name: /new codex session/i }).length > 0
      )
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: /new codex session/i })[0]
    )

    await waitFor(() =>
      assert.ok(screen.getByRole('heading', { name: 'Work on repository' }))
    )
    fireEvent.click(screen.getByRole('button', { name: 'Code' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    assert.equal(requestedCode, true)
    assert.equal(requestedReview, true)
    assert.ok(screen.getByLabelText('Message Codex'))
  })
})
