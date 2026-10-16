import * as ipcRenderer from '../../lib/ipc-renderer'
import {
  AIApprovalDecision,
  AISessionEvent,
  IAISessionRuntimeInfo,
  IAISessionSnapshot,
  IResumeAISessionRequest,
  ISendAISessionMessageRequest,
  IStartAISessionRequest,
} from '../../lib/ai-sessions/types'

export interface IAISessionsClient {
  readonly getRuntimeInfo: () => Promise<IAISessionRuntimeInfo>
  readonly startSession: (
    request: IStartAISessionRequest
  ) => Promise<IAISessionSnapshot>
  readonly resumeSession: (
    request: IResumeAISessionRequest
  ) => Promise<IAISessionSnapshot>
  readonly sendMessage: (
    request: ISendAISessionMessageRequest
  ) => Promise<IAISessionSnapshot>
  readonly interruptSession: (threadId: string) => Promise<IAISessionSnapshot>
  readonly respondToApproval: (
    threadId: string,
    requestId: string | number,
    decision: AIApprovalDecision
  ) => Promise<IAISessionSnapshot>
  readonly renameSession: (
    threadId: string,
    title: string
  ) => Promise<IAISessionSnapshot>
  readonly archiveSession: (threadId: string) => Promise<void>
  readonly subscribe: (listener: (event: AISessionEvent) => void) => () => void
}

export const aiSessionsClient: IAISessionsClient = {
  getRuntimeInfo: () => ipcRenderer.invoke('ai-session-runtime-info'),
  startSession: request => ipcRenderer.invoke('ai-session-start', request),
  resumeSession: request => ipcRenderer.invoke('ai-session-resume', request),
  sendMessage: request => ipcRenderer.invoke('ai-session-send', request),
  interruptSession: threadId =>
    ipcRenderer.invoke('ai-session-interrupt', threadId),
  respondToApproval: (threadId, requestId, decision) =>
    ipcRenderer.invoke('ai-session-approval', {
      threadId,
      requestId,
      decision,
    }),
  renameSession: (threadId, title) =>
    ipcRenderer.invoke('ai-session-rename', threadId, title),
  archiveSession: threadId =>
    ipcRenderer.invoke('ai-session-archive', threadId),
  subscribe: listener => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      event: AISessionEvent
    ) => listener(event)
    ipcRenderer.on('ai-session-event', handler)
    return () => ipcRenderer.removeListener('ai-session-event', handler)
  },
}
