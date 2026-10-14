// Ses/görüntü bağlantısı: uygulama boyunca tek bir LiveKit odası. Bağlantı sayfa
// değişimlerinde sürer (Discord'daki gibi metin kanallarında gezinirken seste kalınır).
import { create } from 'zustand'
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  VideoPresets
} from 'livekit-client'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { setVoicePresence } from './realtime'
import { playCue } from './sounds'
import type { Channel, Profile } from './types'

export const room = new Room({
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  publishDefaults: { dtx: true, red: true, screenShareEncoding: ScreenSharePresets.h1080fps30.encoding }
})

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting'

type VoiceState = {
  status: Status
  serverId: string | null
  channelId: string | null
  channelName: string | null
  serverName: string | null
  error: string | null
  muted: boolean
  deafened: boolean
  camera: boolean
  screen: boolean
  /** Şu an konuşanların kimlikleri (yalnızca bağlı olunan kanalda bilinir). */
  speaking: string[]
}

const PREFS_KEY = 'oldrictalk-voice-prefs'

function loadPrefs(): { muted: boolean; deafened: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
    return { muted: !!p.muted, deafened: !!p.deafened }
  } catch {
    return { muted: false, deafened: false }
  }
}

export const useVoice = create<VoiceState>(() => ({
  status: 'idle',
  serverId: null,
  channelId: null,
  channelName: null,
  serverName: null,
  error: null,
  camera: false,
  screen: false,
  speaking: [],
  ...loadPrefs()
}))

let me: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null = null
let mutedBeforeDeafen = false

export function setVoiceIdentity(p: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>): void {
  me = p
  publishPresence()
}

function savePrefs(): void {
  const { muted, deafened } = useVoice.getState()
  localStorage.setItem(PREFS_KEY, JSON.stringify({ muted, deafened }))
}

function publishPresence(): void {
  const s = useVoice.getState()
  if (!me || s.status === 'idle' || !s.serverId || !s.channelId) {
    setVoicePresence(null, null)
    return
  }
  setVoicePresence(s.serverId, {
    user_id: me.id,
    channel_id: s.channelId,
    name: me.display_name,
    avatar_url: me.avatar_url,
    muted: s.muted,
    deafened: s.deafened,
    video: s.camera,
    screen: s.screen
  })
}

async function tokenFor(channelId: string): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { channel_id: channelId }
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.hint ?? 'Ses kanalına bağlanılamadı.')
    }
    throw new Error('Ses sunucusuna ulaşılamadı.')
  }
  return data as { token: string; url: string }
}

export async function joinVoice(channel: Channel, serverName: string): Promise<void> {
  const s = useVoice.getState()
  if (s.channelId === channel.id && s.status !== 'idle') return
  if (s.status !== 'idle') await leaveVoice(false)

  useVoice.setState({
    status: 'connecting',
    serverId: channel.server_id,
    channelId: channel.id,
    channelName: channel.name,
    serverName,
    error: null,
    camera: false,
    screen: false
  })
  try {
    const { token, url } = await tokenFor(channel.id)
    // Bu arada başka kanala geçildiyse vazgeç.
    if (useVoice.getState().channelId !== channel.id) return
    await room.connect(url, token, { autoSubscribe: true })
    useVoice.setState({ status: 'connected' })
    playCue('join')
    const { muted, deafened } = useVoice.getState()
    if (!muted && !deafened) {
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
      } catch {
        useVoice.setState({ muted: true, error: 'Mikrofona erişilemedi; sessiz katıldın.' })
      }
    }
    publishPresence()
  } catch (e) {
    await room.disconnect()
    useVoice.setState({
      status: 'idle',
      serverId: null,
      channelId: null,
      channelName: null,
      serverName: null,
      error: e instanceof Error ? e.message : 'Ses kanalına bağlanılamadı.'
    })
    publishPresence()
  }
}

