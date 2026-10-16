import * as Path from 'path'
import * as React from 'react'
import classNames from 'classnames'

import {
  getCodeWorkspaceFileModifiedAt,
  ICodeWorkspaceEntry,
  listCodeWorkspaceEntries,
  readCodeWorkspaceFile,
  writeCodeWorkspaceFile,
} from '../../lib/code-workspace/file-system'
import { mapStatus } from '../../lib/status'
import { AppFileStatus } from '../../models/status'
import { iconForStatus, Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  createCodeWorkspaceTree,
  getCodeWorkspaceLanguage,
  ICodeWorkspaceTreeNode,
} from './model'
import { MonacoCodeEditor } from './monaco-editor'

const AutoSavePreferenceKey = 'vivlio-code-workspace-auto-save'
const AutoSaveDelay = 900
const ExternalChangeCheckInterval = 2000

export interface ICodeWorkspaceProps {
  readonly repositoryName: string
  readonly repositoryPath: string
  readonly changedFiles: ReadonlyMap<string, AppFileStatus>
  readonly isActive: boolean
  readonly isDarkTheme: boolean
  readonly onRequestReview: () => void
}

interface IOpenCodeWorkspaceDocument {
  readonly repositoryPath: string
  readonly path: string
  readonly fullPath: string
  readonly contents: string
  readonly savedContents: string
  readonly modifiedAt: number
  readonly isSaving: boolean
  readonly hasExternalChange: boolean
}

interface ICodeWorkspaceState {
  readonly entries: ReadonlyArray<ICodeWorkspaceEntry>
  readonly tree: ReadonlyArray<ICodeWorkspaceTreeNode>
  readonly expandedDirectories: ReadonlySet<string>
  readonly documents: ReadonlyArray<IOpenCodeWorkspaceDocument>
  readonly activeDocumentPath: string | null
  readonly filterText: string
  readonly isLoadingRepository: boolean
  readonly loadingFilePath: string | null
  readonly listingTruncated: boolean
  readonly autoSaveEnabled: boolean
  readonly error: string | null
}

interface ICodeWorkspaceTreeEntryProps {
  readonly node: ICodeWorkspaceTreeNode
  readonly depth: number
  readonly expandedDirectories: ReadonlySet<string>
  readonly activeDocumentPath: string | null
  readonly changedFiles: ReadonlyMap<string, AppFileStatus>
  readonly onToggleDirectory: (path: string) => void
  readonly onOpenFile: (path: string) => void
}

class CodeWorkspaceTreeEntry extends React.PureComponent<ICodeWorkspaceTreeEntryProps> {
  private onClick = () => {
    if (this.props.node.kind === 'directory') {
      this.props.onToggleDirectory(this.props.node.path)
    } else {
      this.props.onOpenFile(this.props.node.path)
    }
  }

  public render() {
    const { node, depth, expandedDirectories, changedFiles } = this.props
    const isDirectory = node.kind === 'directory'
    const isExpanded = isDirectory && expandedDirectories.has(node.path)
    const status = changedFiles.get(node.path)
    const statusLabel = status === undefined ? undefined : mapStatus(status)

    return (
      <li
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={
          !isDirectory && node.path === this.props.activeDocumentPath
        }
      >
        <button
          type="button"
          className={classNames('vivlio-file-tree-entry', {
            selected:
              !isDirectory && node.path === this.props.activeDocumentPath,
          })}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={this.onClick}
        >
          {isDirectory ? (
            <Octicon
              className="vivlio-file-tree-disclosure"
              symbol={isExpanded ? octicons.chevronDown : octicons.chevronRight}
            />
          ) : (
            <span className="vivlio-file-tree-disclosure" />
          )}
          <Octicon
            symbol={
              isDirectory
                ? isExpanded
                  ? octicons.fileDirectoryOpenFill
                  : octicons.fileDirectoryFill
                : octicons.file
            }
          />
          <span className="vivlio-file-tree-name">{node.name}</span>
          {status === undefined ? null : (
            <Octicon
              className={`status status-${statusLabel!.toLowerCase()}`}
              symbol={iconForStatus(status)}
              title={statusLabel}
            />
          )}
        </button>
        {isExpanded ? (
          <ul role="group">
            {node.children.map(child => (
              <CodeWorkspaceTreeEntry
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedDirectories={expandedDirectories}
                activeDocumentPath={this.props.activeDocumentPath}
                changedFiles={changedFiles}
                onToggleDirectory={this.props.onToggleDirectory}
                onOpenFile={this.props.onOpenFile}
              />
            ))}
          </ul>
        ) : null}
      </li>
    )
  }
}

