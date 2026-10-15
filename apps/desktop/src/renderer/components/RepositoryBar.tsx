import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  FolderTree,
  FolderGit2,
  GitBranch,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  Search,
  X,
} from 'lucide-react'
import type { BranchInfo, Project, Session } from '../../shared/types'
import { STATUS_LABELS } from '../../shared/types'
import { useAppStore } from '../store'
import { StatusPill } from './StatusPill'

type OpenMenu = 'repository' | 'workspace' | 'branch' | null

export function RepositoryBar({ project, selectedSession }: { project: Project; selectedSession: Session | null }) {
  const projects = useAppStore((state) => state.projects)
  const sessions = useAppStore((state) => state.sessions)
  const branches = useAppStore((state) => state.branches)
  const repositoryStatus = useAppStore((state) => state.repositoryStatus)
  const githubAuth = useAppStore((state) => state.githubAuth)
  const isSigningInToGitHub = useAppStore((state) => state.isSigningInToGitHub)
  const isLoading = useAppStore((state) => state.isLoading)
  const openRepository = useAppStore((state) => state.openRepository)
  const selectRepository = useAppStore((state) => state.selectRepository)
  const switchBranch = useAppStore((state) => state.switchBranch)
  const createBranch = useAppStore((state) => state.createBranch)
  const fetchOrigin = useAppStore((state) => state.fetchOrigin)
  const signInWithGitHub = useAppStore((state) => state.signInWithGitHub)
  const signOutFromGitHub = useAppStore((state) => state.signOutFromGitHub)
  const selectSession = useAppStore((state) => state.selectSession)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [branchQuery, setBranchQuery] = useState('')
  const [isCreatingBranch, setCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [isFetching, setFetching] = useState(false)
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
  const projectSessions = sessions.filter((session) => session.projectId === project.id)
  const activeSessions = projectSessions.filter((session) => session.status !== 'completed')
  const completedSessions = projectSessions.filter((session) => session.status === 'completed').slice(0, 3)
  const displayedBranch = selectedSession?.branch ?? repositoryStatus?.branch ?? project.branch
  const hasOrigin = repositoryStatus?.hasRemote ?? Boolean(project.remote)
  const syncDetail = !hasOrigin
    ? 'No origin remote'
    : !repositoryStatus
      ? 'Checking status…'
      : !repositoryStatus.isClean
        ? 'Local changes'
        : repositoryStatus.behind > 0
          ? `${repositoryStatus.behind} incoming ${repositoryStatus.behind === 1 ? 'commit' : 'commits'}`
          : repositoryStatus.ahead > 0
            ? `${repositoryStatus.ahead} ${repositoryStatus.ahead === 1 ? 'commit' : 'commits'} ahead`
            : 'Up to date'

  const chooseRepository = async (projectId: string) => {
    setOpenMenu(null)
    await selectRepository(projectId)
  }

  const chooseBranch = async (branch: BranchInfo) => {
    if (branch.isCurrent || (branch.isWorktree && !branch.isCurrent)) return
    setOpenMenu(null)
    await switchBranch(branch.name)
  }

  const chooseWorkspace = (sessionId: string | null) => {
    setOpenMenu(null)
    if (sessionId) {
      selectSession(sessionId)
    } else {
      selectSession(null)
    }
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

  const updateOrigin = async () => {
    if (!hasOrigin || isFetching) return
    setFetching(true)
    await fetchOrigin(selectedSession?.id)
    setFetching(false)
  }

  return (
    <header className="repository-bar" ref={rootRef}>
      <div className="repository-bar-drag" />
      <div className="repository-control-wrap repository-selector-wrap">
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
            <div className="github-account-section">
              <div className="popover-title">GitHub account</div>
              {githubAuth.signedIn && githubAuth.user ? (
                <div className="github-account-row">
                  <img alt="" src={githubAuth.user.avatarUrl} />
                  <span>
                    <strong>{githubAuth.user.name ?? githubAuth.user.login}</strong>
                    <small>@{githubAuth.user.login}</small>
                  </span>
                  <button aria-label="Sign out of GitHub" onClick={() => void signOutFromGitHub()} type="button">
                    <LogOut size={15} /> <span>Sign out</span>
                  </button>
                </div>
              ) : githubAuth.configured ? (
                <button
                  className="github-sign-in-action"
                  disabled={isSigningInToGitHub}
                  onClick={() => void signInWithGitHub()}
                  type="button"
                >
                  {isSigningInToGitHub ? <LoaderCircle className="spin-slow" size={16} /> : <LogIn size={16} />}
                  <span><strong>{isSigningInToGitHub ? 'Waiting for GitHub…' : 'Sign in with GitHub'}</strong><small>Fetch private repositories without Terminal setup</small></span>
                </button>
              ) : (
                <p className="github-account-unavailable">Sign-in is not configured in this build.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="repository-control-wrap workspace-control-wrap">
        <button
          aria-expanded={openMenu === 'workspace'}
          className={openMenu === 'workspace' ? 'repository-control workspace-control active' : 'repository-control workspace-control'}
          onClick={() => setOpenMenu((current) => current === 'workspace' ? null : 'workspace')}
          type="button"
        >
          <span className="repository-control-icon workspace"><FolderTree size={18} /></span>
          <span className="repository-control-copy">
            <small>Active workspace</small>
            <strong>{selectedSession?.title ?? 'Main workspace'}</strong>
          </span>
          <ChevronDown size={14} />
        </button>

        {openMenu === 'workspace' ? (
          <div className="repository-popover workspace-popover">
            <div className="popover-title">Main workspace</div>
            <div className="repository-menu-list workspace-menu-list">
              <button
                className={!selectedSession ? 'workspace-menu-row selected' : 'workspace-menu-row'}
                onClick={() => chooseWorkspace(null)}
                type="button"
              >
                <span className="workspace-row-icon"><FolderGit2 size={15} /></span>
                <span className="workspace-row-copy">
                  <strong>{project.name}</strong>
                  <small>{project.branch} · direct workspace</small>
                </span>
                {!selectedSession ? <Check size={15} /> : null}
              </button>
            </div>

            <div className="popover-title workspace-section-title">Agent session workspaces</div>
            <div className="repository-menu-list workspace-menu-list task-worktree-list">
              {activeSessions.length === 0 ? <p className="branch-empty">No active sessions</p> : null}
              {activeSessions.map((session) => (
                <button
                  className={selectedSession?.id === session.id ? 'workspace-menu-row selected' : 'workspace-menu-row'}
                  key={session.id}
                  onClick={() => chooseWorkspace(session.id)}
                  type="button"
                >
                  <StatusPill compact status={session.status} />
                  <span className="workspace-row-copy">
                    <strong>{session.title}</strong>
                    <small>{session.branch} · {STATUS_LABELS[session.status]}</small>
                  </span>
                  {selectedSession?.id === session.id ? <Check size={15} /> : null}
                </button>
              ))}
            </div>

            {completedSessions.length > 0 ? (
              <>
                <div className="popover-title workspace-section-title">Recently completed</div>
                <div className="repository-menu-list workspace-menu-list completed-worktree-list">
                  {completedSessions.map((session) => (
                    <button className="workspace-menu-row" key={session.id} onClick={() => chooseWorkspace(session.id)} type="button">
                      <StatusPill compact status={session.status} />
                      <span className="workspace-row-copy"><strong>{session.title}</strong><small>{session.commit ?? session.branch}</small></span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="repository-control-wrap branch-control-wrap">
        <button
          aria-expanded={openMenu === 'branch'}
          className={openMenu === 'branch' ? 'repository-control branch-control active' : 'repository-control branch-control'}
          disabled={Boolean(selectedSession)}
          onClick={() => setOpenMenu((current) => current === 'branch' ? null : 'branch')}
          title={selectedSession ? 'Return to the main workspace to switch branches.' : undefined}
          type="button"
        >
          <span className="repository-control-icon branch"><GitBranch size={18} /></span>
          <span className="repository-control-copy">
            <small>{selectedSession ? 'Session branch' : 'Current branch'}</small>
            <strong>{displayedBranch}</strong>
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
                      <span><strong>{branch.name}</strong>{branch.isWorktree && !branch.isCurrent ? <small>Used by a session worktree</small> : null}</span>
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
      <button
        aria-label={`Fetch origin. ${syncDetail}`}
        className="repository-sync-control"
        disabled={!hasOrigin || isFetching}
        onClick={() => void updateOrigin()}
        type="button"
      >
        {isFetching ? <LoaderCircle className="spin-slow" size={16} /> : <ArrowDownToLine size={16} />}
        <span><strong>Fetch origin</strong><small>{syncDetail}</small></span>
        {repositoryStatus && !repositoryStatus.isClean ? <i aria-label="Uncommitted local changes" /> : null}
      </button>
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
