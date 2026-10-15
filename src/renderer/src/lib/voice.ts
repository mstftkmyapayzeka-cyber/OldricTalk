// Ses motoru (Cloudflare Realtime SFU); yalnızca ses, kamera/ekran paylaşımı yok. Bağlantı sayfa değişimlerinde sürer
// (Discord'daki gibi metin kanallarında gezinirken seste kalınır).
//
// Akış: katılınca bir SFU oturumu açılır, mikrofon "mic" adıyla yayınlanır ve oturum
// kimliği + yayınlanan akış adları Supabase presence ile kanaldakilere duyurulur.
// Her istemci, kanaldaki diğer kişilerin duyurduğu akışları kendisi çeker.
import { create } from 'zustand'
import { SfuSession } from './sfu'
import { setVoicePresence } from './realtime'
import { playCue } from './sounds'
import { MicPipeline } from './micPipeline'
import type { Channel, Profile } from './types'
import { useVoiceRoster, type VoiceMember } from '@/stores/voiceRoster'
import { useAudioSettings } from '@/stores/audioSettings'

type Status = 'idle' | 'connecting' | 'connected'

type VoiceState = {
  status: Status
  serverId: string | null
  channelId: string | null
  channelName: string | null
  serverName: string | null
  error: string | null
  muted: boolean
  deafened: boolean
  /** Şu an konuşanların kullanıcı kimlikleri (bağlı olunan kanalda). */
  speaking: string[]
  /** Ses sunucusuyla bağlantı kalitesi (bağlıyken birkaç saniyede bir güncellenir). */
  quality: VoiceQuality | null
}

export type VoiceQuality = {
  /** Gidiş-dönüş süresi (ms). */
  rtt: number | null
  /** Gelen seste son ölçümdeki paket kaybı (%). */
  loss: number | null
  /** Doğrudan bağlanılamayıp aktarıcı (TURN) kullanılıyorsa iletim protokolü. */
  relay: string | null
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

const IDLE = {
  status: 'idle' as Status,
  serverId: null,
  channelId: null,
  channelName: null,
  serverName: null,
  speaking: [] as string[],
  quality: null as VoiceQuality | null
}

export const useVoice = create<VoiceState>(() => ({ ...IDLE, error: null, ...loadPrefs() }))

// ---------------------------------------------------------------- iç durum
let me: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null = null
let session: SfuSession | null = null
let attempt = 0
let mutedBeforeDeafen = false

let mic: { pipeline: MicPipeline; tx: RTCRtpTransceiver } | null = null

type Remote = {
  key: string
  userId: string
  trackName: string
  mid: string | null
  track: MediaStreamTrack | null
  audio: HTMLAudioElement | null
}
/** anahtar `${sessionId}:${trackName}` */
const remotes = new Map<string, Remote>()
let reconcileTimer: ReturnType<typeof setTimeout> | null = null
let rosterUnsub: (() => void) | null = null

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
  if (!me || s.status !== 'connected' || !s.serverId || !s.channelId || !session) {
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
    session_id: session.sessionId,
    tracks: mic ? ['mic'] : []
  })
}

// ---------------------------------------------------------------- uzak akışlar
function channelMembers(): VoiceMember[] {
  const s = useVoice.getState()
  if (!s.serverId || !s.channelId) return []
  return useVoiceRoster.getState().byServer[s.serverId]?.[s.channelId] ?? []
}

function scheduleReconcile(delay = 0): void {
  if (reconcileTimer) clearTimeout(reconcileTimer)
  reconcileTimer = setTimeout(() => void reconcile(), delay)
}

/** Kanaldakilerin duyurduğu akışlarla elimizdekini eşitler: eksikleri çek, düşenleri bırak. */
async function reconcile(): Promise<void> {
  const sess = session
  if (!sess || !me || useVoice.getState().status === 'idle') return
  const wanted = new Map<string, { sessionId: string; trackName: string; userId: string }>()
  for (const m of channelMembers()) {
    if (m.user_id === me.id || !m.session_id) continue
    for (const trackName of m.tracks ?? []) {
      if (trackName !== 'mic') continue
      wanted.set(`${m.session_id}:${trackName}`, { sessionId: m.session_id, trackName, userId: m.user_id })
    }
  }

  const gone = [...remotes.values()].filter((r) => !wanted.has(r.key))
  for (const r of gone) dropRemote(r)
  const goneMids = gone.map((r) => r.mid).filter((m): m is string => !!m)
  if (goneMids.length) await sess.stopPull(goneMids).catch(() => undefined)

  const missing = [...wanted.entries()].filter(([key]) => !remotes.has(key))
  if (missing.length === 0) return
  for (const [key, w] of missing) {
    remotes.set(key, { key, userId: w.userId, trackName: w.trackName, mid: null, track: null, audio: null })
  }
  try {
    const { pulled, failed } = await sess.pull(missing.map(([, w]) => w))
    for (const p of pulled) {
      const r = remotes.get(`${p.sessionId}:${p.trackName}`)
      if (!r) continue
      r.mid = p.mid
      void p.track.then((track) => attachRemote(r, track))
    }
    // Yayıncı henüz hazır değilse biraz sonra yeniden dene.
    for (const f of failed) remotes.delete(`${f.sessionId}:${f.trackName}`)
    if (failed.length) scheduleReconcile(1500)
  } catch {
    for (const [key] of missing) {
      if (!remotes.get(key)?.mid) remotes.delete(key)
    }
    if (session === sess) scheduleReconcile(2000)
  }
}

