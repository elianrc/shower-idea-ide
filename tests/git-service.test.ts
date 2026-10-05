import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitService } from '../apps/desktop/src/main/services/git-service'
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager'

const execute = promisify(execFile)

describe('GitService', () => {
  let fixtureRoot: string
  let repository: string
  let worktree: string
  let git: GitService

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'shower-idea-git-'))
    repository = join(fixtureRoot, 'project')
    worktree = join(fixtureRoot, 'worktree')
    await mkdir(repository)
    await execute('git', ['init', '-b', 'main'], { cwd: repository })
    await execute('git', ['config', 'user.name', 'Shower Idea Tests'], { cwd: repository })
    await execute('git', ['config', 'user.email', 'tests@shower-idea.local'], { cwd: repository })
    await writeFile(join(repository, 'README.md'), '# Fixture\n', 'utf8')
    await execute('git', ['add', 'README.md'], { cwd: repository })
    await execute('git', ['commit', '-m', 'Initial commit'], { cwd: repository })
    git = new GitService(new ProcessManager())
  })

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true })
  })

  it('creates an isolated worktree, reports changes, and commits approval', async () => {
    const project = await git.inspectRepository(repository)
    expect(project).toMatchObject({ branch: 'main', isClean: true, name: 'project' })

    await git.createWorktree(repository, 'task/add-greeting', worktree, 'main')
    expect(await git.listBranches(repository)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'main', isCurrent: true, isWorktree: true }),
      expect.objectContaining({ name: 'task/add-greeting', isCurrent: false, isWorktree: true }),
    ]))
    await mkdir(join(worktree, 'src'))
    await writeFile(join(worktree, 'src', 'greeting.ts'), "export const greeting = 'hello'\n", 'utf8')
    await writeFile(join(worktree, 'README.md'), '# Fixture\n\nNow with a greeting.\n', 'utf8')

    const changed = await git.getChangedFiles(worktree)
    expect(changed.map((file) => [file.path, file.status])).toEqual([
      ['README.md', 'modified'],
      ['src/greeting.ts', 'untracked'],
    ])

    const diff = await git.getDiff('task-id', worktree)
    expect(diff.raw).toContain('Now with a greeting.')
    expect(diff.raw).toContain("export const greeting = 'hello'")

    const revision = await git.commit(worktree, 'Add greeting')
    expect(revision).toMatch(/^[a-f0-9]{7,}$/)
    expect(await git.getChangedFiles(worktree)).toEqual([])
  })

  it('creates and switches branches while protecting local changes', async () => {
    await git.createBranch(repository, 'feature/repository-bar', 'main')
    expect(await git.inspectRepository(repository)).toMatchObject({
      branch: 'feature/repository-bar',
      isClean: true,
    })

    await git.switchBranch(repository, 'main')
    expect(await git.inspectRepository(repository)).toMatchObject({ branch: 'main' })

    await writeFile(join(repository, 'draft.txt'), 'not committed\n', 'utf8')
    await expect(git.switchBranch(repository, 'feature/repository-bar')).rejects.toThrow(
      'Commit or stash the current repository changes before switching branches.',
    )
  })

  it('rejects invalid and duplicate branch names', async () => {
    await expect(git.createBranch(repository, 'not a branch')).rejects.toThrow('not a valid Git branch name')
    await expect(git.createBranch(repository, 'main')).rejects.toThrow('already exists')
  })

  it('reports cleanliness and divergence from the configured upstream', async () => {
    await git.createBranch(repository, 'feature/status', 'main')
    await execute('git', ['branch', '--set-upstream-to=main', 'feature/status'], { cwd: repository })
    await writeFile(join(repository, 'status.txt'), 'status model\n', 'utf8')

    expect(await git.getRepositoryStatus(repository)).toMatchObject({
      branch: 'feature/status',
      isClean: false,
      isDetached: false,
      hasRemote: false,
      upstream: 'main',
      ahead: 0,
      behind: 0,
    })

    await execute('git', ['add', 'status.txt'], { cwd: repository })
    await execute('git', ['commit', '-m', 'Add status fixture'], { cwd: repository })
    expect(await git.getRepositoryStatus(repository)).toMatchObject({ ahead: 1, behind: 0, isClean: true })
  })
})
