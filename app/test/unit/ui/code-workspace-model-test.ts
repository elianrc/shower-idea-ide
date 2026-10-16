import assert from 'node:assert'
import { describe, it } from 'node:test'

import {
  createCodeWorkspaceTree,
  getCodeWorkspaceLanguage,
} from '../../../src/ui/code-workspace/model'

describe('code workspace model', () => {
  it('builds a directory-first repository tree', () => {
    const tree = createCodeWorkspaceTree([
      { kind: 'file', name: 'index.ts', path: 'src/index.ts' },
      { kind: 'file', name: 'README.md', path: 'README.md' },
      { kind: 'directory', name: 'src', path: 'src' },
      { kind: 'file', name: 'app.tsx', path: 'src/app.tsx' },
    ])

    assert.deepEqual(
      tree.map(node => [
        node.kind,
        node.path,
        node.children.map(child => child.path),
      ]),
      [
        ['directory', 'src', ['src/app.tsx', 'src/index.ts']],
        ['file', 'README.md', []],
      ]
    )
  })

  it('maps common repository files to Monaco languages', () => {
    assert.equal(getCodeWorkspaceLanguage('src/app.tsx'), 'typescript')
    assert.equal(getCodeWorkspaceLanguage('Dockerfile'), 'dockerfile')
    assert.equal(getCodeWorkspaceLanguage('styles/theme.scss'), 'scss')
    assert.equal(getCodeWorkspaceLanguage('unknown.custom'), 'plaintext')
  })
})
