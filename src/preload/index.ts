import { contextBridge, ipcRenderer } from 'electron'

// Renderer'a açılan dar köprü; Node erişimi yok.
const api = {
  platform: process.platform,
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  setBadge: (count: number): void => ipcRenderer.send('app:badge', count),
  flashFrame: (): void => ipcRenderer.send('app:flash'),
  focusWindow: (): void => ipcRenderer.send('app:focus'),
  setTheme: (theme: 'light' | 'dark'): void => ipcRenderer.send('app:theme', theme),
  /** Bas-konuş: ana süreçteki klavye kancasını açar/kapatır. */
  setPtt: (cfg: { enabled: boolean; binding: PttBinding | null }): void => ipcRenderer.send('ptt:set', cfg),
  /** Sıradaki tuşu ya da fare yan tuşunu yakalar; Esc → null. */
  capturePtt: (): Promise<PttCaptured | null> => ipcRenderer.invoke('ptt:capture'),
  cancelPttCapture: (): void => ipcRenderer.send('ptt:cancel-capture'),
  /** Tuş basıldı/bırakıldı; dinlemeyi bırakmak için dönen işlevi çağır. */
  onPtt: (cb: (down: boolean) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, down: boolean): void => cb(down)
    ipcRenderer.on('ptt:state', listener)
    return () => ipcRenderer.removeListener('ptt:state', listener)
  },
  onPttError: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('ptt:error', listener)
    return () => ipcRenderer.removeListener('ptt:error', listener)
  }
}

export type PttBinding = { kind: 'key' | 'mouse'; code: number }
export type PttCaptured = PttBinding & { label: string }

contextBridge.exposeInMainWorld('oldric', api)

export type OldricApi = typeof api
