import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import {
  VivlioWorkspaceMode,
  VivlioWorkspaceNavigation,
  VivlioWorkspacePlaceholder,
} from '../../../src/ui/vivlio-workspace'
import { fireEvent, render, screen } from '../../helpers/ui/render'

describe('Vivlio workspace', () => {
  it('renders repository-centered navigation and changes modes', () => {
    let selectedMode: VivlioWorkspaceMode | null = null

    render(
      <VivlioWorkspaceNavigation
        selectedMode="review"
        onModeChanged={mode => {
          selectedMode = mode
        }}
      />
    )

    assert.equal(
      screen
        .getByRole('button', { name: /review changes/i })
        .getAttribute('aria-current'),
      'page'
    )

    fireEvent.click(
      screen.getByRole('button', { name: /manage codex and claude code/i })
    )

    assert.equal(selectedMode, 'sessions')
  })

  it('identifies the unfinished sessions workspace without fake controls', () => {
    render(
      <VivlioWorkspacePlaceholder
        repositoryName="example-repository"
        repositoryPath="/work/example-repository"
      />
    )

    assert.ok(screen.getByRole('heading', { name: 'AI sessions' }))
    assert.ok(screen.getByText('example-repository'))
    assert.ok(screen.getByText('/work/example-repository'))
    assert.ok(screen.getByText(/implementation in progress/i))
  })
})
