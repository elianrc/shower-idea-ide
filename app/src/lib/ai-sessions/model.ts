import { IAISessionItem } from './types'

type JsonObject = { readonly [key: string]: any }

function textFromUserInput(input: JsonObject): string {
  return input.type === 'text' && typeof input.text === 'string'
    ? input.text
    : input.type === 'localImage' && typeof input.path === 'string'
    ? `[Image: ${input.path}]`
    : input.type === 'image'
    ? '[Image]'
    : ''
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function describeFileChanges(changes: ReadonlyArray<JsonObject>): string {
  return changes
    .map(change => {
      const path = typeof change.path === 'string' ? change.path : 'file'
      const kind = typeof change.kind === 'string' ? change.kind : 'update'
      return `${kind}: ${path}`
    })
    .join('\n')
}

/** Convert Codex protocol items into the small, stable shape used by Vivlio. */
export function normalizeCodexItem(item: JsonObject): IAISessionItem | null {
  const id =
    typeof item.id === 'string' ? item.id : `${item.type}-${Date.now()}`

  switch (item.type) {
    case 'userMessage':
      return {
        id,
        kind: 'user',
        text: Array.isArray(item.content)
          ? item.content.map(textFromUserInput).filter(Boolean).join('\n')
          : '',
      }
    case 'agentMessage':
      return {
        id,
        kind: 'assistant',
        text: typeof item.text === 'string' ? item.text : '',
      }
    case 'plan':
      return {
        id,
        kind: 'plan',
        title: 'Plan',
        text: typeof item.text === 'string' ? item.text : '',
      }
    case 'reasoning':
      return {
        id,
        kind: 'reasoning',
        title: 'Reasoning summary',
        text: Array.isArray(item.summary) ? item.summary.join('\n') : '',
      }
    case 'commandExecution':
      return {
        id,
        kind: 'command',
        title: typeof item.command === 'string' ? item.command : 'Command',
        text:
          typeof item.aggregatedOutput === 'string'
            ? item.aggregatedOutput
            : '',
        status: typeof item.status === 'string' ? item.status : undefined,
        detail: typeof item.cwd === 'string' ? item.cwd : undefined,
      }
    case 'fileChange':
      return {
        id,
        kind: 'file-change',
        title: 'File changes',
        text: Array.isArray(item.changes)
          ? describeFileChanges(item.changes)
          : '',
        status: typeof item.status === 'string' ? item.status : undefined,
      }
    case 'mcpToolCall':
    case 'dynamicToolCall':
    case 'collabAgentToolCall':
      return {
        id,
        kind: 'tool',
        title:
          typeof item.tool === 'string'
            ? item.tool
            : typeof item.type === 'string'
            ? item.type
            : 'Tool call',
        text:
          item.error !== null && item.error !== undefined
            ? prettyJson(item.error)
            : item.result !== null && item.result !== undefined
            ? prettyJson(item.result)
            : item.arguments !== undefined
            ? prettyJson(item.arguments)
            : '',
        status: typeof item.status === 'string' ? item.status : undefined,
      }
    case 'webSearch':
      return {
        id,
        kind: 'tool',
        title: 'Web search',
        text: typeof item.query === 'string' ? item.query : '',
      }
    case 'contextCompaction':
      return {
        id,
        kind: 'status',
        title: 'Context compacted',
        text: 'Codex compacted the conversation context.',
      }
    default:
      return null
  }
}

export function normalizeCodexTurns(
  turns: ReadonlyArray<JsonObject>
): ReadonlyArray<IAISessionItem> {
  const result: Array<IAISessionItem> = []
  for (const turn of turns) {
    if (!Array.isArray(turn.items)) {
      continue
    }
    for (const item of turn.items) {
      const normalized = normalizeCodexItem(item)
      if (normalized !== null) {
        result.push(normalized)
      }
    }
  }
  return result
}
