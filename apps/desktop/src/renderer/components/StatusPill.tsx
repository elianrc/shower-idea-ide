import { Check, CircleAlert, CircleDashed, LoaderCircle, X } from 'lucide-react'
import { STATUS_LABELS, type SessionStatus } from '../../shared/types'

const workingStatuses = new Set<SessionStatus>(['starting', 'running', 'verifying'])

export function StatusPill({ status, compact = false }: { status: SessionStatus; compact?: boolean }) {
  const Icon = status === 'completed'
    ? Check
    : status === 'failed'
      ? CircleAlert
      : status === 'stopped'
        ? X
        : workingStatuses.has(status)
          ? LoaderCircle
          : CircleDashed
  return (
    <span className={`status-pill status-${status}`}>
      <Icon className={workingStatuses.has(status) ? 'spin-slow' : ''} size={compact ? 12 : 13} />
      {compact ? null : STATUS_LABELS[status]}
    </span>
  )
}
