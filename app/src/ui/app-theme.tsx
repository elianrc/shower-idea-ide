import * as React from 'react'
import {
  ApplicationTheme,
  getThemeName,
  getCurrentlyAppliedTheme,
} from './lib/application-theme'
import * as ipcRenderer from '../lib/ipc-renderer'
import {
  getFontStack,
  getThemeColors,
  getThemeCSSVariables,
  IAppearanceCustomization,
} from './lib/appearance-customization'

interface IAppThemeProps {
  readonly theme: ApplicationTheme
  readonly customization: IAppearanceCustomization
}

/**
 * A pseudo-component responsible for adding the applicable CSS
 * class names to the body tag in order to apply the currently
 * selected theme.
 *
 * This component is a PureComponent, meaning that it'll only
 * render when its props changes (shallow comparison).
 *
 * This component does not render anything into the DOM, it's
 * purely (a)busing the component lifecycle to manipulate the
 * body class list.
 */
export class AppTheme extends React.PureComponent<IAppThemeProps> {
  public componentDidMount() {
    this.ensureTheme()
  }

  public componentDidUpdate() {
    this.ensureTheme()
  }

  public componentWillUnmount() {
    this.clearThemes()
    this.clearCustomization()
  }

  private async ensureTheme() {
    let themeToDisplay = this.props.theme

    if (this.props.theme === ApplicationTheme.System) {
      themeToDisplay = await getCurrentlyAppliedTheme()
    }

    const newThemeClassName = `theme-${getThemeName(themeToDisplay)}`

    if (!document.body.classList.contains(newThemeClassName)) {
      this.clearThemes()
      document.body.classList.add(newThemeClassName)
    }

    const applicableTheme =
      themeToDisplay === ApplicationTheme.Dark
        ? ApplicationTheme.Dark
        : ApplicationTheme.Light
    this.applyCustomization(applicableTheme)
    this.updateColorScheme()
  }

  private applyCustomization(
    theme: ApplicationTheme.Light | ApplicationTheme.Dark
  ) {
    const { customization } = this.props
    const bodyStyle = document.body.style
    const colors = getThemeColors(theme, customization)

    this.clearCustomization()
    document.body.dataset.colorTheme = customization.colorTheme

    for (const [property, value] of Object.entries(
      getThemeCSSVariables(colors)
    )) {
      bodyStyle.setProperty(property, value)
    }

    bodyStyle.setProperty(
      '--font-family-sans-serif',
      getFontStack(customization.uiFont, false)
    )
    bodyStyle.setProperty(
      '--font-family-monospace',
      getFontStack(customization.codeFont, true)
    )
  }

  private updateColorScheme = () => {
    const isDarkTheme = document.body.classList.contains('theme-dark')
    const rootStyle = document.documentElement.style

    rootStyle.colorScheme = isDarkTheme ? 'dark' : 'light'

    // Update the window's background color to match the CSS value
    const backgroundColor = getComputedStyle(document.body).getPropertyValue(
      '--background-color'
    )
    if (backgroundColor) {
      ipcRenderer.send('update-window-background-color', backgroundColor.trim())
    }
  }

  private clearThemes() {
    const body = document.body

    // body.classList is a DOMTokenList and it does not iterate all the way
    // through with the for loop. (why it doesn't.. ¯\_(ツ)_/¯ - Possibly
    // because we are modifying it as we loop) Hence the extra step of
    // converting it to a string array.
    const classList = [...body.classList]
    for (const className of classList) {
      if (className.startsWith('theme-')) {
        body.classList.remove(className)
      }
    }
  }

  private clearCustomization() {
    const bodyStyle = document.body.style
    const properties = [
      ...Object.keys(
        getThemeCSSVariables(
          getThemeColors(ApplicationTheme.Dark, this.props.customization)
        )
      ),
      '--font-family-sans-serif',
      '--font-family-monospace',
    ]

    for (const property of properties) {
      bodyStyle.removeProperty(property)
    }

    delete document.body.dataset.colorTheme
  }

  public render() {
    return null
  }
}
