import * as React from 'react'
import {
  ApplicationTheme,
  supportsSystemThemeChanges,
  getCurrentlyAppliedTheme,
} from '../lib/application-theme'
import { Row } from '../lib/row'
import { DialogContent } from '../dialog'
import { RadioGroup } from '../lib/radio-group'
import { Select } from '../lib/select'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { encodePathAsUrl } from '../../lib/path'
import { tabSizeDefault } from '../../lib/stores/app-store'
import { enableFormattingPreferences } from '../../lib/feature-flag'
import {
  DateFormat,
  TimeFormat,
  INumberFormat,
  dateFormats,
  timeFormats,
  numberFormats,
  numberFormatToKey,
} from '../../models/formatting-preferences'
import { formatNumber } from '../../lib/format-number'
import {
  CodeFontOptions,
  ColorTheme,
  DefaultAppearanceCustomization,
  getFontStack,
  IAppearanceCustomization,
  IThemeColors,
  UIFontOptions,
} from '../lib/appearance-customization'

interface IAppearanceProps {
  readonly selectedTheme: ApplicationTheme
  readonly onSelectedThemeChanged: (theme: ApplicationTheme) => void
  readonly appearanceCustomization: IAppearanceCustomization
  readonly onAppearanceCustomizationChanged: (
    customization: IAppearanceCustomization
  ) => void
  readonly selectedTabSize: number
  readonly onSelectedTabSizeChanged: (tabSize: number) => void
  readonly selectedDateFormat: DateFormat
  readonly onSelectedDateFormatChanged: (format: DateFormat) => void
  readonly selectedTimeFormat: TimeFormat
  readonly onSelectedTimeFormatChanged: (format: TimeFormat) => void
  readonly selectedNumberFormat: INumberFormat
  readonly onSelectedNumberFormatChanged: (format: INumberFormat) => void
  readonly preferAbsoluteDates: boolean
  readonly onPreferAbsoluteDatesChanged: (value: boolean) => void
}

interface IAppearanceState {
  readonly selectedTheme: ApplicationTheme | null
  readonly selectedTabSize: number
}

export class Appearance extends React.Component<
  IAppearanceProps,
  IAppearanceState
