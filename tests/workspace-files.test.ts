import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager'
import { WorkspaceFilesService, buildFileTree } from '../apps/desktop/src/main/services/workspace-files'

const execute = promisify(execFile)

describe('WorkspaceFilesService', () => {
  let root: string
  let files: WorkspaceFilesService

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vivlio-files-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src', 'main.ts'), 'export const ready = true\n', 'utf8')
    files = new WorkspaceFilesService(new ProcessManager())
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('builds a directory-first tree from repository paths', () => {
    expect(buildFileTree(['README.md', 'src/z.ts', 'src/a.ts'])).toEqual([
      {
        id: 'src',
        name: 'src',
        path: 'src',
        kind: 'directory',
        children: [
          { id: 'src/a.ts', name: 'a.ts', path: 'src/a.ts', kind: 'file' },
          { id: 'src/z.ts', name: 'z.ts', path: 'src/z.ts', kind: 'file' },
        ],
      },
      { id: 'README.md', name: 'README.md', path: 'README.md', kind: 'file' },
    ])
  })

  it('reads text files with language metadata', async () => {
    await expect(files.read(root, 'src/main.ts')).resolves.toMatchObject({
      path: 'src/main.ts',
      language: 'typescript',
      contents: 'export const ready = true\n',
    })
  })

  it('saves text files while preserving workspace boundaries', async () => {
    await expect(files.write(root, 'src/main.ts', 'export const ready = false\n')).resolves.toMatchObject({
      path: 'src/main.ts',
      contents: 'export const ready = false\n',
    })
    expect(await readFile(join(root, 'src', 'main.ts'), 'utf8')).toBe('export const ready = false\n')
    await expect(files.write(root, '../outside.ts', 'unsafe')).rejects.toThrow('outside the workspace')
  })

  it('lists tracked and untracked files while respecting Git ignores', async () => {
    await execute('git', ['init', '-b', 'main'], { cwd: root })
    await writeFile(join(root, '.gitignore'), 'ignored.txt\n', 'utf8')
    await writeFile(join(root, 'README.md'), '# Fixture\n', 'utf8')
    await writeFile(join(root, 'ignored.txt'), 'hidden\n', 'utf8')
    await execute('git', ['add', '.gitignore', 'README.md', 'src/main.ts'], { cwd: root })

    const tree = await files.list(root)
    expect(JSON.stringify(tree)).toContain('src/main.ts')
    expect(JSON.stringify(tree)).toContain('README.md')
    expect(JSON.stringify(tree)).not.toContain('ignored.txt')
  })

  it('rejects traversal and does not follow symbolic links', async () => {
    await expect(files.read(root, '../outside.txt')).rejects.toThrow('outside the workspace')
    await symlink('/private/etc/hosts', join(root, 'hosts-link'))
    await expect(files.read(root, 'hosts-link')).resolves.toMatchObject({
      contents: '/private/etc/hosts',
      language: 'plaintext',
    })
    await expect(files.write(root, 'hosts-link', 'unsafe')).rejects.toThrow('Symbolic links')
  })

  it('rejects binary file previews', async () => {
    await writeFile(join(root, 'image.bin'), Buffer.from([0, 1, 2, 3]))
    await expect(files.read(root, 'image.bin')).rejects.toThrow('Binary files')
  })
})
