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
import {
  getFontStack,
  getThemeColors,
  IAppearanceCustomization,
} from '../lib/appearance-customization'
import { ApplicationTheme } from '../lib/application-theme'

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

const CustomMonacoTheme = 'vivlio-custom'

function withoutHash(color: string) {
  return color.startsWith('#') ? color.slice(1) : color
}

function defineVivlioTheme(
  isDarkTheme: boolean,
  customization: IAppearanceCustomization
) {
  const colors = getThemeColors(
    isDarkTheme ? ApplicationTheme.Dark : ApplicationTheme.Light,
    customization
  )
  const syntaxColors = isDarkTheme
    ? {
        keyword: 'FF7B72',
        string: 'A5D6FF',
        symbol: 'D2A8FF',
        number: '79C0FF',
        annotation: 'FFA657',
      }
    : {
        keyword: 'B31D28',
        string: '0550AE',
        symbol: '8250DF',
        number: '0550AE',
        annotation: '953800',
      }

  Monaco.editor.defineTheme(CustomMonacoTheme, {
    base: isDarkTheme ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: syntaxColors.keyword },
      { token: 'keyword.json', foreground: syntaxColors.keyword },
      { token: 'string', foreground: syntaxColors.string },
      { token: 'string.key.json', foreground: syntaxColors.symbol },
      { token: 'number', foreground: syntaxColors.number },
      { token: 'type', foreground: syntaxColors.keyword },
      { token: 'function', foreground: syntaxColors.symbol },
      { token: 'annotation', foreground: syntaxColors.annotation },
      { token: 'comment', foreground: withoutHash(colors.secondaryText) },
    ],
    colors: {
      'editor.background': colors.editor,
      'editor.foreground': colors.text,
      'editorLineNumber.foreground': colors.secondaryText,
      'editorLineNumber.activeForeground': colors.text,
      'editor.lineHighlightBackground': colors.surface,
      'editor.selectionBackground': `${colors.accent}66`,
      'editor.inactiveSelectionBackground': `${colors.accent}33`,
      'editorCursor.foreground': colors.text,
      'editorIndentGuide.background1': colors.border,
      'editorIndentGuide.activeBackground1': colors.secondaryText,
    },
  })
}

interface IMonacoCodeEditorProps {
  readonly filePath: string
  readonly value: string
  readonly language: string
  readonly isActive: boolean
  readonly isDarkTheme: boolean
  readonly appearanceCustomization: IAppearanceCustomization
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
      fontFamily: getFontStack(
        this.props.appearanceCustomization.codeFont,
        true
      ),
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

    if (
      prevProps.isDarkTheme !== this.props.isDarkTheme ||
      prevProps.appearanceCustomization !== this.props.appearanceCustomization
    ) {
      this.updateTheme()
    }

    if (
      prevProps.appearanceCustomization.codeFont !==
      this.props.appearanceCustomization.codeFont
    ) {
      this.editor?.updateOptions({
        fontFamily: getFontStack(
          this.props.appearanceCustomization.codeFont,
          true
        ),
      })
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
    defineVivlioTheme(
      this.props.isDarkTheme,
      this.props.appearanceCustomization
    )
    Monaco.editor.setTheme(CustomMonacoTheme)
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
