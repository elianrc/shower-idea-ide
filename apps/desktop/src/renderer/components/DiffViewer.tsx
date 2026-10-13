import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { AlertCircle, FileDiff, LoaderCircle } from 'lucide-react'
import type { SessionDiff } from '../../shared/types'
import { monaco } from '../monaco'

if (!monaco.languages.getLanguages().some((language) => language.id === 'diff')) {
  monaco.languages.register({ id: 'diff' })
}
monaco.languages.setMonarchTokensProvider('diff', {
  tokenizer: {
    root: [
      [/^\+\+\+.*$/, 'keyword'],
      [/^---.*$/, 'keyword'],
      [/^@@.*@@.*$/, 'tag'],
      [/^\+.*$/, 'string'],
      [/^-.*$/, 'invalid'],
      [/^diff --git.*$/, 'type'],
    ],
  },
})

export default function DiffViewer({ sessionId, filePath }: { sessionId?: string; filePath?: string }) {
  const [diff, setDiff] = useState<SessionDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDiff(null)
    setError(null)
    void window.vivlio.files.getDiff(filePath, sessionId).then(
      (result) => { if (active) setDiff(result) },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) },
    )
    return () => { active = false }
  }, [filePath, sessionId])

  if (error) return <div className="inline-error"><AlertCircle size={16} />{error}</div>
  if (!diff) return <div className="loading-row"><LoaderCircle className="spin-slow" size={16} /> Loading diff…</div>
  if (!diff.raw) return <div className="diff-empty"><FileDiff size={20} />No textual diff is available yet.</div>

  return (
    <div className="diff-editor-shell">
      <Editor
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('vivlio-diff', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'string.diff', foreground: 'C8C8C8' },
              { token: 'keyword.diff', foreground: '9A9A9A' },
            ],
            colors: {
              'editor.background': '#050505',
              'editor.foreground': '#c7c7c7',
              'editorLineNumber.foreground': '#454545',
              'editorGutter.background': '#050505',
              'editor.selectionBackground': '#33333388',
            },
          })
        }}
        height="100%"
        language="diff"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontFamily: "'SFMono-Regular', Consolas, monospace",
          fontSize: 12,
          lineHeight: 20,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: 'off',
        }}
        theme="vivlio-diff"
        value={diff.raw}
      />
    </div>
  )
}
