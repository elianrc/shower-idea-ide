import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpc } from './ipc'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
app.setName('Vivlio')

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
  await registerIpc(app.getPath('userData'))
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
