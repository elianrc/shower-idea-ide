import { getObject, setObject } from '../../lib/local-storage'
import { ApplicableTheme, ApplicationTheme } from './application-theme'

export enum ColorTheme {
  Vivlio = 'vivlio',
  Graphite = 'graphite',
  Nord = 'nord',
  Solarized = 'solarized',
  Custom = 'custom',
}

export interface IThemeColors {
  readonly accent: string
  readonly chrome: string
  readonly surface: string
  readonly editor: string
  readonly border: string
  readonly text: string
  readonly secondaryText: string
}

export interface IAppearanceCustomization {
  readonly colorTheme: ColorTheme
  readonly uiFont: string
  readonly codeFont: string
  readonly customColors: IThemeColors
}

export const DefaultAppearanceCustomization: IAppearanceCustomization = {
  colorTheme: ColorTheme.Vivlio,
  uiFont: 'System UI',
  codeFont: 'SF Mono',
  customColors: {
    accent: '#2e6fd6',
    chrome: '#1c1f23',
    surface: '#24272b',
    editor: '#1f2226',
    border: '#41464d',
    text: '#eceef0',
    secondaryText: '#b9bec5',
  },
}

export const UIFontOptions = [
  'System UI',
  'Inter',
  'Avenir Next',
  'Helvetica Neue',
  'Arial',
  'Segoe UI',
] as const

export const CodeFontOptions = [
  'SF Mono',
  'Menlo',
  'Monaco',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Cascadia Code',
] as const

const AppearanceCustomizationKey = 'vivlio-appearance-customization-v1'
const HexColorPattern = /^#[0-9a-f]{6}$/i
const FontNamePattern = /^[\w .+-]{1,80}$/u

const lightPalettes: Readonly<
  Record<Exclude<ColorTheme, ColorTheme.Custom>, IThemeColors>
> = {
  [ColorTheme.Vivlio]: {
    accent: '#2e6fd6',
    chrome: '#f3f5f7',
    surface: '#ffffff',
    editor: '#fafbfc',
    border: '#d0d7de',
    text: '#24292f',
    secondaryText: '#57606a',
  },
  [ColorTheme.Graphite]: {
    accent: '#5d6570',
    chrome: '#eff0f2',
    surface: '#f8f8f9',
    editor: '#ffffff',
    border: '#c8cbd0',
    text: '#202226',
    secondaryText: '#60646b',
  },
  [ColorTheme.Nord]: {
    accent: '#5e81ac',
    chrome: '#e5e9f0',
    surface: '#eceff4',
    editor: '#f6f8fb',
    border: '#c4cad4',
    text: '#2e3440',
    secondaryText: '#4c566a',
  },
  [ColorTheme.Solarized]: {
    accent: '#268bd2',
    chrome: '#eee8d5',
    surface: '#fdf6e3',
    editor: '#fffaf0',
    border: '#d8cfb5',
    text: '#073642',
    secondaryText: '#586e75',
  },
}

const darkPalettes: typeof lightPalettes = {
  [ColorTheme.Vivlio]: DefaultAppearanceCustomization.customColors,
  [ColorTheme.Graphite]: {
    accent: '#8b949e',
    chrome: '#181a1d',
    surface: '#22252a',
    editor: '#1d1f23',
    border: '#434850',
    text: '#f0f1f2',
    secondaryText: '#b1b5bb',
  },
  [ColorTheme.Nord]: {
    accent: '#88c0d0',
    chrome: '#242933',
    surface: '#2e3440',
    editor: '#272c36',
    border: '#4c566a',
    text: '#eceff4',
    secondaryText: '#d8dee9',
  },
  [ColorTheme.Solarized]: {
    accent: '#268bd2',
    chrome: '#002b36',
    surface: '#073642',
    editor: '#002b36',
    border: '#31545d',
    text: '#fdf6e3',
    secondaryText: '#93a1a1',
  },
}

function isColorTheme(value: unknown): value is ColorTheme {
  return Object.values(ColorTheme).includes(value as ColorTheme)
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && HexColorPattern.test(value)
    ? value.toLowerCase()
    : fallback
}

export function normalizeFontName(value: unknown, fallback: string) {
  return typeof value === 'string' && FontNamePattern.test(value.trim())
    ? value.trim()
    : fallback
}

export function getPersistedAppearanceCustomization(): IAppearanceCustomization {
  const stored = getObject<Partial<IAppearanceCustomization>>(
    AppearanceCustomizationKey
  )
  const defaults = DefaultAppearanceCustomization
  const storedColors = stored?.customColors

  return {
    colorTheme: isColorTheme(stored?.colorTheme)
      ? stored.colorTheme
      : defaults.colorTheme,
    uiFont: normalizeFontName(stored?.uiFont, defaults.uiFont),
    codeFont: normalizeFontName(stored?.codeFont, defaults.codeFont),
    customColors: {
      accent: normalizeColor(
        storedColors?.accent,
        defaults.customColors.accent
      ),
      chrome: normalizeColor(
        storedColors?.chrome,
        defaults.customColors.chrome
      ),
      surface: normalizeColor(
        storedColors?.surface,
        defaults.customColors.surface
      ),
      editor: normalizeColor(
        storedColors?.editor,
        defaults.customColors.editor
      ),
      border: normalizeColor(
        storedColors?.border,
        defaults.customColors.border
      ),
      text: normalizeColor(storedColors?.text, defaults.customColors.text),
      secondaryText: normalizeColor(
        storedColors?.secondaryText,
        defaults.customColors.secondaryText
      ),
    },
  }
}

