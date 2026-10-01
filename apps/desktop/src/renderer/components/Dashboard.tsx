import { ArrowUpRight, Check, FileCode2, GitCommitHorizontal, Plus, Sparkles } from 'lucide-react'
import type { Project, Task } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

export function Dashboard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const selectTask = useAppStore((state) => state.selectTask)
  const setNewTaskOpen = useAppStore((state) => state.setNewTaskOpen)
  const active = tasks.filter((task) => !['committed', 'cancelled'].includes(task.status))
  const recent = tasks.filter((task) => ['committed', 'cancelled'].includes(task.status)).slice(0, 4)

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>{project.name}</h1>
          <div className="repo-meta">
            <span>{project.branch}</span>
            <span className="meta-separator">/</span>
            <span>{project.isClean ? 'Working tree clean' : 'Uncommitted changes'}</span>
          </div>
        </div>
        <button className="primary-button" onClick={() => setNewTaskOpen(true)} type="button">
          <Plus size={17} /> New task
        </button>
      </header>

      {active.length === 0 ? (
        <section className="empty-dashboard">
          <div className="empty-orbit">
            <Sparkles size={25} />
          </div>
          <h2>What should change?</h2>
          <p>Start with the outcome. The agent will explore the codebase, implement it in isolation, and bring the result back for review.</p>
          <button className="secondary-button" onClick={() => setNewTaskOpen(true)} type="button">
            Create your first task <ArrowUpRight size={15} />
          </button>
        </section>
      ) : (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Active tasks</h2>
            <span>{active.length}</span>
          </div>
          <div className="task-grid">
            {active.map((task) => <TaskCard key={task.id} onOpen={() => selectTask(task.id)} task={task} />)}
          </div>
        </section>
      )}

      <section className="dashboard-section recent-section">
        <div className="section-heading">
          <h2>Recent work</h2>
        </div>
        {recent.length === 0 ? (
          <div className="quiet-empty"><GitCommitHorizontal size={18} /> Approved tasks will appear here.</div>
        ) : (
          <div className="recent-list">
            {recent.map((task) => (
              <button className="recent-row" key={task.id} onClick={() => selectTask(task.id)} type="button">
                <span className="recent-check"><Check size={14} /></span>
                <span className="recent-title">{task.title}</span>
                <span>{task.changedFiles.length} files</span>
                <span>{formatRelativeTime(task.updatedAt)}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TaskCard({ task, onOpen }: { task: Task; onOpen(): void }) {
  const additions = task.changedFiles.reduce((sum, file) => sum + file.additions, 0)
  const deletions = task.changedFiles.reduce((sum, file) => sum + file.deletions, 0)
  const lastActivity = task.activity.at(-1)
  return (
    <button className="task-card" onClick={onOpen} type="button">
      <div className="task-card-top">
        <StatusPill status={task.status} />
        <ArrowUpRight className="task-card-arrow" size={16} />
      </div>
      <h3>{task.title}</h3>
      <p>{lastActivity?.text ?? 'Preparing the isolated workspace…'}</p>
      <div className="task-card-footer">
        <span><FileCode2 size={14} /> {task.changedFiles.length} files</span>
        <span className="diff-add">+{additions}</span>
        <span className="diff-remove">−{deletions}</span>
        <span className="task-time">{formatRelativeTime(task.updatedAt)}</span>
      </div>
    </button>
  )
}

function formatRelativeTime(value: string): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
