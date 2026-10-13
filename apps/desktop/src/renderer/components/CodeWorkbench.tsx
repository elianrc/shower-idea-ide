import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileCode2, FileDiff, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-react'
import { Tree, type NodeRendererProps } from 'react-arborist'
import type { ChangedFile, Project, Session, SourceFile, WorkspaceFileNode } from '../../shared/types'

const DiffViewer = lazy(() => import('./DiffViewer'))
const SourceViewer = lazy(() => import('./SourceViewer'))

type WorkbenchMode = 'diff' | 'code'

export function CodeWorkbench({ project, session }: { project: Project; session: Session | null }) {
  const sessionId = session?.id
  const workspaceKey = sessionId ?? `project:${project.id}`
  const sessionChangeKey = session?.changedFiles
    .map((file) => `${file.path}:${file.status}:${file.additions}:${file.deletions}`)
    .join('|') ?? ''
  const [mode, setMode] = useState<WorkbenchMode>(session?.changedFiles.length ? 'diff' : 'code')
  const [tree, setTree] = useState<WorkspaceFileNode[]>([])
  const [repositoryChanges, setRepositoryChanges] = useState<ChangedFile[]>([])
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(session?.changedFiles[0]?.path ?? null)
  const [source, setSource] = useState<SourceFile | null>(null)
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(null)
  const [isLoadingTree, setLoadingTree] = useState(true)
  const [isLoadingSource, setLoadingSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changedFiles = session ? session.changedFiles : repositoryChanges

  useEffect(() => {
    let active = true
    setLoadingTree(true)
    setError(null)
    setSource(null)
    setSelectedSourcePath(null)

    const requests = [window.vivlio.files.list(sessionId)] as const
    void Promise.all([
      requests[0],
      session ? Promise.resolve(session.changedFiles) : window.vivlio.files.getChangedFiles(),
    ]).then(
      ([nextTree, nextChanges]) => {
        if (!active) return
        setTree(nextTree)
        setRepositoryChanges(session ? [] : nextChanges)
        setLoadingTree(false)
      },
      (reason: unknown) => {
        if (!active) return
        setError(errorMessage(reason))
        setLoadingTree(false)
      },
    )
    return () => { active = false }
  }, [project.id, sessionId, sessionChangeKey])

  useEffect(() => {
    const firstChangedPath = changedFiles[0]?.path ?? null
    setSelectedDiffPath((current) => current && changedFiles.some((file) => file.path === current) ? current : firstChangedPath)
    setMode(changedFiles.length > 0 ? 'diff' : 'code')
  }, [workspaceKey, sessionChangeKey, repositoryChanges])

  const openSource = useCallback(async (path: string) => {
    setSelectedSourcePath(path)
    setLoadingSource(true)
    setError(null)
    try {
      setSource(await window.vivlio.files.read(path, sessionId))
    } catch (reason) {
      setSource(null)
      setError(errorMessage(reason))
    } finally {
      setLoadingSource(false)
    }
  }, [sessionId])

  return (
    <section className="code-workbench">
      <header className="workbench-header">
        <div aria-label="Code workbench mode" className="workbench-toggle" role="tablist">
          <button aria-selected={mode === 'diff'} className={mode === 'diff' ? 'active' : ''} onClick={() => setMode('diff')} role="tab" type="button">
            Diff{changedFiles.length > 0 ? <span>{changedFiles.length}</span> : null}
          </button>
          <button aria-selected={mode === 'code'} className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')} role="tab" type="button">
            Code
          </button>
        </div>
        <span className="workbench-context">{session ? session.branch : project.branch}</span>
      </header>

      {mode === 'diff' ? (
        <DiffWorkbench
          changedFiles={changedFiles}
          selectedPath={selectedDiffPath}
          sessionId={sessionId}
          setSelectedPath={setSelectedDiffPath}
        />
      ) : (
        <CodeExplorer
          error={error}
          isLoadingSource={isLoadingSource}
          isLoadingTree={isLoadingTree}
          onOpen={openSource}
          selectedPath={selectedSourcePath}
          source={source}
          tree={tree}
          workspaceKey={workspaceKey}
        />
      )}
    </section>
  )
}

function DiffWorkbench({
  changedFiles,
  selectedPath,
  sessionId,
  setSelectedPath,
}: {
  changedFiles: ChangedFile[]
  selectedPath: string | null
  sessionId?: string
  setSelectedPath(path: string): void
}) {
  if (changedFiles.length === 0) {
    return <EmptyWorkbench icon={<FileDiff size={22} />} title="No modified files" copy="Changes made in this workspace will appear here." />
  }

  return (
    <div className="workbench-body">
      <aside className="workbench-navigator diff-navigator">
        <div className="navigator-heading"><span>Modified files</span><span>{changedFiles.length}</span></div>
        <div className="modified-file-list">
          {changedFiles.map((file) => (
            <button className={selectedPath === file.path ? 'modified-file active' : 'modified-file'} key={file.path} onClick={() => setSelectedPath(file.path)} type="button">
              <span className={`change-letter change-${file.status}`}>{file.status.slice(0, 1).toUpperCase()}</span>
              <span className="modified-file-copy"><strong>{file.path.split('/').at(-1)}</strong><small>{file.path}</small></span>
              <span className="file-stats"><i>+{file.additions}</i><b>−{file.deletions}</b></span>
            </button>
          ))}
        </div>
      </aside>
      <section className="workbench-preview">
        <PreviewHeader path={selectedPath} />
        <div className="workbench-editor">
          <Suspense fallback={<LoadingWorkbench label="Loading diff…" />}>
            <DiffViewer filePath={selectedPath ?? undefined} sessionId={sessionId} />
          </Suspense>
        </div>
      </section>
    </div>
  )
}

function CodeExplorer({
  error,
  isLoadingSource,
  isLoadingTree,
  onOpen,
  selectedPath,
  source,
  tree,
  workspaceKey,
}: {
  error: string | null
  isLoadingSource: boolean
  isLoadingTree: boolean
  onOpen(path: string): void
  selectedPath: string | null
  source: SourceFile | null
  tree: WorkspaceFileNode[]
  workspaceKey: string
}) {
  const fileCount = useMemo(() => countFiles(tree), [tree])
  return (
    <div className="workbench-body">
      <aside className="workbench-navigator code-navigator">
        <div className="navigator-heading"><span>Files</span><span>{fileCount}</span></div>
        <div className="file-tree-shell">
          {isLoadingTree ? <LoadingWorkbench label="Loading files…" /> : (
            <AutoSizedTree data={tree} key={workspaceKey} onOpen={onOpen} selectedPath={selectedPath} />
          )}
        </div>
      </aside>
      <section className="workbench-preview">
        <PreviewHeader path={source?.path ?? selectedPath} />
        <div className="workbench-editor">
          {error ? <EmptyWorkbench icon={<FileText size={22} />} title="Unable to open file" copy={error} /> : null}
          {!error && isLoadingSource ? <LoadingWorkbench label="Opening file…" /> : null}
          {!error && !isLoadingSource && !source ? <EmptyWorkbench icon={<FileCode2 size={22} />} title="Explore the codebase" copy="Choose a file to preview it here. Files are read-only in Vivlio." /> : null}
          {!error && !isLoadingSource && source ? (
            <Suspense fallback={<LoadingWorkbench label="Loading code viewer…" />}>
              <SourceViewer file={source} />
            </Suspense>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function AutoSizedTree({ data, onOpen, selectedPath }: { data: WorkspaceFileNode[]; onOpen(path: string): void; selectedPath: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateHeight = () => setHeight(container.clientHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="file-tree" ref={containerRef}>
      {height > 0 ? (
        <Tree
          aria-label="Repository files"
          data={data}
          disableDrag
          disableDrop
          disableEdit
          disableMultiSelection
          height={height}
          indent={14}
          onActivate={(node) => { if (node.data.kind === 'file') onOpen(node.data.path) }}
          openByDefault={false}
          overscanCount={8}
          rowHeight={26}
          selection={selectedPath ?? undefined}
          width="100%"
        >
          {FileTreeNode}
        </Tree>
      ) : null}
    </div>
  )
}

function FileTreeNode({ node, style }: NodeRendererProps<WorkspaceFileNode>) {
  const Icon = node.data.kind === 'directory' ? node.isOpen ? FolderOpen : Folder : isCodeFile(node.data.name) ? FileCode2 : FileText
  return (
    <div
      className={node.isSelected ? 'file-tree-node selected' : 'file-tree-node'}
      onClick={(event) => {
        node.handleClick(event)
        if (node.data.kind === 'directory') node.toggle()
      }}
      style={style}
    >
      <span className="tree-chevron">{node.data.kind === 'directory' ? node.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}</span>
      <Icon size={14} />
      <span>{node.data.name}</span>
    </div>
  )
}

function PreviewHeader({ path }: { path: string | null }) {
  return <div className="preview-header"><span>{path?.split('/').at(-1) ?? 'No file selected'}</span>{path ? <small>{path}</small> : null}</div>
}

function EmptyWorkbench({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="workbench-empty">{icon}<strong>{title}</strong><p>{copy}</p></div>
}

function LoadingWorkbench({ label }: { label: string }) {
  return <div className="workbench-loading"><LoaderCircle className="spin-slow" size={15} />{label}</div>
}

function countFiles(nodes: WorkspaceFileNode[]): number {
  let count = 0
  for (const node of nodes) count += node.kind === 'file' ? 1 : countFiles(node.children ?? [])
  return count
}

function isCodeFile(name: string): boolean {
  return /\.(?:c|cc|cpp|css|go|h|hpp|html|java|js|jsx|php|py|rb|rs|scss|sh|sql|swift|ts|tsx|vue|xml|ya?ml)$/i.test(name)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
