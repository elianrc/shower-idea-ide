import * as Path from 'path'

import { ICodeWorkspaceEntry } from '../../lib/code-workspace/file-system'

export interface ICodeWorkspaceTreeNode extends ICodeWorkspaceEntry {
  readonly children: ReadonlyArray<ICodeWorkspaceTreeNode>
}

interface IMutableCodeWorkspaceTreeNode extends ICodeWorkspaceEntry {
  readonly children: IMutableCodeWorkspaceTreeNode[]
}

function sortTreeNodes(
  left: IMutableCodeWorkspaceTreeNode,
  right: IMutableCodeWorkspaceTreeNode
) {
  if (left.kind !== right.kind) {
    return left.kind === 'directory' ? -1 : 1
  }
  return left.name.localeCompare(right.name)
}

function sortTree(nodes: IMutableCodeWorkspaceTreeNode[]) {
  nodes.sort(sortTreeNodes)
  for (const node of nodes) {
    sortTree(node.children)
  }
}

export function createCodeWorkspaceTree(
  entries: ReadonlyArray<ICodeWorkspaceEntry>
): ReadonlyArray<ICodeWorkspaceTreeNode> {
  const roots: IMutableCodeWorkspaceTreeNode[] = []
  const nodesByPath = new Map<string, IMutableCodeWorkspaceTreeNode>()

  for (const entry of entries) {
    nodesByPath.set(entry.path, { ...entry, children: [] })
  }

  for (const node of nodesByPath.values()) {
    const parentPath = Path.posix.dirname(node.path)
    const parent = parentPath === '.' ? undefined : nodesByPath.get(parentPath)

    if (parent?.kind === 'directory') {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  sortTree(roots)
  return roots
}

const languagesByExtension = new Map<string, string>([
  ['.bash', 'shell'],
  ['.c', 'cpp'],
  ['.cc', 'cpp'],
  ['.cpp', 'cpp'],
  ['.cs', 'csharp'],
  ['.css', 'css'],
  ['.dockerfile', 'dockerfile'],
  ['.go', 'go'],
  ['.h', 'cpp'],
  ['.hpp', 'cpp'],
  ['.html', 'html'],
  ['.java', 'java'],
  ['.js', 'javascript'],
  ['.json', 'json'],
  ['.jsx', 'javascript'],
  ['.md', 'markdown'],
  ['.mdx', 'markdown'],
  ['.mjs', 'javascript'],
  ['.php', 'php'],
  ['.py', 'python'],
  ['.rb', 'ruby'],
  ['.rs', 'rust'],
  ['.scss', 'scss'],
  ['.sh', 'shell'],
  ['.sql', 'sql'],
  ['.swift', 'swift'],
  ['.toml', 'ini'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.vue', 'html'],
  ['.xml', 'xml'],
  ['.yaml', 'yaml'],
  ['.yml', 'yaml'],
])

export function getCodeWorkspaceLanguage(filePath: string) {
  const fileName = Path.basename(filePath).toLowerCase()

  if (fileName === 'dockerfile') {
    return 'dockerfile'
  }
  if (fileName === 'makefile') {
    return 'plaintext'
  }

  return languagesByExtension.get(Path.extname(fileName)) ?? 'plaintext'
}
