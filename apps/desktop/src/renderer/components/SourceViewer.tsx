import Editor from '@monaco-editor/react'
import type { SourceFile } from '../../shared/types'
import '../monaco'

export default function SourceViewer({ file }: { file: SourceFile }) {
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
          readOnly: true,
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: 'off',
        }}
        path={`vivlio://workspace/${file.path}`}
        theme="vivlio-code"
        value={file.contents}
      />
    </div>
  )
}
