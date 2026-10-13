import { lstat, readFile, readlink, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'
import type { SourceFile, WorkspaceFileNode } from '../../shared/types'
import { ProcessManager } from './process-manager'

const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.c': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.css': 'css',
  '.go': 'go',
  '.graphql': 'graphql',
  '.h': 'c',
  '.hpp': 'cpp',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'javascript',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.php': 'php',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scss': 'scss',
  '.sh': 'shell',
  '.sql': 'sql',
  '.swift': 'swift',
  '.toml': 'ini',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.vue': 'html',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
}

interface MutableNode extends WorkspaceFileNode {
  children?: MutableNode[]
}

export class WorkspaceFilesService {
  constructor(private readonly processes: ProcessManager) {}

  async list(root: string): Promise<WorkspaceFileNode[]> {
    const result = await this.processes.run(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root },
    )
    if (result.code !== 0) throw new Error(result.stderr.trim() || 'Unable to list repository files.')

    const paths = result.stdout
      .split('\0')
      .map((entry) => entry.replace(/\n+$/, ''))
      .filter(Boolean)
    return buildFileTree(paths)
  }

  async read(root: string, requestedPath: string): Promise<SourceFile> {
    const { absolutePath, relativePath } = safeWorkspacePath(root, requestedPath)
    const metadata = await lstat(absolutePath)

    if (metadata.isSymbolicLink()) {
      const target = await readlink(absolutePath)
      return {
        path: relativePath,
        name: basename(relativePath),
        contents: target,
        language: 'plaintext',
        size: Buffer.byteLength(target),
      }
    }
    if (!metadata.isFile()) throw new Error('Only files can be opened in the code viewer.')
    if (metadata.size > MAX_SOURCE_FILE_BYTES) throw new Error('This file is too large to preview safely.')

    const contents = await readFile(absolutePath)
    if (contents.includes(0)) throw new Error('Binary files cannot be previewed.')

    return {
      path: relativePath,
      name: basename(relativePath),
      contents: contents.toString('utf8'),
      language: languageForPath(relativePath),
      size: metadata.size,
    }
  }

  async write(root: string, requestedPath: string, contents: string): Promise<SourceFile> {
    const { absolutePath } = safeWorkspacePath(root, requestedPath)
    const metadata = await lstat(absolutePath)
    if (metadata.isSymbolicLink()) throw new Error('Symbolic links cannot be edited in Vivlio.')
    if (!metadata.isFile()) throw new Error('Only files can be saved from the code editor.')
    if (Buffer.byteLength(contents) > MAX_SOURCE_FILE_BYTES) throw new Error('This file is too large to save from Vivlio.')
    await writeFile(absolutePath, contents, 'utf8')
    return this.read(root, requestedPath)
  }
}

export function buildFileTree(paths: string[]): WorkspaceFileNode[] {
  const roots: MutableNode[] = []

  for (const path of [...new Set(paths)].sort((a, b) => a.localeCompare(b))) {
    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) continue
    let level = roots
    let currentPath = ''

    segments.forEach((name, index) => {
      currentPath = currentPath ? `${currentPath}/${name}` : name
      const isFile = index === segments.length - 1
      let node = level.find((candidate) => candidate.name === name)
      if (!node) {
        node = {
          id: currentPath,
          name,
          path: currentPath,
          kind: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        level.push(node)
      }
      if (!isFile) level = node.children ?? (node.children = [])
    })
  }

  sortTree(roots)
  return roots
}

function sortTree(nodes: MutableNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  for (const node of nodes) {
    if (node.children) sortTree(node.children)
  }
}

function safeWorkspacePath(root: string, requestedPath: string): { absolutePath: string; relativePath: string } {
  if (!requestedPath.trim() || isAbsolute(requestedPath)) throw new Error('Choose a file inside the workspace.')
  const absolutePath = resolve(root, requestedPath)
  const relativePath = relative(resolve(root), absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
    throw new Error('The requested file is outside the workspace.')
  }
  return { absolutePath, relativePath: relativePath.split('\\').join('/') }
}

function languageForPath(path: string): string {
  const fileName = basename(path).toLowerCase()
  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'makefile'
  return LANGUAGE_BY_EXTENSION[extname(fileName)] ?? 'plaintext'
}
