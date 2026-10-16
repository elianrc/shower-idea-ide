import { IAISessionCatalogEntry } from '../../lib/ai-sessions/types'

const SessionCatalogKey = 'vivlio-ai-session-catalog-v1'

function isCatalogEntry(value: any): value is IAISessionCatalogEntry {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.threadId === 'string' &&
    value.provider === 'codex' &&
    typeof value.repositoryPath === 'string' &&
    typeof value.repositoryName === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.model === 'string' || value.model === null) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

export function loadAISessionCatalog(): ReadonlyArray<IAISessionCatalogEntry> {
  try {
    const serialized = localStorage.getItem(SessionCatalogKey)
    if (serialized === null) {
      return []
    }
    const parsed = JSON.parse(serialized)
    return Array.isArray(parsed) ? parsed.filter(isCatalogEntry) : []
  } catch {
    return []
  }
}

export function saveAISessionCatalog(
  entries: ReadonlyArray<IAISessionCatalogEntry>
) {
  try {
    localStorage.setItem(SessionCatalogKey, JSON.stringify(entries))
  } catch {
    // Session history remains available from Codex when storage is disabled.
  }
}

export function upsertAISessionCatalogEntry(
  entry: IAISessionCatalogEntry
): ReadonlyArray<IAISessionCatalogEntry> {
  const entries = loadAISessionCatalog()
  const next = [
    entry,
    ...entries.filter(item => item.threadId !== entry.threadId),
  ]
  saveAISessionCatalog(next)
  return next
}

export function removeAISessionCatalogEntry(
  threadId: string
): ReadonlyArray<IAISessionCatalogEntry> {
  const next = loadAISessionCatalog().filter(item => item.threadId !== threadId)
  saveAISessionCatalog(next)
  return next
}