export async function leaveVoice(cue = true): Promise<void> {
  if (useVoice.getState().status === 'idle') return
  useVoice.setState({
    status: 'idle',
    serverId: null,
    channelId: null,
    channelName: null,
    serverName: null,
    camera: false,
    screen: false,
    speaking: []
  })
  publishPresence()
  await room.disconnect()
  if (cue) playCue('leave')
}

export async function toggleMute(): Promise<void> {
  const s = useVoice.getState()
  const muted = !s.muted
  // Sağırken mikrofon açılırsa sağırlık da kalkar (Discord davranışı).
  useVoice.setState({ muted, deafened: muted ? s.deafened : false })
  savePrefs()
  playCue(muted ? 'mute' : 'unmute')
  if (s.status === 'connected') {
    try {
      await room.localParticipant.setMicrophoneEnabled(!muted)
    } catch {
      useVoice.setState({ muted: true, error: 'Mikrofona erişilemedi.' })
    }
  }
  publishPresence()
}

export async function toggleDeafen(): Promise<void> {
  const s = useVoice.getState()
  const deafened = !s.deafened
  if (deafened) mutedBeforeDeafen = s.muted
  const muted = deafened ? true : mutedBeforeDeafen
  useVoice.setState({ deafened, muted })
  savePrefs()
  playCue(deafened ? 'mute' : 'unmute')
  if (s.status === 'connected') {
    await room.localParticipant.setMicrophoneEnabled(!muted).catch(() => {})
  }
  publishPresence()
}

export async function toggleCamera(): Promise<void> {
  const s = useVoice.getState()
  if (s.status !== 'connected') return
  try {
    await room.localParticipant.setCameraEnabled(!s.camera)
    useVoice.setState({ camera: !s.camera, error: null })
  } catch {
    useVoice.setState({ error: 'Kameraya erişilemedi.' })
  }
  publishPresence()
}

/** Kaynak önceden window.oldric.selectScreen ile seçilmiş olmalı. */
export async function startScreenShare(audio: boolean): Promise<void> {
  if (useVoice.getState().status !== 'connected') return
  try {
    await room.localParticipant.setScreenShareEnabled(true, {
      audio,
      contentHint: 'detail',
      resolution: ScreenSharePresets.h1080fps30.resolution
    })
    useVoice.setState({ screen: true, error: null })
  } catch {
    useVoice.setState({ error: 'Ekran paylaşımı başlatılamadı.' })
  }
  publishPresence()
}

export async function stopScreenShare(): Promise<void> {
  await room.localParticipant.setScreenShareEnabled(false).catch(() => {})
  useVoice.setState({ screen: false })
  publishPresence()
}

export function clearVoiceError(): void {
  useVoice.setState({ error: null })
}

// ---------------------------------------------------------------- oda olayları
room.on(RoomEvent.Reconnecting, () => useVoice.setState({ status: 'reconnecting' }))
room.on(RoomEvent.Reconnected, () => useVoice.setState({ status: 'connected' }))
room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
  if (useVoice.getState().status === 'idle') return
  const kicked = reason === DisconnectReason.DUPLICATE_IDENTITY
  useVoice.setState({
    status: 'idle',
    serverId: null,
    channelId: null,
    channelName: null,
    serverName: null,
    camera: false,
    screen: false,
    error: kicked ? 'Başka bir cihazdan bu kanala bağlandın.' : 'Ses bağlantısı koptu.'
  })
  publishPresence()
})
room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
  useVoice.setState({ speaking: speakers.map((p) => p.identity) })
)
room.on(RoomEvent.ParticipantConnected, () => playCue('join'))
room.on(RoomEvent.ParticipantDisconnected, () => {
  if (room.state === ConnectionState.Connected) playCue('leave')
})
// Paylaşım işletim sisteminden durdurulursa (ör. "Paylaşımı durdur") durumu eşitle.
room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
  if (pub.source === Track.Source.ScreenShare) useVoice.setState({ screen: false })
  if (pub.source === Track.Source.Camera) useVoice.setState({ camera: false })
  publishPresence()
})
