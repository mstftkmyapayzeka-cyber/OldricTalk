import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron'
import { join } from 'node:path'

const APP_ID = 'com.oldric.talk'
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

// Uçtan uca testler birden çok örneği ayrı veri klasörleriyle çalıştırır.
const testProfile = process.env['OLDRIC_TEST_PROFILE']
if (testProfile) app.setPath('userData', testProfile)

// Tek örnek: ikinci açılış mevcut pencereyi öne getirir.
if (!testProfile && !app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

function isSafeExternal(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'
  } catch {
    return false
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    show: false,
    backgroundColor: '#1e1f22',
    title: 'OldricTalk',
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1e1f22', symbolColor: '#b5bac1', height: 30 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Uygulama içinde yalnızca kendi sayfamız; bağlantılar sistem tarayıcısında açılır.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault()
      if (isSafeExternal(url)) void shell.openExternal(url)
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function applyContentSecurityPolicy(): void {
  // Vite geliştirme sunucusu (HMR) satır içi betik kullanır; derlenmiş sayfada CSP her zaman açık.
  if (process.env['ELECTRON_RENDERER_URL']) return
  const supabase = 'https://*.supabase.co wss://*.supabase.co'
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} https://*.livekit.cloud wss://*.livekit.cloud`
  ].join('; ')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })
}

ipcMain.handle('app:version', () => app.getVersion())

// Okunmamış sayısını görev çubuğu simgesine rozet olarak yansıtır.
ipcMain.on('app:badge', (_event, count: number) => {
  if (!mainWindow) return
  if (count > 0) {
    const label = count > 9 ? '9+' : String(count)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <circle cx="16" cy="16" r="16" fill="#f23f43"/>
      <text x="16" y="22" font-size="${label.length > 1 ? 15 : 19}" font-family="Segoe UI"
        font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`
    const img = nativeImage.createFromDataURL(
      'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
    )
    mainWindow.setOverlayIcon(img, `${count} okunmamış`)
  } else {
    mainWindow.setOverlayIcon(null, '')
  }
})

ipcMain.on('app:flash', () => {
  if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true)
})

ipcMain.on('app:focus', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  applyContentSecurityPolicy()

  // Kamera/mikrofon/ekran (sesli kanallar) ve bildirim dışındaki izinler kapalı.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'notifications', 'clipboard-sanitized-write', 'display-capture'].includes(permission))
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
