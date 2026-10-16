import { getSHA } from './git-info'
import { getUpdatesURL, getChannel } from '../script/dist-info'
import { version, productName } from './package.json'

const channel = getChannel()

const s = JSON.stringify

const optionalStringReplacement = (value: string | undefined) =>
  value === undefined || value.length === 0 ? 'undefined' : s(value)

export function getReplacements() {
  const isDevBuild = channel === 'development'

  return {
    __OAUTH_CLIENT_ID__: optionalStringReplacement(
      process.env.VIVLIO_GITHUB_OAUTH_CLIENT_ID
    ),
    __OAUTH_SECRET__: optionalStringReplacement(
      process.env.VIVLIO_GITHUB_OAUTH_CLIENT_SECRET
    ),
    __DARWIN__: process.platform === 'darwin',
    __WIN32__: process.platform === 'win32',
    __LINUX__: process.platform === 'linux',
    __APP_NAME__: s(productName),
    __APP_VERSION__: s(version),
    __DEV__: isDevBuild,
    __RELEASE_CHANNEL__: s(channel),
    __UPDATES_URL__: s(process.env.DESKTOP_E2E_UPDATES_URL ?? getUpdatesURL()),
    __RELEASE_NOTES_URL__: optionalStringReplacement(
      process.env.VIVLIO_RELEASE_NOTES_URL
    ),
    __USAGE_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.VIVLIO_USAGE_REPORTING_ENDPOINT
    ),
    __ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.VIVLIO_ERROR_REPORTING_ENDPOINT
    ),
    __NON_FATAL_ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.VIVLIO_NON_FATAL_ERROR_REPORTING_ENDPOINT
    ),
    __SHA__: s(getSHA()),
    'process.platform': s(process.platform),
    'process.env.NODE_ENV': s(process.env.NODE_ENV || 'development'),
    'process.env.TEST_ENV': s(process.env.TEST_ENV),
  }
}
