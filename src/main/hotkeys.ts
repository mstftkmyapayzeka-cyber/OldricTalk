// Ses kısayolları: bas-konuş (basılı tut) ve mikrofonu aç/kapat (bas-bırak). Uygulama arka
// plandayken (ör. oyundayken) de çalışır. Electron'un globalShortcut'ı bırakma olayı vermediği
// için sistem geneli klavye/fare kancası (uiohook) kullanılır.
//
// Gizlilik: kanca yalnızca en az bir kısayol etkinken (renderer bunu sesteyken açar) ya da tuş
// atanırken çalışır; atanmış tuşlar dışındaki hiçbir tuşa bakılmaz, hiçbir şey saklanmaz.
import { ipcMain, type WebContents } from 'electron'
import { uIOhook, UiohookKey, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'

export type HotkeyAction = 'ptt' | 'mute'
export type HotkeyBinding = { kind: 'key' | 'mouse'; code: number }
export type HotkeyCaptured = HotkeyBinding & { label: string }
export type HotkeyConfig = Record<HotkeyAction, HotkeyBinding | null>

const ACTIONS: HotkeyAction[] = ['ptt', 'mute']
let active: HotkeyConfig = { ptt: null, mute: null }
const down: Record<HotkeyAction, boolean> = { ptt: false, mute: false }
let capture: ((result: HotkeyCaptured | null) => void) | null = null
let running = false
let target: WebContents | null = null

// Tuş kodundan okunabilir ad (yedek; arayüz odaktaysa renderer klavye düzenine göre adlandırır).
const KEY_NAMES = new Map<number, string>(
  Object.entries(UiohookKey).map(([name, code]) => [code as number, name])
)
const TR_NAMES: Record<string, string> = {
  Space: 'Boşluk',
  CtrlRight: 'Sağ Ctrl',
  AltRight: 'AltGr',
  ShiftRight: 'Sağ Shift',
  CapsLock: 'Caps Lock',
  Backspace: 'Geri Sil',
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

function send(channel: string, ...args: unknown[]): void {
  if (target && !target.isDestroyed()) target.send(channel, ...args)
}

/** Basılı/bırakıldı geçişlerini bildirir; tuş tekrarı yeni olay üretmez. */
function press(kind: HotkeyBinding['kind'], code: number, state: boolean): void {
  for (const action of ACTIONS) {
    const b = active[action]
    if (!b || b.kind !== kind || b.code !== code || down[action] === state) continue
    down[action] = state
    send('hotkey', action, state)
  }
}

function finishCapture(result: HotkeyCaptured | null): void {
  const done = capture
  capture = null
  done?.(result)
  sync()
}

function onKeyDown(e: UiohookKeyboardEvent): void {
  if (capture) {
    finishCapture(e.keycode === UiohookKey.Escape ? null : { kind: 'key', code: e.keycode, label: keyLabel(e.keycode) })
    return
  }
  press('key', e.keycode, true)
}

function onMouseDown(e: UiohookMouseEvent): void {
  const button = Number(e.button)
  // Sol ve sağ tık atanamaz (her tıklamada tetiklenirdi).
  if (capture) {
    if (button >= 3) finishCapture({ kind: 'mouse', code: button, label: mouseLabel(button) })
    return
  }
  press('mouse', button, true)
}

/** Kancayı yalnızca gerektiğinde çalıştırır. */
function sync(): void {
  const need = ACTIONS.some((a) => active[a]) || !!capture
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
    console.error('[kısayol] klavye kancası başlatılamadı:', e)
    send('hotkey:error')
  }
  // Devre dışı kalan kısayol basılı kalmasın.
  for (const action of ACTIONS) {
    if (!active[action] && down[action]) {
      down[action] = false
      send('hotkey', action, false)
    }
  }
}

function sanitize(b: unknown): HotkeyBinding | null {
  const v = b as HotkeyBinding | null
  return v && (v.kind === 'key' || v.kind === 'mouse') && Number.isInteger(v.code) ? { kind: v.kind, code: v.code } : null
}

export function setupHotkeys(): void {
  uIOhook.on('keydown', onKeyDown)
  uIOhook.on('keyup', (e) => press('key', e.keycode, false))
  uIOhook.on('mousedown', onMouseDown)
  uIOhook.on('mouseup', (e) => press('mouse', Number(e.button), false))

  // Etkin kısayollar: verilmeyen ya da null olan eylem dinlenmez.
  ipcMain.on('hotkeys:set', (event, cfg: Partial<HotkeyConfig>) => {
    target = event.sender
    active = { ptt: sanitize(cfg?.ptt), mute: sanitize(cfg?.mute) }
    sync()
  })

  // Sıradaki tuş ya da fare yan tuşu atanır; Esc iptal eder.
  ipcMain.handle('hotkeys:capture', (event) => {
    target = event.sender
    capture?.(null)
    return new Promise<HotkeyCaptured | null>((resolve) => {
      capture = resolve
      sync()
    })
  })
  ipcMain.on('hotkeys:cancel-capture', () => finishCapture(null))
}

export function stopHotkeys(): void {
  active = { ptt: null, mute: null }
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
