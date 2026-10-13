import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpc } from './ipc'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
app.setName('Vivlio')
app.setAsDefaultProtocolClient('vivlio')

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

let handleOpenUrl: ((url: string) => Promise<boolean>) | null = null
const pendingOpenUrls: string[] = []

function findProtocolUrl(values: string[]): string | undefined {
  return values.find((value) => value.startsWith('vivlio://'))
}

function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

async function routeOpenUrl(url: string): Promise<void> {
  if (!handleOpenUrl) {
    pendingOpenUrls.push(url)
    return
  }
  if (await handleOpenUrl(url)) focusMainWindow()
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  void routeOpenUrl(url)
})

app.on('second-instance', (_event, argv) => {
  const url = findProtocolUrl(argv)
  if (url) void routeOpenUrl(url)
  else focusMainWindow()
})

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d0e',
    trafficLightPosition: { x: 18, y: 17 },
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL()
    if (url !== currentUrl) event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(join(currentDirectory, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const ipc = await registerIpc(app.getPath('userData'))
  handleOpenUrl = ipc.handleOpenUrl
  await createWindow()
  for (const url of pendingOpenUrls.splice(0)) await routeOpenUrl(url)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
