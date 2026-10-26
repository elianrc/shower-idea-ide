import * as React from 'react'
import * as Monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/languages/definitions/cpp/register'
import 'monaco-editor/languages/definitions/csharp/register'
import 'monaco-editor/languages/definitions/css/register'
import 'monaco-editor/languages/definitions/dockerfile/register'
import 'monaco-editor/languages/definitions/go/register'
import 'monaco-editor/languages/definitions/html/register'
import 'monaco-editor/languages/definitions/ini/register'
import 'monaco-editor/languages/definitions/java/register'
import 'monaco-editor/languages/definitions/javascript/register'
import 'monaco-editor/languages/definitions/markdown/register'
import 'monaco-editor/languages/definitions/php/register'
import 'monaco-editor/languages/definitions/python/register'
import 'monaco-editor/languages/definitions/ruby/register'
import 'monaco-editor/languages/definitions/rust/register'
import 'monaco-editor/languages/definitions/scss/register'
import 'monaco-editor/languages/definitions/shell/register'
import 'monaco-editor/languages/definitions/sql/register'
import 'monaco-editor/languages/definitions/swift/register'
import 'monaco-editor/languages/definitions/typescript/register'
import 'monaco-editor/languages/definitions/xml/register'
import 'monaco-editor/languages/definitions/yaml/register'

Monaco.languages.register({
  id: 'json',
  extensions: ['.json'],
  aliases: ['JSON', 'json'],
  mimetypes: ['application/json'],
})
Monaco.languages.setMonarchTokensProvider('json', {
  tokenizer: {
    root: [
      [/[{}[\]]/, '@brackets'],
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'key'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/[,:]/, 'delimiter'],
    ],
  },
})

Monaco.editor.defineTheme('vivlio-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'FF7B72' },
    { token: 'keyword.json', foreground: 'FF7B72' },
    { token: 'string', foreground: 'A5D6FF' },
    { token: 'string.key.json', foreground: 'D2A8FF' },
    { token: 'number', foreground: '79C0FF' },
    { token: 'type', foreground: 'FF7B72' },
    { token: 'function', foreground: 'D2A8FF' },
    { token: 'annotation', foreground: 'FFA657' },
    { token: 'comment', foreground: '8A919A' },
  ],
  colors: {
    'editor.background': '#1F2226',
    'editor.foreground': '#ECEEF0',
    'editorLineNumber.foreground': '#88909A',
    'editorLineNumber.activeForeground': '#ECEEF0',
    'editor.lineHighlightBackground': '#2A2F37',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#3A3D41',
    'editorCursor.foreground': '#ECEEF0',
    'editorIndentGuide.background1': '#34383D',
    'editorIndentGuide.activeBackground1': '#59616B',
  },
})

interface IMonacoCodeEditorProps {
  readonly filePath: string
  readonly value: string
  readonly language: string
  readonly isActive: boolean
  readonly isDarkTheme: boolean
  readonly onChange: (value: string) => void
  readonly onSave: () => void
  readonly onBlur: () => void
  readonly onCursorPositionChanged: (line: number, column: number) => void
}

export class MonacoCodeEditor extends React.PureComponent<IMonacoCodeEditorProps> {
  private readonly container = React.createRef<HTMLDivElement>()
  private readonly createdModels = new Set<Monaco.editor.ITextModel>()
  private editor: Monaco.editor.IStandaloneCodeEditor | null = null
  private changingModel = false

  public componentDidMount() {
    const container = this.container.current
    if (container === null) {
      return
    }

    this.editor = Monaco.editor.create(container, {
      automaticLayout: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
      fontSize: 13,
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      ariaLabel: `Code editor for ${this.props.filePath}`,
    })

    this.editor.onDidChangeModelContent(() => {
      if (!this.changingModel) {
        this.props.onChange(this.editor?.getValue() ?? '')
      }
    })
    this.editor.onDidBlurEditorText(this.props.onBlur)
    this.editor.onDidChangeCursorPosition(event => {
      this.props.onCursorPositionChanged(
        event.position.lineNumber,
        event.position.column
      )
    })
    this.editor.addAction({
      id: 'vivlio.save-file',
      label: 'Save File',
      keybindings: [Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS],
      run: () => this.props.onSave(),
    })

    this.updateTheme()
    this.updateModel()
  }

  public componentDidUpdate(prevProps: IMonacoCodeEditorProps) {
    if (
      prevProps.filePath !== this.props.filePath ||
      prevProps.language !== this.props.language ||
      prevProps.value !== this.props.value
    ) {
      this.updateModel()
    }

    if (prevProps.isDarkTheme !== this.props.isDarkTheme) {
      this.updateTheme()
    }

    if (!prevProps.isActive && this.props.isActive) {
      requestAnimationFrame(() => this.editor?.layout())
    }
  }

  public componentWillUnmount() {
    this.editor?.dispose()
    for (const model of this.createdModels) {
      model.dispose()
    }
    this.createdModels.clear()
  }

  public disposeModel(filePath: string) {
    const model = Monaco.editor.getModel(Monaco.Uri.file(filePath))
    if (model !== null && this.createdModels.has(model)) {
      this.createdModels.delete(model)
      model.dispose()
    }
  }

  private updateTheme() {
    Monaco.editor.setTheme(this.props.isDarkTheme ? 'vivlio-dark' : 'vs')
  }

  private updateModel() {
    const editor = this.editor
    if (editor === null) {
      return
    }

    const uri = Monaco.Uri.file(this.props.filePath)
    let model = Monaco.editor.getModel(uri)

    this.changingModel = true
    try {
      if (model === null) {
        model = Monaco.editor.createModel(
          this.props.value,
          this.props.language,
          uri
        )
        this.createdModels.add(model)
      } else {
        Monaco.editor.setModelLanguage(model, this.props.language)
        if (model.getValue() !== this.props.value) {
          model.setValue(this.props.value)
        }
      }

      editor.setModel(model)
      editor.updateOptions({
        ariaLabel: `Code editor for ${this.props.filePath}`,
      })
    } finally {
      this.changingModel = false
    }
  }

  public render() {
    return <div className="vivlio-monaco-editor" ref={this.container} />
  }
}