function attachRemote(r: Remote, track: MediaStreamTrack): void {
  if (remotes.get(r.key) !== r) return
  r.track = track
  if (track.kind !== 'audio') return
  const el = new Audio()
  el.autoplay = true
  el.srcObject = new MediaStream([track])
  el.muted = useVoice.getState().deafened
  setOutputDevice(el)
  void el.play().catch(() => undefined)
  r.audio = el
  watchLevel(r.userId, el.srcObject as MediaStream)
}

function dropRemote(r: Remote): void {
  remotes.delete(r.key)
  if (r.audio) {
    r.audio.srcObject = null
    r.audio.remove()
  }
  unwatchLevel(r.userId)
}

// ---------------------------------------------------------------- konuşan algılama
const LEVEL_THRESHOLD = 0.018
let audioCtx: AudioContext | null = null
const meters = new Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>()
let meterTimer: ReturnType<typeof setInterval> | null = null

function watchLevel(userId: string, stream: MediaStream): void {
  unwatchLevel(userId)
  audioCtx ??= new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  meters.set(userId, { source, analyser })
  meterTimer ??= setInterval(sampleLevels, 120)
}

function unwatchLevel(userId: string): void {
  const m = meters.get(userId)
  if (!m) return
  m.source.disconnect()
  meters.delete(userId)
}

const buf = new Float32Array(512)
function sampleLevels(): void {
  const s = useVoice.getState()
  const now: string[] = []
  for (const [userId, { analyser }] of meters) {
    if (userId === me?.id && s.muted) continue
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    if (Math.sqrt(sum / buf.length) > LEVEL_THRESHOLD) now.push(userId)
  }
  now.sort()
  if (now.join() !== s.speaking.join()) useVoice.setState({ speaking: now })
}

// ---------------------------------------------------------------- bağlantı kalitesi
let qualityTimer: ReturnType<typeof setInterval> | null = null

function watchQuality(sess: SfuSession): void {
  stopQuality()
  let totals: { lost: number; received: number } | undefined
  qualityTimer = setInterval(() => {
    if (session !== sess) return stopQuality()
    void sess
      .quality(totals)
      .then((q) => {
        totals = q.totals
        if (session === sess) useVoice.setState({ quality: { rtt: q.rtt, loss: q.loss, relay: q.relay } })
      })
      .catch(() => undefined)
  }, 3000)
}

function stopQuality(): void {
  if (qualityTimer) clearInterval(qualityTimer)
  qualityTimer = null
}

// ---------------------------------------------------------------- mikrofon
/** Ayarlara göre işlenmiş mikrofon; gürültü engelleme yüklenemezse onsuz devam eder. */
async function createPipeline(): Promise<MicPipeline> {
  const s = useAudioSettings.getState()
  try {
    return await MicPipeline.create(s)
  } catch (e) {
    // Mikrofon hataları (izin yok, cihaz yok/meşgul) gürültü engellemeyle ilgisiz.
    const micError = e instanceof DOMException && /^Not(Allowed|Found|Readable)Error$|^Overconstrained/.test(e.name)
    if (!s.denoise || micError) throw e
    console.warn('[ses] gürültü engelleme yüklenemedi, onsuz devam ediliyor:', e)
    return MicPipeline.create({ ...s, denoise: false })
  }
}

async function startMic(): Promise<boolean> {
  let pipeline: MicPipeline | null = null
  try {
    if (!session) throw new Error('Bağlı değil.')
    pipeline = await createPipeline()
    pipeline.track.enabled = !useVoice.getState().muted
    mic = { pipeline, tx: await session.publish(pipeline.track, 'mic') }
    if (me) watchLevel(me.id, pipeline.stream)
    return true
  } catch {
    pipeline?.destroy()
    return false
  }
}

let micRestart = 0
/** Cihaz ya da işleme ayarı değişince yayını kesmeden mikrofonu yeniler. */
async function restartMic(): Promise<void> {
  const current = mic
  if (!current) return
  const mine = ++micRestart
  try {
    const next = await createPipeline()
    if (mine !== micRestart || mic !== current) return next.destroy()
    next.track.enabled = !useVoice.getState().muted
    await current.tx.sender.replaceTrack(next.track)
    mic = { pipeline: next, tx: current.tx }
    if (me) watchLevel(me.id, next.stream)
    current.pipeline.destroy()
  } catch {
    useVoice.setState({ error: 'Seçilen mikrofon açılamadı.' })
  }
}

