import { create } from 'zustand'

/** Ses ayarları; bu bilgisayara özel, localStorage'da saklanır. */
export type AudioSettings = {
  /** Mikrofon cihazı; null = Windows varsayılanı. */
  inputId: string | null
  /** Hoparlör / kulaklık; null = Windows varsayılanı. */
  outputId: string | null
  /** Yapay zekâ ile gürültü engelleme (RNNoise): cızırtı, fan, klavye. */
  denoise: boolean
  /** Ses kapısı eşiği otomatik mi, elle mi. */
  gateAuto: boolean
  /** Elle eşik (dBFS); bunun altındaki ses gönderilmez. */
  gateDb: number
  /** Otomatik ses seviyesi (AGC). */
  agc: boolean
  /** Yankı engelleme. */
  echo: boolean
  /** Ses etkinliği (konuşunca açılır) ya da bas-konuş (tuş basılıyken açılır). */
  inputMode: 'voice' | 'ptt'
  /** Bas-konuş tuşu; label klavye düzenine göre gösterilen ad. */
  pttKey: HotkeyBinding | null
  /** Mikrofonu aç/kapat tuşu (sesteyken, uygulama arka plandayken de). */
  muteKey: HotkeyBinding | null
}

export type HotkeyBinding = { kind: 'key' | 'mouse'; code: number; label: string }

const KEY = 'oldrictalk-audio-settings'

export const DEFAULT_AUDIO: AudioSettings = {
  inputId: null,
  outputId: null,
  denoise: true,
  gateAuto: true,
  gateDb: -50,
  agc: true,
  echo: true,
  inputMode: 'voice',
  pttKey: null,
  muteKey: null
}

function load(): AudioSettings {
  try {
    return { ...DEFAULT_AUDIO, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_AUDIO
  }
}

export const useAudioSettings = create<AudioSettings>(() => load())

export function setAudioSettings(patch: Partial<AudioSettings>): void {
  useAudioSettings.setState(patch)
  localStorage.setItem(KEY, JSON.stringify(useAudioSettings.getState()))
}
