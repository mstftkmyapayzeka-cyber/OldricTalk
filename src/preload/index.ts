import { contextBridge, ipcRenderer } from 'electron'

// Renderer'a açılan dar köprü; Node erişimi yok.
const api = {
  platform: process.platform,
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  setBadge: (count: number): void => ipcRenderer.send('app:badge', count),
  flashFrame: (): void => ipcRenderer.send('app:flash'),
  focusWindow: (): void => ipcRenderer.send('app:focus'),
  setTheme: (theme: 'light' | 'dark'): void => ipcRenderer.send('app:theme', theme)
}

contextBridge.exposeInMainWorld('oldric', api)

export type OldricApi = typeof api
