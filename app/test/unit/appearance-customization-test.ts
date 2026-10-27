import assert from 'node:assert'
import { afterEach, describe, it } from 'node:test'

import { ApplicationTheme } from '../../src/ui/lib/application-theme'
import {
  ColorTheme,
  DefaultAppearanceCustomization,
  getFontStack,
  getPersistedAppearanceCustomization,
  getThemeColors,
  getThemeCSSVariables,
  setPersistedAppearanceCustomization,
} from '../../src/ui/lib/appearance-customization'

afterEach(() => {
  setPersistedAppearanceCustomization(DefaultAppearanceCustomization)
})

describe('appearance customization', () => {
  it('persists color and font choices', () => {
    const customization = {
      ...DefaultAppearanceCustomization,
      colorTheme: ColorTheme.Nord,
      uiFont: 'Inter',
      codeFont: 'JetBrains Mono',
    }

    setPersistedAppearanceCustomization(customization)

    assert.deepEqual(getPersistedAppearanceCustomization(), customization)
  })

  it('provides light and dark variants for built-in palettes', () => {
    const customization = {
      ...DefaultAppearanceCustomization,
      colorTheme: ColorTheme.Solarized,
    }

    const light = getThemeColors(ApplicationTheme.Light, customization)
    const dark = getThemeColors(ApplicationTheme.Dark, customization)

    assert.notEqual(light.surface, dark.surface)
    assert.equal(getThemeCSSVariables(dark)['--accent-color'], dark.accent)
  })

  it('uses custom colors and safe font fallbacks', () => {
    const customization = {
      ...DefaultAppearanceCustomization,
      colorTheme: ColorTheme.Custom,
      customColors: {
        ...DefaultAppearanceCustomization.customColors,
        accent: '#f0f0f0',
      },
    }

    assert.equal(
      getThemeColors(ApplicationTheme.Dark, customization),
      customization.customColors
    )
    assert.match(getFontStack('Fira Code', true), /"Fira Code"/)
    assert.equal(
      getFontStack('Font; color: red', false),
      'system-ui, sans-serif'
    )
    assert.equal(
      getThemeCSSVariables(customization.customColors)['--button-text-color'],
      '#111111'
    )
  })
})