> {
  public constructor(props: IAppearanceProps) {
    super(props)

    const usePropTheme =
      props.selectedTheme !== ApplicationTheme.System ||
      supportsSystemThemeChanges()

    this.state = {
      selectedTheme: usePropTheme ? props.selectedTheme : null,
      selectedTabSize: props.selectedTabSize,
    }

    if (!usePropTheme) {
      this.initializeSelectedTheme()
    }
  }

  public async componentDidUpdate(prevProps: IAppearanceProps) {
    if (prevProps === this.props) {
      return
    }

    const usePropTheme =
      this.props.selectedTheme !== ApplicationTheme.System ||
      supportsSystemThemeChanges()

    const selectedTheme = usePropTheme
      ? this.props.selectedTheme
      : await getCurrentlyAppliedTheme()

    const selectedTabSize = this.props.selectedTabSize

    this.setState({ selectedTheme, selectedTabSize })
  }

  private initializeSelectedTheme = async () => {
    const selectedTheme = await getCurrentlyAppliedTheme()
    const selectedTabSize = this.props.selectedTabSize
    this.setState({ selectedTheme, selectedTabSize })
  }

  private onSelectedThemeChanged = (theme: ApplicationTheme) => {
    this.props.onSelectedThemeChanged(theme)
  }

  private updateAppearanceCustomization(
    update: Partial<IAppearanceCustomization>
  ) {
    this.props.onAppearanceCustomizationChanged({
      ...this.props.appearanceCustomization,
      ...update,
    })
  }

  private onColorThemeChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    this.updateAppearanceCustomization({
      colorTheme: event.currentTarget.value as ColorTheme,
    })
  }

  private onUIFontChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.updateAppearanceCustomization({ uiFont: event.currentTarget.value })
  }

  private onCodeFontChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.updateAppearanceCustomization({ codeFont: event.currentTarget.value })
  }

  private onCustomColorChanged = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const key = event.currentTarget.dataset.colorKey as keyof IThemeColors
    this.updateAppearanceCustomization({
      colorTheme: ColorTheme.Custom,
      customColors: {
        ...this.props.appearanceCustomization.customColors,
        [key]: event.currentTarget.value,
      },
    })
  }

  private resetAppearanceCustomization = () => {
    this.props.onAppearanceCustomizationChanged(DefaultAppearanceCustomization)
  }

  private onSelectedTabSizeChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    this.props.onSelectedTabSizeChanged(parseInt(event.currentTarget.value))
  }

  private onDateFormatChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    const match = dateFormats.find(f => f.pattern === value)
    if (match !== undefined) {
      this.props.onSelectedDateFormatChanged(match.pattern)
    }
  }

  private onTimeFormatChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    const match = timeFormats.find(f => f.pattern === value)
    if (match !== undefined) {
      this.props.onSelectedTimeFormatChanged(match.pattern)
    }
  }

  private onNumberFormatChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const match = numberFormats.find(
      n => numberFormatToKey(n) === event.currentTarget.value
    )
    if (match) {
      this.props.onSelectedNumberFormatChanged(match)
    }
  }

  private onPreferAbsoluteDatesChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onPreferAbsoluteDatesChanged(event.currentTarget.checked)
  }

  public renderThemeSwatch = (theme: ApplicationTheme) => {
    const darkThemeImage = encodePathAsUrl(__dirname, 'static/ghd_dark.svg')
    const lightThemeImage = encodePathAsUrl(__dirname, 'static/ghd_light.svg')

    switch (theme) {
      case ApplicationTheme.Light:
        return (
          <span>
            <img src={lightThemeImage} alt="" />
            <span className="theme-value-label">Light</span>
          </span>
        )
      case ApplicationTheme.Dark:
        return (
          <span>
            <img src={darkThemeImage} alt="" />
            <span className="theme-value-label">Dark</span>
          </span>
        )
      case ApplicationTheme.System:
        /** Why three images? The system theme swatch uses the first image
         * positioned relatively to get the label container size and uses the
         * second and third positioned absolutely over first and third one
         * clipped in half to render a split dark and light theme swatch. */
        return (
          <span>
            <span className="system-theme-swatch">
              <img src={lightThemeImage} alt="" />
              <img src={lightThemeImage} alt="" />
              <img src={darkThemeImage} alt="" />
            </span>
            <span className="theme-value-label">System</span>
          </span>
        )
    }
  }

  private renderSelectedTheme() {
    const selectedTheme = this.state.selectedTheme

    if (selectedTheme == null) {
      return <Row>Loading system theme</Row>
    }

    const themes = [
      ApplicationTheme.Light,
      ApplicationTheme.Dark,
      ...(supportsSystemThemeChanges() ? [ApplicationTheme.System] : []),
    ]

    return (
      <div className="appearance-section">
        <h2 id="theme-heading">Theme</h2>

        <RadioGroup<ApplicationTheme>
          ariaLabelledBy="theme-heading"
          className="theme-selector"
          selectedKey={selectedTheme}
          radioButtonKeys={themes}
          onSelectionChanged={this.onSelectedThemeChanged}
          renderRadioButtonLabelContents={this.renderThemeSwatch}
        />
      </div>
    )
  }

  private renderColorTheme() {
    const { appearanceCustomization } = this.props
    const colorLabels: Readonly<Record<ColorTheme, string>> = {
      [ColorTheme.Vivlio]: 'Vivlio Blue',
      [ColorTheme.Graphite]: 'Graphite',
      [ColorTheme.Nord]: 'Nord',
      [ColorTheme.Solarized]: 'Solarized',
      [ColorTheme.Custom]: 'Custom',
    }

    const colorControls: ReadonlyArray<{
      readonly key: keyof IThemeColors
      readonly label: string
    }> = [
      { key: 'accent', label: 'Accent' },
      { key: 'chrome', label: 'Toolbar' },
      { key: 'surface', label: 'Surface' },
      { key: 'editor', label: 'Editor' },
      { key: 'border', label: 'Border' },
      { key: 'text', label: 'Text' },
      { key: 'secondaryText', label: 'Secondary text' },
    ]

    return (
      <div className="appearance-section color-theme-section">
        <h2>Color palette</h2>
        <p className="settings-description">
          Choose a complete palette or customize its individual colors. Changes
          are previewed immediately.
        </p>
        <Select
          label="Palette"
          value={appearanceCustomization.colorTheme}
          onChange={this.onColorThemeChanged}
        >
          {Object.values(ColorTheme).map(theme => (
            <option key={theme} value={theme}>
              {colorLabels[theme]}
            </option>
          ))}
        </Select>
        {appearanceCustomization.colorTheme === ColorTheme.Custom ? (
          <div className="custom-color-grid">
            {colorControls.map(({ key, label }) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="color"
                  data-color-key={key}
                  value={appearanceCustomization.customColors[key]}
                  onChange={this.onCustomColorChanged}
                />
                <code>{appearanceCustomization.customColors[key]}</code>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  private renderFonts() {
    const { appearanceCustomization } = this.props

    return (
      <div className="appearance-section font-section">
        <h2>Fonts</h2>
        <p className="settings-description">
          Select a suggestion or enter the name of any font installed on this
          computer.
        </p>
        <div className="font-controls">
          <label>
            <span>Interface font</span>
            <input
              type="text"
              list="vivlio-ui-font-options"
              value={appearanceCustomization.uiFont}
              onChange={this.onUIFontChanged}
              spellCheck={false}
            />
          </label>
          <datalist id="vivlio-ui-font-options">
            {UIFontOptions.map(font => (
              <option key={font} value={font} />
            ))}
          </datalist>
          <label>
            <span>Code font</span>
            <input
              type="text"
              list="vivlio-code-font-options"
              value={appearanceCustomization.codeFont}
              onChange={this.onCodeFontChanged}
              spellCheck={false}
            />
          </label>
          <datalist id="vivlio-code-font-options">
            {CodeFontOptions.map(font => (
              <option key={font} value={font} />
            ))}
          </datalist>
        </div>
        <div className="appearance-font-preview" aria-live="polite">
          <span
            style={{
              fontFamily: getFontStack(appearanceCustomization.uiFont, false),
            }}
          >
            Vivlio interface preview
          </span>
          <code
            style={{
              fontFamily: getFontStack(appearanceCustomization.codeFont, true),
            }}
          >
            const preview = &apos;Code font&apos;
          </code>
        </div>
        <button type="button" onClick={this.resetAppearanceCustomization}>
          Reset palette and fonts
        </button>
      </div>
    )
  }

  private renderFormatting() {
    if (!enableFormattingPreferences()) {
      return null
    }

    return (
      <div className="appearance-section formatting-section">
        <h2 id="formatting-heading">Formatting</h2>

        <Row>
          <Select
            label={__DARWIN__ ? 'Date Format' : 'Date format'}
            value={this.props.selectedDateFormat}
            onChange={this.onDateFormatChanged}
          >
            {dateFormats.map(({ pattern, example }) => (
              <option key={pattern} value={pattern}>
                {example} ({pattern})
              </option>
            ))}
          </Select>

          <Select
            label={__DARWIN__ ? 'Time Format' : 'Time format'}
            value={this.props.selectedTimeFormat}
            onChange={this.onTimeFormatChanged}
          >
            {timeFormats.map(({ pattern, example }) => (
              <option key={pattern} value={pattern}>
                {example} ({pattern})
              </option>
            ))}
          </Select>
        </Row>

        <Select
          label={__DARWIN__ ? 'Number Format' : 'Number format'}
          value={numberFormatToKey(this.props.selectedNumberFormat)}
          onChange={this.onNumberFormatChanged}
        >
          {numberFormats.map(format => (
            <option
              key={numberFormatToKey(format)}
              value={numberFormatToKey(format)}
            >
              {formatNumber(1234567.89, format)}
            </option>
          ))}
        </Select>

        <Checkbox
          className="prefer-absolute-dates"
          label="Prefer absolute dates over relative"
          value={
            this.props.preferAbsoluteDates
              ? CheckboxValue.On
              : CheckboxValue.Off
          }
          onChange={this.onPreferAbsoluteDatesChanged}
        />
      </div>
    )
  }

  private renderSelectedTabSize() {
    const availableTabSizes: number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12]

    return (
      <div className="appearance-section">
        <h2 id="diff-heading">Diff</h2>

        <Select
          value={this.state.selectedTabSize.toString()}
          label={__DARWIN__ ? 'Tab Size' : 'Tab size'}
          onChange={this.onSelectedTabSizeChanged}
        >
          {availableTabSizes.map(n => (
            <option key={n} value={n}>
              {n === tabSizeDefault ? `${n} (default)` : n}
            </option>
          ))}
        </Select>
      </div>
    )
  }

  public render() {
    return (
      <DialogContent>
        {this.renderSelectedTheme()}
        {this.renderColorTheme()}
        {this.renderFonts()}
        {this.renderFormatting()}
        {this.renderSelectedTabSize()}
      </DialogContent>
    )
  }
}