export class CodeWorkspace extends React.Component<
  ICodeWorkspaceProps,
  ICodeWorkspaceState
> {
  private readonly editor = React.createRef<MonacoCodeEditor>()
  private readonly autoSaveTimers = new Map<string, number>()
  private repositoryLoadGeneration = 0
  private externalChangeTimer: number | null = null

  public constructor(props: ICodeWorkspaceProps) {
    super(props)

    this.state = {
      entries: [],
      tree: [],
      expandedDirectories: new Set(),
      documents: [],
      activeDocumentPath: null,
      filterText: '',
      isLoadingRepository: true,
      loadingFilePath: null,
      listingTruncated: false,
      autoSaveEnabled: localStorage.getItem(AutoSavePreferenceKey) === 'true',
      error: null,
    }
  }

  public componentDidMount() {
    window.addEventListener('beforeunload', this.onBeforeUnload)
    window.addEventListener('focus', this.checkActiveDocumentForExternalChange)
    this.externalChangeTimer = window.setInterval(
      this.checkActiveDocumentForExternalChange,
      ExternalChangeCheckInterval
    )
    void this.loadRepository()
  }

  public componentDidUpdate(prevProps: ICodeWorkspaceProps) {
    if (prevProps.repositoryPath !== this.props.repositoryPath) {
      this.clearAutoSaveTimers()
      void this.saveAll().then(saved => {
        if (saved) {
          void this.loadRepository()
        }
      })
    }
  }

  public componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    window.removeEventListener(
      'focus',
      this.checkActiveDocumentForExternalChange
    )
    if (this.externalChangeTimer !== null) {
      window.clearInterval(this.externalChangeTimer)
    }
    this.clearAutoSaveTimers()
  }

  private get activeDocument() {
    return this.state.documents.find(
      document => document.path === this.state.activeDocumentPath
    )
  }

  private onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.state.documents.some(this.isDocumentDirty)) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  private isDocumentDirty(document: IOpenCodeWorkspaceDocument) {
    return document.contents !== document.savedContents
  }

  private clearAutoSaveTimers() {
    for (const timer of this.autoSaveTimers.values()) {
      window.clearTimeout(timer)
    }
    this.autoSaveTimers.clear()
  }

  private loadRepository = async () => {
    const generation = ++this.repositoryLoadGeneration
    const repositoryPath = this.props.repositoryPath
    this.setState({
      entries: [],
      tree: [],
      expandedDirectories: new Set(),
      documents: [],
      activeDocumentPath: null,
      filterText: '',
      isLoadingRepository: true,
      listingTruncated: false,
      error: null,
    })

    try {
      const listing = await listCodeWorkspaceEntries(repositoryPath)
      if (
        generation !== this.repositoryLoadGeneration ||
        repositoryPath !== this.props.repositoryPath
      ) {
        return
      }

      this.setState({
        entries: listing.entries,
        tree: createCodeWorkspaceTree(listing.entries),
        isLoadingRepository: false,
        listingTruncated: listing.truncated,
      })
    } catch (error) {
      if (generation === this.repositoryLoadGeneration) {
        this.setState({
          isLoadingRepository: false,
          error: `Unable to read repository files: ${error}`,
        })
      }
    }
  }

  private onFilterTextChanged = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({ filterText: event.currentTarget.value })
  }

  private toggleDirectory = (path: string) => {
    this.setState(state => {
      const expandedDirectories = new Set(state.expandedDirectories)
      if (expandedDirectories.has(path)) {
        expandedDirectories.delete(path)
      } else {
        expandedDirectories.add(path)
      }
      return { expandedDirectories }
    })
  }

  private openFile = async (path: string) => {
    const openDocument = this.state.documents.find(
      document => document.path === path
    )
    if (openDocument !== undefined) {
      this.setState({ activeDocumentPath: path, error: null })
      return
    }

    const repositoryPath = this.props.repositoryPath
    this.setState({ loadingFilePath: path, error: null })
    try {
      const file = await readCodeWorkspaceFile(repositoryPath, path)
      if (repositoryPath !== this.props.repositoryPath) {
        return
      }

      const document: IOpenCodeWorkspaceDocument = {
        repositoryPath,
        path,
        fullPath: Path.join(repositoryPath, path),
        contents: file.contents,
        savedContents: file.contents,
        modifiedAt: file.modifiedAt,
        isSaving: false,
        hasExternalChange: false,
      }
      this.setState(state => ({
        documents: [...state.documents, document],
        activeDocumentPath: path,
      }))
    } catch (error) {
      this.setState({ error: `Unable to open ${path}: ${error}` })
    } finally {
      if (repositoryPath === this.props.repositoryPath) {
        this.setState({ loadingFilePath: null })
      }
    }
  }

  private selectDocument = (event: React.MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path
    if (path !== undefined) {
      this.setState({ activeDocumentPath: path, error: null })
    }
  }

  private closeDocument = (event: React.MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path
    const document = this.state.documents.find(item => item.path === path)
    if (path === undefined || document === undefined) {
      return
    }

    if (
      this.isDocumentDirty(document) &&
      !window.confirm(`Close ${document.path} without saving your changes?`)
    ) {
      return
    }

    const documents = this.state.documents.filter(item => item.path !== path)
    const activeDocumentPath =
      this.state.activeDocumentPath === path
        ? documents[documents.length - 1]?.path ?? null
        : this.state.activeDocumentPath

    this.editor.current?.disposeModel(document.fullPath)
    this.setState({ documents, activeDocumentPath })
  }

  private onEditorChanged = (contents: string) => {
    const activePath = this.state.activeDocumentPath
    if (activePath === null) {
      return
    }

    this.setState(
      state => ({
        documents: state.documents.map(document =>
          document.path === activePath ? { ...document, contents } : document
        ),
      }),
      () => {
        if (this.state.autoSaveEnabled) {
          this.scheduleAutoSave(activePath)
        }
      }
    )
  }

  private scheduleAutoSave(path: string) {
    const existingTimer = this.autoSaveTimers.get(path)
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer)
    }
    this.autoSaveTimers.set(
      path,
      window.setTimeout(() => {
        this.autoSaveTimers.delete(path)
        void this.saveDocument(path)
      }, AutoSaveDelay)
    )
  }

  private saveDocument = async (path: string) => {
    const document = this.state.documents.find(item => item.path === path)
    if (
      document === undefined ||
      document.isSaving ||
      !this.isDocumentDirty(document)
    ) {
      return true
    }

    this.setDocument(path, { isSaving: true })
    try {
      const currentModifiedAt = await getCodeWorkspaceFileModifiedAt(
        document.repositoryPath,
        document.path
      )
      if (
        !document.hasExternalChange &&
        currentModifiedAt !== document.modifiedAt
      ) {
        this.setDocument(path, {
          isSaving: false,
          hasExternalChange: true,
        })
        this.setState({
          error: `${document.path} changed on disk. Review the warning before overwriting it.`,
        })
        return false
      }

      const contentsToSave = document.contents
      const modifiedAt = await writeCodeWorkspaceFile(
        document.repositoryPath,
        document.path,
        contentsToSave
      )
      this.setState(state => ({
        documents: state.documents.map(item =>
          item.path === path
            ? {
                ...item,
                savedContents: contentsToSave,
                modifiedAt,
                isSaving: false,
                hasExternalChange: false,
              }
            : item
        ),
        error: null,
      }))
      return true
    } catch (error) {
      this.setDocument(path, { isSaving: false })
      this.setState({ error: `Unable to save ${path}: ${error}` })
      return false
    }
  }

  private setDocument(
    path: string,
    update: Partial<IOpenCodeWorkspaceDocument>
  ) {
    this.setState(state => ({
      documents: state.documents.map(document =>
        document.path === path ? { ...document, ...update } : document
      ),
    }))
  }

  public saveAll = async () => {
    const dirtyPaths = this.state.documents
      .filter(this.isDocumentDirty)
      .map(document => document.path)
    const results = await Promise.all(
      dirtyPaths.map(path => this.saveDocument(path))
    )
    return results.every(Boolean)
  }

  private saveActiveDocument = () => {
    if (this.state.activeDocumentPath !== null) {
      void this.saveDocument(this.state.activeDocumentPath)
    }
  }

  private saveAllDocuments = () => {
    void this.saveAll()
  }

  private onEditorBlurred = () => {
    if (this.state.autoSaveEnabled && this.state.activeDocumentPath !== null) {
      void this.saveDocument(this.state.activeDocumentPath)
    }
  }

  private onAutoSaveChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const autoSaveEnabled = event.currentTarget.checked
    localStorage.setItem(AutoSavePreferenceKey, String(autoSaveEnabled))
    this.setState({ autoSaveEnabled }, () => {
      if (autoSaveEnabled) {
        void this.saveAll()
      } else {
        this.clearAutoSaveTimers()
      }
    })
  }

  private checkActiveDocumentForExternalChange = async () => {
    const document = this.activeDocument
    if (document === undefined || document.isSaving || !this.props.isActive) {
      return
    }

    try {
      const modifiedAt = await getCodeWorkspaceFileModifiedAt(
        document.repositoryPath,
        document.path
      )
      if (modifiedAt === document.modifiedAt) {
        return
      }

      if (this.isDocumentDirty(document)) {
        this.setDocument(document.path, { hasExternalChange: true })
      } else {
        await this.reloadDocument(document.path)
      }
    } catch (error) {
      this.setState({
        error: `Unable to check ${document.path} for external changes: ${error}`,
      })
    }
  }

  private reloadActiveDocument = () => {
    if (this.state.activeDocumentPath !== null) {
      void this.reloadDocument(this.state.activeDocumentPath)
    }
  }

  private reloadDocument = async (path: string) => {
    const document = this.state.documents.find(item => item.path === path)
    if (document === undefined) {
      return
    }

    try {
      const file = await readCodeWorkspaceFile(
        document.repositoryPath,
        document.path
      )
      this.setState(state => ({
        documents: state.documents.map(item =>
          item.path === path
            ? {
                ...item,
                contents: file.contents,
                savedContents: file.contents,
                modifiedAt: file.modifiedAt,
                hasExternalChange: false,
              }
            : item
        ),
        error: null,
      }))
    } catch (error) {
      this.setState({ error: `Unable to reload ${path}: ${error}` })
    }
  }

  private keepLocalDocument = async () => {
    const document = this.activeDocument
    if (document === undefined) {
      return
    }

    try {
      const modifiedAt = await getCodeWorkspaceFileModifiedAt(
        document.repositoryPath,
        document.path
      )
      this.setDocument(document.path, {
        modifiedAt,
        hasExternalChange: false,
      })
      this.setState({ error: null })
    } catch (error) {
      this.setState({ error: `Unable to inspect ${document.path}: ${error}` })
    }
  }

  private requestReview = async () => {
    const saved = await this.saveAll()
    if (saved) {
      this.props.onRequestReview()
    }
  }

  private refreshRepository = async () => {
    const saved = await this.saveAll()
    if (saved) {
      await this.loadRepository()
    }
  }

  private renderExplorerContents() {
    if (this.state.isLoadingRepository) {
      return <p className="vivlio-code-workspace-message">Loading files…</p>
    }

    const filterText = this.state.filterText.trim().toLowerCase()
    if (filterText !== '') {
      const files = this.state.entries
        .filter(
          entry =>
            entry.kind === 'file' &&
            entry.path.toLowerCase().includes(filterText)
        )
        .slice(0, 250)

      return files.length === 0 ? (
        <p className="vivlio-code-workspace-message">No matching files</p>
      ) : (
        <ul className="vivlio-file-search-results">
          {files.map(file => (
            <li key={file.path}>
              <button
                type="button"
                data-path={file.path}
                onClick={this.openFileFromEvent}
              >
                <Octicon symbol={octicons.file} />
                <span>{file.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )
    }

    return (
      <ul
        className="vivlio-file-tree"
        role="tree"
        aria-label="Repository files"
      >
        {this.state.tree.map(node => (
          <CodeWorkspaceTreeEntry
            key={node.path}
            node={node}
            depth={0}
            expandedDirectories={this.state.expandedDirectories}
            activeDocumentPath={this.state.activeDocumentPath}
            changedFiles={this.props.changedFiles}
            onToggleDirectory={this.toggleDirectory}
            onOpenFile={this.openFile}
          />
        ))}
      </ul>
    )
  }

  private openFileFromEvent = (event: React.MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.dataset.path
    if (path !== undefined) {
      void this.openFile(path)
    }
  }

  private renderTabs() {
    return (
      <div
        className="vivlio-editor-tabs"
        role="tablist"
        aria-label="Open files"
      >
        {this.state.documents.map(document => {
          const isDirty = this.isDocumentDirty(document)
          const isActive = document.path === this.state.activeDocumentPath
          return (
            <div
              className={classNames('vivlio-editor-tab', {
                selected: isActive,
              })}
              key={document.path}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                data-path={document.path}
                onClick={this.selectDocument}
              >
                <span>{Path.basename(document.path)}</span>
                {isDirty ? (
                  <>
                    <span className="vivlio-editor-dirty" aria-hidden="true">
                      ●
                    </span>
                    <span className="sr-only">Unsaved changes</span>
                  </>
                ) : null}
              </button>
              <button
                type="button"
                className="vivlio-editor-tab-close"
                data-path={document.path}
                onClick={this.closeDocument}
                aria-label={`Close ${document.path}`}
              >
                <Octicon symbol={octicons.x} />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  private renderEditor() {
    const document = this.activeDocument
    if (document === undefined) {
      return (
        <div className="vivlio-code-workspace-empty">
          <Octicon symbol={octicons.fileCode} />
          <h1>Open a file to start editing</h1>
          <p>
            Select a repository file. Saved edits appear in Review as ordinary
            Git changes.
          </p>
        </div>
      )
    }

    return (
      <>
        {document.hasExternalChange ? (
          <div className="vivlio-editor-warning" role="alert">
            <span>This file changed on disk while you were editing it.</span>
            <button type="button" onClick={this.reloadActiveDocument}>
              Reload from disk
            </button>
            <button type="button" onClick={this.keepLocalDocument}>
              Keep my version
            </button>
          </div>
        ) : null}
        <MonacoCodeEditor
          ref={this.editor}
          filePath={document.fullPath}
          value={document.contents}
          language={getCodeWorkspaceLanguage(document.path)}
          isActive={this.props.isActive}
          isDarkTheme={this.props.isDarkTheme}
          onChange={this.onEditorChanged}
          onSave={this.saveActiveDocument}
          onBlur={this.onEditorBlurred}
        />
        <footer className="vivlio-editor-status-bar">
          <span>{document.path}</span>
          <span>{getCodeWorkspaceLanguage(document.path)}</span>
          <span>
            {document.isSaving
              ? 'Saving…'
              : this.isDocumentDirty(document)
              ? 'Unsaved'
              : 'Saved'}
          </span>
        </footer>
      </>
    )
  }

  public render() {
    const canSave = this.state.documents.some(this.isDocumentDirty)

    return (
      <main className="vivlio-code-workspace">
        <aside className="vivlio-code-explorer">
          <header>
            <div>
              <strong>{this.props.repositoryName}</strong>
              <span>
                {
                  this.state.entries.filter(entry => entry.kind === 'file')
                    .length
                }{' '}
                files
              </span>
            </div>
            <button
              type="button"
              onClick={this.refreshRepository}
              aria-label="Refresh repository files"
            >
              <Octicon symbol={octicons.sync} />
            </button>
          </header>
          <label className="vivlio-file-filter">
            <Octicon symbol={octicons.search} />
            <span className="sr-only">Filter repository files</span>
            <input
              type="search"
              value={this.state.filterText}
              onChange={this.onFilterTextChanged}
              placeholder="Filter files"
            />
          </label>
          <div className="vivlio-code-explorer-scroll">
            {this.renderExplorerContents()}
          </div>
          {this.state.listingTruncated ? (
            <p className="vivlio-code-explorer-limit">
              Showing the first 5,000 repository entries.
            </p>
          ) : null}
        </aside>
        <section className="vivlio-editor-pane" aria-label="Code editor">
          <header className="vivlio-editor-toolbar">
            {this.renderTabs()}
            <div className="vivlio-editor-actions">
              <label>
                <input
                  type="checkbox"
                  checked={this.state.autoSaveEnabled}
                  onChange={this.onAutoSaveChanged}
                />
                Auto save
              </label>
              <button
                type="button"
                onClick={this.saveAllDocuments}
                disabled={!canSave}
              >
                Save all
              </button>
              <button type="button" onClick={this.requestReview}>
                Review changes
              </button>
            </div>
          </header>
          {this.state.error === null ? null : (
            <div className="vivlio-code-workspace-error" role="alert">
              {this.state.error}
            </div>
          )}
          {this.state.loadingFilePath === null ? null : (
            <div className="vivlio-code-workspace-loading-file">
              Opening {this.state.loadingFilePath}…
            </div>
          )}
          <div className="vivlio-editor-content">{this.renderEditor()}</div>
        </section>
      </main>
    )
  }
}