export function setPersistedAppearanceCustomization(
  customization: IAppearanceCustomization
) {
  setObject(AppearanceCustomizationKey, customization)
}

export function getFontStack(font: string, monospace: boolean) {
  const fallback = monospace
    ? 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
    : 'system-ui, sans-serif'
  const normalizedFont = normalizeFontName(
    font,
    monospace ? 'SF Mono' : 'System UI'
  )

  if (normalizedFont === 'System UI') {
    return fallback
  }

  return `"${normalizedFont}", ${fallback}`
}

export function getThemeColors(
  baseTheme: ApplicableTheme,
  customization: IAppearanceCustomization
) {
  if (customization.colorTheme === ColorTheme.Custom) {
    return customization.customColors
  }

  return baseTheme === ApplicationTheme.Dark
    ? darkPalettes[customization.colorTheme]
    : lightPalettes[customization.colorTheme]
}

function mixHex(foreground: string, background: string, ratio: number) {
  const parse = (color: string) => [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ]
  const foregroundChannels = parse(foreground)
  const backgroundChannels = parse(background)
  const mixed = foregroundChannels.map((channel, index) =>
    Math.round(
      channel * ratio + backgroundChannels[index] * (1 - ratio)
    ).toString(16)
  )

  return `#${mixed.map(channel => channel.padStart(2, '0')).join('')}`
}

function getContrastingTextColor(background: string) {
  const channels = [
    parseInt(background.slice(1, 3), 16),
    parseInt(background.slice(3, 5), 16),
    parseInt(background.slice(5, 7), 16),
  ].map(channel => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722

  return luminance > 0.42 ? '#111111' : '#ffffff'
}

export function getThemeCSSVariables(colors: IThemeColors) {
  const hover = mixHex(colors.text, colors.surface, 0.08)
  const active = mixHex(colors.text, colors.surface, 0.14)
  const mutedText = mixHex(colors.secondaryText, colors.surface, 0.76)
  const accentHover = mixHex(colors.text, colors.accent, 0.12)
  const accentSoft = mixHex(colors.accent, colors.surface, 0.24)
  const accentText = getContrastingTextColor(colors.accent)

  return {
    '--accent-color': colors.accent,
    '--button-background': colors.accent,
    '--button-hover-background': accentHover,
    '--button-text-color': accentText,
    '--button-focus-border-color': colors.accent,
    '--box-border-accent-color': colors.accent,
    '--box-selected-active-background-color': colors.accent,
    '--box-selected-active-text-color': accentText,
    '--box-selected-active-border-color': colors.accent,
    '--tab-bar-active-color': colors.accent,
    '--link-button-color': colors.accent,
    '--link-button-hover-color': accentHover,
    '--link-button-selected-hover-color': accentHover,
    '--focus-color': colors.accent,
    '--toolbar-background-color': colors.chrome,
    '--toolbar-text-color': colors.text,
    '--toolbar-text-secondary-color': colors.secondaryText,
    '--toolbar-button-color': colors.text,
    '--toolbar-button-secondary-color': colors.secondaryText,
    '--toolbar-button-border-color': colors.border,
    '--toolbar-button-hover-color': colors.text,
    '--toolbar-button-hover-background-color': hover,
    '--toolbar-button-hover-border-color': colors.border,
    '--toolbar-button-focus-background-color': hover,
    '--toolbar-button-active-color': colors.text,
    '--toolbar-button-active-background-color': colors.surface,
    '--toolbar-button-active-border-color': colors.surface,
    '--toolbar-button-progress-color': hover,
    '--toolbar-button-focus-progress-color': active,
    '--toolbar-button-hover-progress-color': active,
    '--vivlio-chrome-background': colors.chrome,
    '--background-color': colors.surface,
    '--box-background-color': colors.surface,
    '--box-hover-background-color': hover,
    '--box-selected-background-color': active,
    '--box-selected-text-color': colors.text,
    '--box-selected-border-color': colors.border,
    '--tab-bar-background-color': colors.surface,
    '--tab-bar-hover-background-color': hover,
    '--vivlio-app-background': colors.surface,
    '--box-alt-background-color': colors.editor,
    '--vivlio-editor-background': colors.editor,
    '--box-border-color': colors.border,
    '--box-border-contrast-color': colors.border,
    '--toolbar-border-color': colors.border,
    '--vivlio-control-border': colors.border,
    '--secondary-button-background': hover,
    '--secondary-button-border-color': colors.border,
    '--secondary-button-hover-background': active,
    '--secondary-button-hover-border-color': colors.border,
    '--secondary-button-text-color': colors.text,
    '--secondary-button-focus-shadow-color': accentSoft,
    '--secondary-button-focus-border-color': colors.accent,
    '--input-icon-hover-background-color': hover,
    '--vivlio-control-background': hover,
    '--vivlio-control-active': active,
    '--text-color': colors.text,
    '--text-secondary-color': colors.secondaryText,
    '--text-secondary-color-muted': mutedText,
  } as const
}
