import assert from 'node:assert'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import * as Path from 'path'
import { describe, it } from 'node:test'

import {
  listCodeWorkspaceEntries,
  readCodeWorkspaceFile,
  resolveCodeWorkspacePath,
  UnsupportedCodeWorkspaceFileError,
  writeCodeWorkspaceFile,
} from '../../../../src/lib/code-workspace/file-system'

async function withRepository(
  callback: (repositoryPath: string) => Promise<void>
) {
  const repositoryPath = await mkdtemp(
    Path.join(tmpdir(), 'vivlio-code-workspace-')
  )

  try {
    await callback(repositoryPath)
  } finally {
    await rm(repositoryPath, { recursive: true, force: true })
  }
}

describe('code workspace file system', () => {
  it('keeps resolved paths inside the repository', async () => {
    await withRepository(async repositoryPath => {
      assert.equal(
        resolveCodeWorkspacePath(repositoryPath, 'src/index.ts'),
        Path.join(repositoryPath, 'src/index.ts')
      )
      assert.throws(
        () => resolveCodeWorkspacePath(repositoryPath, '../outside.txt'),
        /outside the repository/
      )
    })
  })

  it('lists regular repository files and excludes generated or linked trees', async () => {
    await withRepository(async repositoryPath => {
      await mkdir(Path.join(repositoryPath, 'src'))
      await mkdir(Path.join(repositoryPath, '.git'))
      await mkdir(Path.join(repositoryPath, 'node_modules'))
      await writeFile(Path.join(repositoryPath, 'README.md'), '# Vivlio')
      await writeFile(Path.join(repositoryPath, 'src', 'index.ts'), 'export {}')
      await writeFile(Path.join(repositoryPath, '.git', 'config'), 'ignored')
      await writeFile(
        Path.join(repositoryPath, 'node_modules', 'module.js'),
        'ignored'
      )
      await symlink(
        Path.join(repositoryPath, 'src'),
        Path.join(repositoryPath, 'linked-src')
      )

      const listing = await listCodeWorkspaceEntries(repositoryPath)

      assert.equal(listing.truncated, false)
      assert.deepEqual(
        listing.entries.map(entry => [entry.kind, entry.path]),
        [
          ['directory', 'src'],
          ['file', 'README.md'],
          ['file', 'src/index.ts'],
        ]
      )
    })
  })

  it('reads and writes text while rejecting binary files', async () => {
    await withRepository(async repositoryPath => {
      await writeFile(Path.join(repositoryPath, 'note.txt'), 'before')
      await writeFile(
        Path.join(repositoryPath, 'image.bin'),
        Buffer.from([1, 0, 2])
      )

      const file = await readCodeWorkspaceFile(repositoryPath, 'note.txt')
      assert.equal(file.contents, 'before')

      const modifiedAt = await writeCodeWorkspaceFile(
        repositoryPath,
        'note.txt',
        'after'
      )
      assert.equal(
        await readFile(Path.join(repositoryPath, 'note.txt'), 'utf8'),
        'after'
      )
      assert.equal(Number.isFinite(modifiedAt), true)

      await assert.rejects(
        readCodeWorkspaceFile(repositoryPath, 'image.bin'),
        UnsupportedCodeWorkspaceFileError
      )
    })
  })
})
