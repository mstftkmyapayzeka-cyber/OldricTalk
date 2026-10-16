// Bas-konuş: uygulama arka plandayken (ör. oyundayken) de tuşun basılı olup olmadığını
// izler. Electron'un globalShortcut'ı bırakma olayı vermediği için sistem geneli klavye/fare
// kancası (uiohook) kullanılır.
//
// Gizlilik: kanca yalnızca bas-konuş açık ve kullanıcı bir ses kanalındayken (ya da tuş
// atanırken) çalışır; atanmış tuş dışındaki hiçbir tuşa bakılmaz, hiçbir şey saklanmaz.
import { ipcMain, type WebContents } from 'electron'
import { uIOhook, UiohookKey, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'

export type PttBinding = { kind: 'key' | 'mouse'; code: number }
export type PttCaptured = PttBinding & { label: string }

let binding: PttBinding | null = null
let enabled = false
let down = false
let capture: ((result: PttCaptured | null) => void) | null = null
let running = false
let target: WebContents | null = null

// Tuş kodundan okunabilir ad (yedek; arayüz odaktaysa renderer klavye düzenine göre adlandırır).
const KEY_NAMES = new Map<number, string>(
  Object.entries(UiohookKey).map(([name, code]) => [code as number, name])
)
const TR_NAMES: Record<string, string> = {
  Space: 'Boşluk',
  Ctrl: 'Ctrl',
  CtrlRight: 'Sağ Ctrl',
  Alt: 'Alt',
  AltRight: 'AltGr',
  Shift: 'Shift',
  ShiftRight: 'Sağ Shift',
  CapsLock: 'Caps Lock',
  Backquote: '"',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Geri Sil',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down'
}

function keyLabel(code: number): string {
  const name = KEY_NAMES.get(code)
  if (!name) return `Tuş ${code}`
  return TR_NAMES[name] ?? name.replace(/^Numpad/, 'Num ')
}

function mouseLabel(button: number): string {
  return button === 3 ? 'Fare orta tuşu' : `Fare ${button}. tuş`
}

function emit(state: boolean): void {
  if (state === down) return
  down = state
  if (target && !target.isDestroyed()) target.send('ptt:state', state)
}

function matches(kind: PttBinding['kind'], code: number): boolean {
  return enabled && !!binding && binding.kind === kind && binding.code === code
}

function onKeyDown(e: UiohookKeyboardEvent): void {
  if (capture) {
    const done = capture
    capture = null
    done(e.keycode === UiohookKey.Escape ? null : { kind: 'key', code: e.keycode, label: keyLabel(e.keycode) })
    sync()
    return
  }
  if (matches('key', e.keycode)) emit(true)
}

function onKeyUp(e: UiohookKeyboardEvent): void {
  if (matches('key', e.keycode)) emit(false)
}

function onMouseDown(e: UiohookMouseEvent): void {
  const button = Number(e.button)
  // Sol ve sağ tık atanamaz (her tıklamada mikrofon açılırdı).
  if (capture && button >= 3) {
    const done = capture
    capture = null
    done({ kind: 'mouse', code: button, label: mouseLabel(button) })
    sync()
    return
  }
  if (matches('mouse', button)) emit(true)
}

function onMouseUp(e: UiohookMouseEvent): void {
  if (matches('mouse', Number(e.button))) emit(false)
}

/** Kancayı yalnızca gerektiğinde çalıştırır. */
function sync(): void {
  const need = (enabled && !!binding) || !!capture
  try {
    if (need && !running) {
      uIOhook.start()
      running = true
    } else if (!need && running) {
      uIOhook.stop()
      running = false
    }
  } catch (e) {
    running = false
    console.error('[bas-konuş] klavye kancası başlatılamadı:', e)
    if (target && !target.isDestroyed()) target.send('ptt:error')
  }
  if (!enabled) emit(false)
}

export function setupPtt(): void {
  uIOhook.on('keydown', onKeyDown)
  uIOhook.on('keyup', onKeyUp)
  uIOhook.on('mousedown', onMouseDown)
  uIOhook.on('mouseup', onMouseUp)

  ipcMain.on('ptt:set', (event, cfg: { enabled: boolean; binding: PttBinding | null }) => {
    target = event.sender
    enabled = !!cfg?.enabled
    binding = cfg?.binding && Number.isInteger(cfg.binding.code) ? cfg.binding : null
    sync()
  })

  // Sıradaki tuş ya da fare yan tuşu atanır; Esc iptal eder.
  ipcMain.handle('ptt:capture', (event) => {
    target = event.sender
    capture?.(null)
    return new Promise<PttCaptured | null>((resolve) => {
      capture = resolve
      sync()
    })
  })
  ipcMain.on('ptt:cancel-capture', () => {
    capture?.(null)
    capture = null
    sync()
  })
}

export function stopPtt(): void {
  enabled = false
  capture?.(null)
  capture = null
  if (running) {
    try {
      uIOhook.stop()
    } catch {
      // kapanırken önemsiz
    }
    running = false
  }
}
