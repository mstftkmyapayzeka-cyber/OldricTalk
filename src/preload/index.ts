import { contextBridge, ipcRenderer } from 'electron'
import type { ScreenSource } from '../shared/ipc'

// Renderer'a açılan dar köprü; Node erişimi yok.
const api = {
  platform: process.platform,
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  setBadge: (count: number): void => ipcRenderer.send('app:badge', count),
  flashFrame: (): void => ipcRenderer.send('app:flash'),
  focusWindow: (): void => ipcRenderer.send('app:focus'),
  screenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('screen:sources'),
  selectScreen: (id: string, audio: boolean): Promise<void> =>
    ipcRenderer.invoke('screen:select', id, audio)
}

contextBridge.exposeInMainWorld('oldric', api)

export type OldricApi = typeof api
