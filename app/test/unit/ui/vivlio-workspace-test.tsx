import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import {
  VivlioWorkspaceMode,
  VivlioWorkspaceNavigation,
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
})
