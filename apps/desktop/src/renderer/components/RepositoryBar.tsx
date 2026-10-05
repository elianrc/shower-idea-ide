import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleDot,
  FolderGit2,
  GitBranch,
  GitFork,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import type { BranchInfo, Project } from '../../shared/types'
import { useAppStore } from '../store'

type OpenMenu = 'repository' | 'branch' | null

export function RepositoryBar({ project }: { project: Project }) {
  const projects = useAppStore((state) => state.projects)
  const branches = useAppStore((state) => state.branches)
  const isLoading = useAppStore((state) => state.isLoading)
  const openRepository = useAppStore((state) => state.openRepository)
  const selectRepository = useAppStore((state) => state.selectRepository)
  const switchBranch = useAppStore((state) => state.switchBranch)
  const createBranch = useAppStore((state) => state.createBranch)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [branchQuery, setBranchQuery] = useState('')
  const [isCreatingBranch, setCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', closeMenus)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenus)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const filteredBranches = branchQuery
    ? branches.filter((branch) => branch.name.toLowerCase().includes(branchQuery.toLowerCase()))
    : branches

  const chooseRepository = async (projectId: string) => {
    setOpenMenu(null)
    await selectRepository(projectId)
  }

  const chooseBranch = async (branch: BranchInfo) => {
    if (branch.isCurrent || (branch.isWorktree && !branch.isCurrent)) return
    setOpenMenu(null)
    await switchBranch(branch.name)
  }

  const submitBranch = async () => {
    const name = newBranchName.trim()
    if (!name) return
    const created = await createBranch(name, project.branch)
    if (created) {
      setOpenMenu(null)
      setCreatingBranch(false)
      setNewBranchName('')
    }
  }

  return (
    <header className="repository-bar" ref={rootRef}>
      <div className="repository-bar-drag" />
      <div className="repository-control-wrap">
        <button
          aria-expanded={openMenu === 'repository'}
          className={openMenu === 'repository' ? 'repository-control active' : 'repository-control'}
          onClick={() => setOpenMenu((current) => current === 'repository' ? null : 'repository')}
          type="button"
        >
          <span className="repository-control-icon"><FolderGit2 size={18} /></span>
          <span className="repository-control-copy">
            <small>Current repository</small>
            <strong>{project.name}</strong>
          </span>
          <ChevronDown size={14} />
        </button>

        {openMenu === 'repository' ? (
          <div className="repository-popover repository-list-popover">
            <div className="popover-title">Your repositories</div>
            <div className="repository-menu-list">
              {projects.map((candidate) => (
                <button
                  className={candidate.id === project.id ? 'repository-menu-row selected' : 'repository-menu-row'}
                  key={candidate.id}
                  onClick={() => void chooseRepository(candidate.id)}
                  type="button"
                >
                  <span className="repository-row-avatar">{candidate.name.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{candidate.name}</strong><small>{candidate.path}</small></span>
                  {candidate.id === project.id ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
            <button
              className="popover-action"
              onClick={() => { setOpenMenu(null); void openRepository() }}
              type="button"
            >
              <Plus size={15} /> Add existing repository…
            </button>
          </div>
        ) : null}
      </div>

      <div className="repository-control-wrap branch-control-wrap">
        <button
          aria-expanded={openMenu === 'branch'}
          className={openMenu === 'branch' ? 'repository-control branch-control active' : 'repository-control branch-control'}
          onClick={() => setOpenMenu((current) => current === 'branch' ? null : 'branch')}
          type="button"
        >
          <span className="repository-control-icon branch"><GitBranch size={18} /></span>
          <span className="repository-control-copy">
            <small>Current branch</small>
            <strong>{project.branch}</strong>
          </span>
          <ChevronDown size={14} />
        </button>

        {openMenu === 'branch' ? (
          <div className="repository-popover branch-popover">
            {isCreatingBranch ? (
              <div className="create-branch-view">
                <div className="create-branch-heading">
                  <div><small>New branch</small><strong>Create from {project.branch}</strong></div>
                  <button aria-label="Cancel branch creation" onClick={() => setCreatingBranch(false)} type="button"><X size={15} /></button>
                </div>
                <label>
                  <span>Name</span>
                  <input
                    autoFocus
                    onChange={(event) => setNewBranchName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') void submitBranch() }}
                    placeholder="feature/branch-name"
                    value={newBranchName}
                  />
                </label>
                <button className="primary-button create-branch-button" disabled={!newBranchName.trim() || isLoading} onClick={() => void submitBranch()} type="button">
                  <GitBranch size={14} /> Create branch
                </button>
              </div>
            ) : (
              <>
                <div className="branch-search-row">
                  <label className="branch-search">
                    <Search size={14} />
                    <input autoFocus onChange={(event) => setBranchQuery(event.target.value)} placeholder="Filter branches" value={branchQuery} />
                  </label>
                  <button aria-label="Create branch" className="new-branch-button" onClick={() => setCreatingBranch(true)} type="button"><Plus size={16} /></button>
                </div>
                <div className="popover-title">Branches</div>
                <div className="branch-menu-list">
                  {filteredBranches.length === 0 ? <p className="branch-empty">No matching branches</p> : null}
                  {filteredBranches.map((branch) => (
                    <button
                      className={branch.isCurrent ? 'branch-menu-row selected' : 'branch-menu-row'}
                      disabled={branch.isWorktree && !branch.isCurrent}
                      key={branch.name}
                      onClick={() => void chooseBranch(branch)}
                      type="button"
                    >
                      {branch.isCurrent ? <Check size={14} /> : <GitBranch size={14} />}
                      <span><strong>{branch.name}</strong>{branch.isWorktree && !branch.isCurrent ? <small>Used by a task worktree</small> : null}</span>
                      {branch.updatedAt ? <time>{formatBranchAge(branch.updatedAt)}</time> : null}
                    </button>
                  ))}
                </div>
                <button className="popover-action" onClick={() => setCreatingBranch(true)} type="button"><Plus size={15} /> New branch…</button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="repository-bar-spacer" />
      <div className={project.isClean ? 'repository-state clean' : 'repository-state'}>
        <CircleDot size={14} />
        <span>{project.isClean ? 'No local changes' : 'Local changes'}</span>
      </div>
      {project.remote ? <div className="remote-state" title={project.remote}><GitFork size={14} /><span>origin</span></div> : null}
      <button aria-label="Settings" className="toolbar-icon-button" type="button"><Settings2 size={17} /></button>
    </header>
  )
}

function formatBranchAge(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime()
  const days = Math.floor(elapsed / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}
