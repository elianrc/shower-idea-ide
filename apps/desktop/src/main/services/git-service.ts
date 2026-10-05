import { access, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { BranchInfo, ChangedFile, Project, TaskDiff } from '../../shared/types'
import { ProcessManager } from './process-manager'

const STATUS_MAP: Record<string, ChangedFile['status']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  '?': 'untracked',
}

export class GitService {
  constructor(private readonly processes: ProcessManager) {}

  async inspectRepository(path: string): Promise<Omit<Project, 'id' | 'openedAt'>> {
    const root = (await this.git(path, ['rev-parse', '--show-toplevel'])).stdout.trim()
    if (!root) throw new Error('The selected folder is not a Git repository.')
    const [branchResult, statusResult, remoteResult] = await Promise.all([
      this.git(root, ['branch', '--show-current']),
      this.git(root, ['status', '--porcelain']),
      this.git(root, ['remote', 'get-url', 'origin'], true),
    ])
    return {
      name: basename(root),
      path: root,
      branch: branchResult.stdout.trim() || 'HEAD',
      isClean: statusResult.stdout.trim().length === 0,
      remote: remoteResult.code === 0 ? remoteResult.stdout.trim() : undefined,
    }
  }

  async createWorktree(repo: string, branch: string, path: string, baseBranch: string): Promise<void> {
    const result = await this.git(repo, ['worktree', 'add', '-b', branch, path, baseBranch], true)
    if (result.code !== 0) throw new Error(result.stderr.trim() || 'Unable to create the task worktree.')
  }

  async listBranches(repo: string): Promise<BranchInfo[]> {
    const [currentResult, branchesResult, worktreesResult] = await Promise.all([
      this.git(repo, ['branch', '--show-current']),
      this.git(repo, [
        'for-each-ref',
        '--sort=-committerdate',
        '--format=%(refname:short)\t%(committerdate:iso8601)',
        'refs/heads',
      ]),
      this.git(repo, ['worktree', 'list', '--porcelain']),
    ])
    const current = currentResult.stdout.trim()
    const worktreeBranches = new Set(
      worktreesResult.stdout
        .split('\n')
        .filter((line) => line.startsWith('branch refs/heads/'))
        .map((line) => line.slice('branch refs/heads/'.length)),
    )

    return branchesResult.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, updatedAt] = line.split('\t')
        return {
          name,
          isCurrent: name === current,
          isWorktree: worktreeBranches.has(name),
          updatedAt: updatedAt || undefined,
        }
      })
  }

  async switchBranch(repo: string, branch: string): Promise<void> {
    const project = await this.inspectRepository(repo)
    if (project.branch === branch) return
    if (!project.isClean) {
      throw new Error('Commit or stash the current repository changes before switching branches.')
    }
    const candidate = (await this.listBranches(repo)).find((item) => item.name === branch)
    if (!candidate) throw new Error(`Branch “${branch}” does not exist in this repository.`)
    if (candidate.isWorktree) {
      throw new Error(`Branch “${branch}” is already checked out in another task worktree.`)
    }
    const result = await this.git(repo, ['switch', branch], true)
    if (result.code !== 0) throw new Error(result.stderr.trim() || `Unable to switch to ${branch}.`)
  }

  async createBranch(repo: string, branch: string, baseBranch?: string): Promise<void> {
    const name = branch.trim()
    if (!name) throw new Error('Enter a branch name.')
    const valid = await this.git(repo, ['check-ref-format', '--branch', name], true)
    if (valid.code !== 0) throw new Error(`“${name}” is not a valid Git branch name.`)
    if ((await this.listBranches(repo)).some((item) => item.name === name)) {
      throw new Error(`Branch “${name}” already exists.`)
    }
    const args = ['switch', '-c', name]
    if (baseBranch) args.push(baseBranch)
    const result = await this.git(repo, args, true)
    if (result.code !== 0) throw new Error(result.stderr.trim() || `Unable to create ${name}.`)
  }

  async getChangedFiles(repo: string): Promise<ChangedFile[]> {
    const [status, stats] = await Promise.all([
      this.git(repo, ['status', '--porcelain=v1', '--untracked-files=all']),
      this.git(repo, ['diff', 'HEAD', '--numstat']),
    ])
    const statMap = new Map<string, { additions: number; deletions: number }>()
    for (const line of stats.stdout.split('\n')) {
      if (!line) continue
      const [added, deleted, ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      statMap.set(path, {
        additions: Number.isNaN(Number(added)) ? 0 : Number(added),
        deletions: Number.isNaN(Number(deleted)) ? 0 : Number(deleted),
      })
    }

    const files: ChangedFile[] = []
    for (const line of status.stdout.split('\n')) {
      if (!line) continue
      const code = line.slice(0, 2).trim() || '?'
      const rawPath = line.slice(3)
      const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath
      const statusKey = code === '??' ? '?' : code.at(-1)!
      const stat = statMap.get(path)
      let additions = stat?.additions ?? 0
      let deletions = stat?.deletions ?? 0
      if (statusKey === '?') {
        try {
          const contents = await readFile(resolve(repo, path), 'utf8')
          additions = contents.length === 0
            ? 0
            : contents.split('\n').length - (contents.endsWith('\n') ? 1 : 0)
        } catch {
          additions = 0
        }
      }
      files.push({
        path,
        status: STATUS_MAP[statusKey] ?? 'modified',
        additions,
        deletions,
      })
    }
    return files
  }

  async getDiff(taskId: string, repo: string, requestedPath?: string): Promise<TaskDiff> {
    const files = await this.getChangedFiles(repo)
    const filePath = requestedPath && files.some((file) => file.path === requestedPath)
      ? requestedPath
      : undefined
    const diffArgs = ['diff', 'HEAD', '--no-ext-diff', '--unified=40']
    if (filePath) diffArgs.push('--', filePath)
    const tracked = await this.git(repo, diffArgs)
    const chunks = [tracked.stdout]
    for (const file of files.filter((entry) => entry.status === 'untracked' && (!filePath || entry.path === filePath))) {
      const absolutePath = resolve(repo, file.path)
      try {
        await access(absolutePath)
        const result = await this.processes.run(
          'git',
          ['diff', '--no-index', '--no-ext-diff', '--unified=40', '--', '/dev/null', file.path],
          { cwd: repo },
        )
        chunks.push(result.stdout)
      } catch {
        // The file may have disappeared while status was being collected.
      }
    }
    return { taskId, raw: chunks.filter(Boolean).join('\n'), files }
  }

  async commit(repo: string, message: string): Promise<string> {
    const add = await this.git(repo, ['add', '-A'], true)
    if (add.code !== 0) throw new Error(add.stderr.trim() || 'Unable to stage task changes.')
    const commit = await this.git(repo, ['commit', '-m', message], true)
    if (commit.code !== 0) throw new Error(commit.stderr.trim() || 'Unable to commit task changes.')
    const revision = await this.git(repo, ['rev-parse', '--short', 'HEAD'])
    return revision.stdout.trim()
  }

  private async git(cwd: string, args: string[], allowFailure = false) {
    const result = await this.processes.run('git', args, { cwd })
    if (!allowFailure && result.code !== 0) {
      throw new Error(result.stderr.trim() || `Git command failed: git ${args.join(' ')}`)
    }
    return result
  }
}
