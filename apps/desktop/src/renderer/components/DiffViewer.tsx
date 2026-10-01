import { useEffect, useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import { AlertCircle, FileDiff, LoaderCircle } from 'lucide-react'
import * as monaco from 'monaco-editor/editor/editor.api'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import type { TaskDiff } from '../../shared/types'

globalThis.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}
loader.config({ monaco })
monaco.languages.register({ id: 'diff' })
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

export default function DiffViewer({ taskId, filePath }: { taskId: string; filePath?: string }) {
  const [diff, setDiff] = useState<TaskDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDiff(null)
    setError(null)
    void window.showerIdea.tasks.getDiff(taskId, filePath).then(
      (result) => { if (active) setDiff(result) },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) },
    )
    return () => { active = false }
  }, [filePath, taskId])

  if (error) return <div className="inline-error"><AlertCircle size={16} />{error}</div>
  if (!diff) return <div className="loading-row"><LoaderCircle className="spin-slow" size={16} /> Loading diff…</div>
  if (!diff.raw) return <div className="diff-empty"><FileDiff size={20} />No textual diff is available yet.</div>

  return (
    <div className="diff-editor-shell">
      <Editor
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('shower-idea-diff', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'string.diff', foreground: 'A9DBC1' },
              { token: 'keyword.diff', foreground: 'D4A7C9' },
            ],
            colors: {
              'editor.background': '#0d1011',
              'editor.foreground': '#c7cdca',
              'editorLineNumber.foreground': '#4f5a56',
              'editorGutter.background': '#0d1011',
              'editor.selectionBackground': '#29443a88',
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
        theme="shower-idea-diff"
        value={diff.raw}
      />
    </div>
  )
}
