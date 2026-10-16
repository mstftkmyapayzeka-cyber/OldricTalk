import { contextBridge, ipcRenderer } from 'electron'

// Renderer'a açılan dar köprü; Node erişimi yok.
const api = {
  platform: process.platform,
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  setBadge: (count: number): void => ipcRenderer.send('app:badge', count),
  flashFrame: (): void => ipcRenderer.send('app:flash'),
  focusWindow: (): void => ipcRenderer.send('app:focus'),
  setTheme: (theme: 'light' | 'dark'): void => ipcRenderer.send('app:theme', theme),
  /** Ses kısayolları (bas-konuş, mikrofon aç/kapat): null olan dinlenmez; hepsi null → kanca durur. */
  setHotkeys: (cfg: Record<HotkeyAction, HotkeyBinding | null>): void => ipcRenderer.send('hotkeys:set', cfg),
  /** Sıradaki tuşu ya da fare yan tuşunu yakalar; Esc → null. */
  captureHotkey: (): Promise<HotkeyCaptured | null> => ipcRenderer.invoke('hotkeys:capture'),
  cancelHotkeyCapture: (): void => ipcRenderer.send('hotkeys:cancel-capture'),
  /** Kısayol basıldı/bırakıldı; dinlemeyi bırakmak için dönen işlevi çağır. */
  onHotkey: (cb: (action: HotkeyAction, down: boolean) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, action: HotkeyAction, down: boolean): void => cb(action, down)
    ipcRenderer.on('hotkey', listener)
    return () => ipcRenderer.removeListener('hotkey', listener)
  },
  onHotkeyError: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('hotkey:error', listener)
    return () => ipcRenderer.removeListener('hotkey:error', listener)
  }
}

export type HotkeyAction = 'ptt' | 'mute'
export type HotkeyBinding = { kind: 'key' | 'mouse'; code: number }
export type HotkeyCaptured = HotkeyBinding & { label: string }

contextBridge.exposeInMainWorld('oldric', api)

export type OldricApi = typeof api
