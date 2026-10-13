import { useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { SourceFile } from '../../shared/types'
import '../monaco'

export default function SourceViewer({
  contents,
  file,
  onChange,
  onSave,
}: {
  contents: string
  file: SourceFile
  onChange(contents: string): void
  onSave(): void
}) {
  const saveRef = useRef(onSave)

  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  const mountEditor: OnMount = (editor, monaco) => {
    editor.addAction({
      id: 'vivlio.save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => saveRef.current(),
    })
  }

  return (
    <div className="source-editor-shell">
      <Editor
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('vivlio-code', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#050505',
              'editor.foreground': '#d2d2d2',
              'editorLineNumber.foreground': '#454545',
              'editorLineNumber.activeForeground': '#777777',
              'editorGutter.background': '#050505',
              'editor.selectionBackground': '#33333388',
              'editor.lineHighlightBackground': '#0c0c0c',
            },
          })
        }}
        height="100%"
        language={file.language}
        onChange={(value) => onChange(value ?? '')}
        onMount={mountEditor}
        options={{
          automaticLayout: true,
          contextmenu: false,
          folding: true,
          fontFamily: "'SFMono-Regular', Consolas, monospace",
          fontSize: 12,
          glyphMargin: false,
          lineHeight: 20,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 12 },
          readOnly: false,
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: 'off',
        }}
        path={`vivlio://workspace/${file.path}`}
        theme="vivlio-code"
        value={contents}
      />
    </div>
  )
}
