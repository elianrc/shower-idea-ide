import * as React from 'react'
import classNames from 'classnames'

import { Octicon } from './octicons'
import * as octicons from './octicons/octicons.generated'
import { encodePathAsUrl } from '../lib/path'

const VivlioLogo = encodePathAsUrl(__dirname, 'static/logo-64x64@2x.png')

export type VivlioWorkspaceMode = 'review' | 'code' | 'sessions'

interface IVivlioWorkspaceNavigationProps {
  readonly selectedMode: VivlioWorkspaceMode
  readonly onModeChanged: (mode: VivlioWorkspaceMode) => void
}

const workspaceItems: ReadonlyArray<{
  readonly mode: VivlioWorkspaceMode
  readonly label: string
  readonly description: string
  readonly icon: typeof octicons.diff
}> = [
  {
    mode: 'review',
    label: 'Review',
    description: 'Review changes, history, branches, and commits',
    icon: octicons.diff,
  },
  {
    mode: 'code',
    label: 'Code',
    description: 'Browse and edit files in the current repository',
    icon: octicons.fileCode,
  },
  {
    mode: 'sessions',
    label: 'Sessions',
    description: 'Manage Codex and Claude Code sessions',
    icon: octicons.commentDiscussion,
  },
]

export class VivlioWorkspaceNavigation extends React.PureComponent<IVivlioWorkspaceNavigationProps> {
  private onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const mode = event.currentTarget.dataset.mode as
      | VivlioWorkspaceMode
      | undefined

    if (mode !== undefined) {
      this.props.onModeChanged(mode)
    }
  }

  public render() {
    return (
      <nav className="vivlio-workspace-navigation" aria-label="Workspace">
        <div className="vivlio-wordmark">
          <img className="vivlio-mark" src={VivlioLogo} alt="" />
          <span>Vivlio</span>
        </div>
        <div className="vivlio-workspace-navigation-items">
          {workspaceItems.map(item => {
            const isSelected = item.mode === this.props.selectedMode
            return (
              <button
                key={item.mode}
                type="button"
                className={classNames('vivlio-workspace-navigation-item', {
                  selected: isSelected,
                })}
                data-mode={item.mode}
                aria-current={isSelected ? 'page' : undefined}
                aria-label={item.description}
                onClick={this.onClick}
              >
                <Octicon symbol={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    )
  }
}
