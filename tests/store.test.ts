import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceStore } from '../apps/desktop/src/main/services/store'

describe('WorkspaceStore session metadata', () => {
  let root: string
  let statePath: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vivlio-store-'))
    statePath = join(root, 'workspace.json')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('migrates existing sessions with pin and unread defaults', async () => {
    await writeFile(statePath, JSON.stringify({
      version: 3,
      activeProjectId: 'project-1',
      projects: [{
        id: 'project-1',
        name: 'fixture',
        path: root,
        branch: 'main',
        isClean: true,
        openedAt: '2026-01-01T00:00:00.000Z',
      }],
      sessions: [{
        id: 'session-1',
        projectId: 'project-1',
        title: 'Existing session',
        initialPrompt: 'Inspect the repository',
        status: 'waiting',
        branch: 'main',
        workspacePath: root,
        workspaceMode: 'current-branch',
        agent: 'codex',
        permission: 'standard',
        summary: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        changedFiles: [],
        verification: [],
        activity: [],
      }],
    }), 'utf8')

    const store = new WorkspaceStore(statePath)
    await store.load()

    expect(store.getSession('session-1')).toMatchObject({ isPinned: false, isUnread: false })
    expect(JSON.parse(await readFile(statePath, 'utf8'))).toMatchObject({ version: 4 })
  })

  it('persists metadata changes without changing conversation recency and removes sessions', async () => {
    const store = new WorkspaceStore(statePath)
    const updatedAt = '2026-01-01T00:00:00.000Z'
    await store.addSession({
      id: 'session-1',
      projectId: 'project-1',
      title: 'Session',
      isPinned: false,
      isUnread: false,
      initialPrompt: 'Prompt',
      status: 'waiting',
      branch: 'main',
      workspacePath: root,
      workspaceMode: 'current-branch',
      agent: 'codex',
      permission: 'standard',
      summary: '',
      createdAt: updatedAt,
      updatedAt,
      changedFiles: [],
      verification: [],
      activity: [],
    })

    await store.updateSession('session-1', (session) => {
      session.isPinned = true
      session.isUnread = true
    }, { touch: false })

    expect(store.getSession('session-1')).toMatchObject({ isPinned: true, isUnread: true, updatedAt })
    await store.removeSession('session-1')
    expect(store.getSession('session-1')).toBeUndefined()
  })
})
