import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray
} from 'electron'
import { autoUpdater } from 'electron-updater'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const APP_ID = 'com.oldric.talk'
const isDev = !app.isPackaged
const ICON = join(__dirname, '../../resources/icon.png')

// Başlık çubuğu `rail` zeminli, Windows düğmeleri `text-muted` (tasarım belirteçleri).
type Theme = 'light' | 'dark'
const FRAME: Record<Theme, { color: string; symbolColor: string }> = {
  light: { color: '#e8e0d9', symbolColor: '#6e5f53' },
  dark: { color: '#181411', symbolColor: '#ada299' }
}
// Pencere açılırken son temayla çizilsin diye renderer'ın seçimi diskte tutulur.
const themeFile = (): string => join(app.getPath('userData'), 'theme.json')

function loadTheme(): Theme {
  try {
    return JSON.parse(readFileSync(themeFile(), 'utf8')).theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** Gerçek çıkış (tepsi menüsü, güncelleme); yoksa pencereyi kapatmak tepsiye gizler. */
let quitting = false
let trayHintShown = false
let updateReady = false

// Uçtan uca testler birden çok örneği ayrı veri klasörleriyle çalıştırır.
const testProfile = process.env['OLDRIC_TEST_PROFILE']
if (testProfile) {
  app.setPath('userData', testProfile)
  // Testlerde gerçek mikrofon yerine Chromium'un sahte cihazı.
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
}

// Tek örnek: ikinci açılış mevcut pencereyi öne getirir.
if (!testProfile && !app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => showWindow())

function isSafeExternal(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'
  } catch {
    return false
  }
}

function createWindow(): void {
  const frame = FRAME[loadTheme()]
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    show: false,
    backgroundColor: frame.color,
    title: 'OldricTalk',
    icon: ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...frame, height: 30 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Windows açılışında başlatıldıysa yalnızca tepside dur.
    if (!process.argv.includes('--hidden')) mainWindow?.show()
  })
  // Kapat düğmesi uygulamayı kapatmaz, tepsiye gizler (sesli sohbet sürer).
  mainWindow.on('close', (event) => {
    if (quitting || !tray) return
    event.preventDefault()
    mainWindow?.hide()
    if (!trayHintShown) {
      trayHintShown = true
      tray.displayBalloon({
        iconType: 'info',
        title: 'OldricTalk arka planda çalışıyor',
        content: 'Tamamen kapatmak için sağ alttaki simgeye sağ tıklayıp "Çık"ı seçin.'
      })
    }
  })
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
    // blob: + wasm: gürültü engelleme (RNNoise) AudioWorklet'i ve WebAssembly'si.
    "script-src 'self' blob: 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}`
  ].join('; ')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })
}

ipcMain.handle('app:version', () => app.getVersion())

ipcMain.on('app:theme', (_event, theme: Theme) => {
  if (theme !== 'light' && theme !== 'dark') return
  if (mainWindow) {
    mainWindow.setTitleBarOverlay(FRAME[theme])
    mainWindow.setBackgroundColor(FRAME[theme].color)
  }
  try {
    writeFileSync(themeFile(), JSON.stringify({ theme }))
  } catch {
    // yazılamazsa bir sonraki açılış krem temayla başlar
  }
})

// Okunmamış sayısını görev çubuğu simgesine rozet olarak yansıtır.
ipcMain.on('app:badge', (_event, count: number) => {
  if (!mainWindow) return
  if (count > 0) {
    const label = count > 9 ? '9+' : String(count)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <circle cx="16" cy="16" r="16" fill="#ba2921"/>
      <text x="16" y="22" font-size="${label.length > 1 ? 15 : 19}" font-family="Segoe UI"
        font-weight="700" fill="#fdfcfb" text-anchor="middle">${label}</text></svg>`
    const img = nativeImage.createFromDataURL(
      'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
    )
    mainWindow.setOverlayIcon(img, `${count} okunmamış`)
  } else {
    mainWindow.setOverlayIcon(null, '')
  }
})

function showWindow(): void {
  if (!mainWindow) return createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// ---------------------------------------------------------------- tepsi simgesi
function buildTrayMenu(): void {
  if (!tray) return
  const atLogin = app.getLoginItemSettings().openAtLogin
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "OldricTalk'ı Aç", click: showWindow },
      { type: 'separator' },
      {
        label: 'Windows açılınca başlat',
        type: 'checkbox',
        checked: atLogin,
        enabled: app.isPackaged,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] })
        }
      },
      updateReady
        ? { label: 'Güncellemeyi kur ve yeniden başlat', click: () => installUpdate() }
        : {
            label: 'Güncellemeleri denetle',
            enabled: app.isPackaged,
            click: () => void autoUpdater.checkForUpdates().catch(() => undefined)
          },
      { type: 'separator' },
      {
        label: 'Çık',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }))
  tray.setToolTip('OldricTalk')
  tray.on('click', showWindow)
  buildTrayMenu()
}

// ---------------------------------------------------------------- otomatik güncelleme
// GitHub Releases'tan; yeni sürüm arka planda iner, çıkışta ya da tepsiden kurulur.
function installUpdate(): void {
  quitting = true
  autoUpdater.quitAndInstall(true, true)
}

function setupAutoUpdate(): void {
  if (!app.isPackaged || testProfile) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true
    buildTrayMenu()
    tray?.displayBalloon({
      iconType: 'info',
      title: `OldricTalk ${info.version} hazır`,
      content: 'Uygulamayı kapattığınızda kurulacak. Hemen kurmak için tepsi simgesine sağ tıklayın.'
    })
  })
  autoUpdater.on('error', () => undefined)
  const check = (): void => void autoUpdater.checkForUpdates().catch(() => undefined)
  check()
  setInterval(check, 4 * 60 * 60 * 1000)
}

ipcMain.on('app:flash', () => {
  if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true)
})

ipcMain.on('app:focus', () => {
  if (mainWindow) showWindow()
})

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  applyContentSecurityPolicy()

  // Yalnızca mikrofon (sesli kanallar), hoparlör seçimi ve bildirim; kamera ve ekran yakalama kapalı.
  const allowed = ['notifications', 'clipboard-sanitized-write', 'speaker-selection']
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission === 'media') {
      const types = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
      return callback(types.length > 0 && types.every((t) => t === 'audio'))
    }
    callback(allowed.includes(permission))
  })
  // Cihaz listesinin adları için mediaType'sız 'media' kontrolü de gelir; yalnızca video reddedilir.
  session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) =>
    permission === 'media' ? details.mediaType !== 'video' : allowed.includes(permission)
  )

  // Testlerde tepsi yok: pencereyi kapatmak uygulamayı kapatır.
  if (!testProfile) createTray()
  createWindow()
  setupAutoUpdate()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