function setOutputDevice(el: HTMLAudioElement): void {
  const id = useAudioSettings.getState().outputId
  if (id) void el.setSinkId(id).catch(() => undefined)
}

useAudioSettings.subscribe((s, prev) => {
  if (s.outputId !== prev.outputId) {
    for (const r of remotes.values()) {
      if (r.audio) void r.audio.setSinkId(s.outputId ?? '').catch(() => undefined)
    }
  }
  if (!mic) return
  if (s.inputId !== prev.inputId || s.denoise !== prev.denoise || s.agc !== prev.agc || s.echo !== prev.echo) {
    void restartMic()
  } else if (s.gateAuto !== prev.gateAuto || s.gateDb !== prev.gateDb) {
    mic.pipeline.setGate(s.gateAuto, s.gateDb)
  }
})

// ---------------------------------------------------------------- dışa açık işlemler
export async function joinVoice(channel: Channel, serverName: string): Promise<void> {
  const s = useVoice.getState()
  if (s.channelId === channel.id && s.status !== 'idle') return
  if (s.status !== 'idle') await leaveVoice(false)

  const mine = ++attempt
  useVoice.setState({
    ...IDLE,
    status: 'connecting',
    serverId: channel.server_id,
    channelId: channel.id,
    channelName: channel.name,
    serverName,
    error: null
  })
  try {
    const sess = await SfuSession.create(channel.id)
    if (mine !== attempt) {
      void sess.close()
      return
    }
    session = sess
    sess.pc.addEventListener('connectionstatechange', () => {
      if (session === sess && sess.pc.connectionState === 'failed') {
        void leaveVoice(false).then(() => useVoice.setState({ error: 'Ses bağlantısı koptu.' }))
      }
    })

    const { muted, deafened } = useVoice.getState()
    const micOk = await startMic()
    if (mine !== attempt) return
    if (!micOk) useVoice.setState({ muted: true, error: 'Mikrofona erişilemedi; sessiz katıldın.' })
    else if (deafened || muted) mic!.pipeline.track.enabled = false

    // Mikrofon yoksa ilk bağlantı ilk çekmeyle kurulur.
    if (micOk) await sess.waitConnected()
    useVoice.setState({ status: 'connected' })
    watchQuality(sess)
    playCue('join')
    publishPresence()
    rosterUnsub = useVoiceRoster.subscribe(() => scheduleReconcile(50))
    scheduleReconcile()
  } catch (e) {
    if (mine !== attempt) return
    await leaveVoice(false)
    useVoice.setState({ error: e instanceof Error ? e.message : 'Ses kanalına bağlanılamadı.' })
  }
}

export async function leaveVoice(cue = true): Promise<void> {
  const wasConnected = useVoice.getState().status !== 'idle'
  attempt++
  useVoice.setState({ ...IDLE })
  publishPresence()
  rosterUnsub?.()
  rosterUnsub = null
  if (reconcileTimer) clearTimeout(reconcileTimer)
  stopQuality()
  for (const r of [...remotes.values()]) dropRemote(r)
  for (const userId of [...meters.keys()]) unwatchLevel(userId)
  micRestart++
  mic?.pipeline.destroy()
  mic = null
  const sess = session
  session = null
  await sess?.close()
  if (cue && wasConnected) playCue('leave')
}

export async function toggleMute(): Promise<void> {
  const s = useVoice.getState()
  const muted = !s.muted
  useVoice.setState({ muted, deafened: muted ? s.deafened : false, error: null })
  if (!muted && s.deafened) setDeafenedAudio(false)
  savePrefs()
  playCue(muted ? 'mute' : 'unmute')
  if (s.status === 'connected') {
    if (mic) mic.pipeline.track.enabled = !muted
    else if (!muted && !(await startMic())) {
      useVoice.setState({ muted: true, error: 'Mikrofona erişilemedi.' })
    }
  }
  publishPresence()
}

function setDeafenedAudio(deafened: boolean): void {
  for (const r of remotes.values()) if (r.audio) r.audio.muted = deafened
}

export async function toggleDeafen(): Promise<void> {
  const s = useVoice.getState()
  const deafened = !s.deafened
  if (deafened) mutedBeforeDeafen = s.muted
  const muted = deafened ? true : mutedBeforeDeafen
  useVoice.setState({ deafened, muted })
  savePrefs()
  playCue(deafened ? 'mute' : 'unmute')
  setDeafenedAudio(deafened)
  if (mic) mic.pipeline.track.enabled = !muted
  publishPresence()
}

export function clearVoiceError(): void {
  useVoice.setState({ error: null })
}

// Bir başkası kanala girip çıkınca kısa ses.
let lastCount = 0
useVoiceRoster.subscribe(() => {
  const n = useVoice.getState().status === 'connected' ? channelMembers().length : 0
  if (lastCount && n > lastCount) playCue('join')
  else if (n && n < lastCount) playCue('leave')
  lastCount = n
})
