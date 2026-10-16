export type AISessionProvider = 'codex'

export type AISessionStatus =
  | 'starting'
  | 'idle'
  | 'running'
  | 'waiting-for-approval'
  | 'failed'
  | 'interrupted'
  | 'disconnected'

export type AISessionItemKind =
  | 'user'
  | 'assistant'
  | 'plan'
  | 'reasoning'
  | 'command'
  | 'file-change'
  | 'tool'
  | 'status'
  | 'error'

export interface IAISessionItem {
  readonly id: string
  readonly kind: AISessionItemKind
  readonly title?: string
  readonly text: string
  readonly status?: string
  readonly detail?: string
}

export type AIApprovalKind = 'command' | 'file-change' | 'permissions'

export type AIApprovalDecision =
  | 'accept'
  | 'acceptForSession'
  | 'decline'
  | 'cancel'

export interface IAIApprovalRequest {
  readonly requestId: string | number
  readonly threadId: string
  readonly turnId: string
  readonly itemId: string
  readonly kind: AIApprovalKind
  readonly title: string
  readonly detail: string
  readonly command?: string
  readonly cwd?: string
  readonly reason?: string
  readonly requestedPermissions?: {
    readonly network?: unknown
    readonly fileSystem?: unknown
  }
}

export interface IAISessionSnapshot {
  readonly threadId: string
  readonly provider: AISessionProvider
  readonly repositoryPath: string
  readonly title: string
  readonly model: string | null
  readonly status: AISessionStatus
  readonly currentTurnId: string | null
  readonly items: ReadonlyArray<IAISessionItem>
  readonly approvals: ReadonlyArray<IAIApprovalRequest>
  readonly createdAt: number
  readonly updatedAt: number
  readonly error: string | null
}

export interface IAISessionCatalogEntry {
  readonly threadId: string
  readonly provider: AISessionProvider
  readonly repositoryPath: string
  readonly repositoryName: string
  readonly title: string
  readonly model: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface IAISessionModel {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly isDefault: boolean
}

export interface IAISessionRuntimeInfo {
  readonly provider: AISessionProvider
  readonly available: boolean
  readonly authenticated: boolean | null
  readonly executablePath: string | null
  readonly version: string | null
  readonly accountLabel: string | null
  readonly models: ReadonlyArray<IAISessionModel>
  readonly error: string | null
}

export interface IStartAISessionRequest {
  readonly repositoryPath: string
  readonly title?: string
  readonly model?: string
}

export interface IResumeAISessionRequest {
  readonly threadId: string
  readonly repositoryPath: string
}

export interface ISendAISessionMessageRequest {
  readonly threadId: string
  readonly repositoryPath: string
  readonly text: string
}

export interface IAISessionApprovalResponse {
  readonly threadId: string
  readonly requestId: string | number
  readonly decision: AIApprovalDecision
}

export type AISessionEvent =
  | {
      readonly type: 'session-updated'
      readonly session: IAISessionSnapshot
    }
  | {
      readonly type: 'runtime-changed'
      readonly runtime: IAISessionRuntimeInfo
    }
