import { Check, CircleAlert, CircleDashed, LoaderCircle, X } from 'lucide-react'
import { STATUS_LABELS, type TaskStatus } from '../../shared/types'

const workingStatuses = new Set<TaskStatus>(['planning', 'working', 'verifying', 'changes_requested'])

export function StatusPill({ status, compact = false }: { status: TaskStatus; compact?: boolean }) {
  const Icon = status === 'committed' || status === 'approved'
    ? Check
    : status === 'failed' || status === 'blocked'
      ? CircleAlert
      : status === 'cancelled'
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
