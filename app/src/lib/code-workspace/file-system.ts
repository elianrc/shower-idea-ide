import * as Path from 'path'
import { promises as Fs } from 'fs'

const DefaultMaximumEntries = 5000
const DefaultMaximumFileSize = 5 * 1024 * 1024
const BinarySampleSize = 8000

const excludedDirectories = new Set(['.git', '.hg', '.svn', 'node_modules'])

export type CodeWorkspaceEntryKind = 'directory' | 'file'

export interface ICodeWorkspaceEntry {
  readonly kind: CodeWorkspaceEntryKind
  readonly name: string
  readonly path: string
}

export interface ICodeWorkspaceListing {
  readonly entries: ReadonlyArray<ICodeWorkspaceEntry>
  readonly truncated: boolean
}

export interface ICodeWorkspaceFile {
  readonly contents: string
  readonly modifiedAt: number
  readonly size: number
}

export class UnsupportedCodeWorkspaceFileError extends Error {}

function isWithinRepository(repositoryPath: string, fullPath: string) {
  const relativePath = Path.relative(repositoryPath, fullPath)
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${Path.sep}`) &&
      relativePath !== '..' &&
      !Path.isAbsolute(relativePath))
  )
}

export function resolveCodeWorkspacePath(
  repositoryPath: string,
  relativePath: string
) {
  const normalizedRepositoryPath = Path.resolve(repositoryPath)
  const fullPath = Path.resolve(normalizedRepositoryPath, relativePath)

  if (!isWithinRepository(normalizedRepositoryPath, fullPath)) {
    throw new Error(`Path '${relativePath}' is outside the repository`)
  }

  return fullPath
}

function toRepositoryPath(path: string) {
  return path.split(Path.sep).join('/')
}

async function readDirectoryEntries(
  repositoryPath: string,
  relativeDirectoryPath: string
) {
  const fullPath = resolveCodeWorkspacePath(
    repositoryPath,
    relativeDirectoryPath
  )

  return Fs.readdir(fullPath, { withFileTypes: true })
}

export async function listCodeWorkspaceEntries(
  repositoryPath: string,
  maximumEntries = DefaultMaximumEntries
): Promise<ICodeWorkspaceListing> {
  const directories = ['']
  const entries: ICodeWorkspaceEntry[] = []
  let truncated = false

  while (directories.length > 0 && !truncated) {
    const relativeDirectoryPath = directories.shift()!
    let directoryEntries

    try {
      directoryEntries = await readDirectoryEntries(
        repositoryPath,
        relativeDirectoryPath
      )
    } catch (error) {
      if (relativeDirectoryPath === '') {
        throw error
      }
      continue
    }

    directoryEntries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })

    for (const directoryEntry of directoryEntries) {
      if (directoryEntry.isSymbolicLink()) {
        continue
      }

      const relativePath = toRepositoryPath(
        Path.join(relativeDirectoryPath, directoryEntry.name)
      )

      if (directoryEntry.isDirectory()) {
        if (excludedDirectories.has(directoryEntry.name)) {
          continue
        }

        entries.push({
          kind: 'directory',
          name: directoryEntry.name,
          path: relativePath,
        })
        directories.push(relativePath)
      } else if (directoryEntry.isFile()) {
        entries.push({
          kind: 'file',
          name: directoryEntry.name,
          path: relativePath,
        })
      } else {
        continue
      }

      if (entries.length >= maximumEntries) {
        truncated = true
        break
      }
    }
  }

  return { entries, truncated }
}

function containsNullByte(buffer: Buffer) {
  const sampleLength = Math.min(buffer.length, BinarySampleSize)
  for (let index = 0; index < sampleLength; index++) {
    if (buffer[index] === 0) {
      return true
    }
  }
  return false
}

async function validateRegularRepositoryFile(
  repositoryPath: string,
  relativePath: string,
  maximumFileSize: number
) {
  const fullPath = resolveCodeWorkspacePath(repositoryPath, relativePath)
  const fileInformation = await Fs.lstat(fullPath)

  if (!fileInformation.isFile() || fileInformation.isSymbolicLink()) {
    throw new UnsupportedCodeWorkspaceFileError(
      `'${relativePath}' is not a regular file`
    )
  }

  if (fileInformation.size > maximumFileSize) {
    throw new UnsupportedCodeWorkspaceFileError(
      `'${relativePath}' is larger than ${Math.round(
        maximumFileSize / 1024 / 1024
      )} MB`
    )
  }

  const [realRepositoryPath, realFilePath] = await Promise.all([
    Fs.realpath(repositoryPath),
    Fs.realpath(fullPath),
  ])

  if (!isWithinRepository(realRepositoryPath, realFilePath)) {
    throw new UnsupportedCodeWorkspaceFileError(
      `'${relativePath}' resolves outside the repository`
    )
  }

  return { fullPath, fileInformation }
}

export async function readCodeWorkspaceFile(
  repositoryPath: string,
  relativePath: string,
  maximumFileSize = DefaultMaximumFileSize
): Promise<ICodeWorkspaceFile> {
  const { fullPath, fileInformation } = await validateRegularRepositoryFile(
    repositoryPath,
    relativePath,
    maximumFileSize
  )
  const buffer = await Fs.readFile(fullPath)

  if (containsNullByte(buffer)) {
    throw new UnsupportedCodeWorkspaceFileError(
      `'${relativePath}' appears to be a binary file`
    )
  }

  return {
    contents: buffer.toString('utf8'),
    modifiedAt: fileInformation.mtimeMs,
    size: fileInformation.size,
  }
}

export async function getCodeWorkspaceFileModifiedAt(
  repositoryPath: string,
  relativePath: string
) {
  const { fileInformation } = await validateRegularRepositoryFile(
    repositoryPath,
    relativePath,
    Number.MAX_SAFE_INTEGER
  )
  return fileInformation.mtimeMs
}

export async function writeCodeWorkspaceFile(
  repositoryPath: string,
  relativePath: string,
  contents: string
) {
  const { fullPath } = await validateRegularRepositoryFile(
    repositoryPath,
    relativePath,
    Number.MAX_SAFE_INTEGER
  )
  await Fs.writeFile(fullPath, contents, 'utf8')
  const fileInformation = await Fs.stat(fullPath)
  return fileInformation.mtimeMs
}
