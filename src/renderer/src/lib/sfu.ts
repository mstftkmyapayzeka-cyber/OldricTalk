// Cloudflare Realtime SFU oturumu: tek RTCPeerConnection üzerinden hem yayın (push)
// hem çekme (pull). Tüm istekler cf-sfu Edge Function'ından geçer (uygulama secret'ı
// sunucuda kalır). Aynı oturumdaki değişiklikler sıraya alınır: SFU belgeleri bir
// SDP alışverişi bitmeden yenisinin başlamamasını şart koşar.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Sdp = { type: 'offer' | 'answer'; sdp: string }
type TrackResult = {
  mid?: string
  trackName?: string
  sessionId?: string
  errorCode?: string
  errorDescription?: string
}
type TracksResponse = {
  errorCode?: string
  errorDescription?: string
  requiresImmediateRenegotiation?: boolean
  sessionDescription?: Sdp
  tracks?: TrackResult[]
}

export type PulledTrack = { sessionId: string; trackName: string; mid: string }

/** Ses kodlayıcısının hedef bit hızı (Discord'un varsayılanı). */
const OPUS_BITRATE = 64_000

/**
 * SFU'nun yanıtındaki Opus ayarlarını düzenler. Chromium gönderim bit hızını karşı tarafın
 * bildirdiği `maxaveragebitrate`'ten alır; yoksa ~32 kbps ile yetinir. Kayıp paketleri
 * telafi eden FEC açık, sessizlikte yayını kesen DTX kapalı (kelime başları kırpılmasın).
 */
function tuneOpus(sdp: string): string {
  const pt = /^a=rtpmap:(\d+) opus\/48000/im.exec(sdp)?.[1]
  if (!pt) return sdp
  const want: Record<string, string> = {
    minptime: '10',
    useinbandfec: '1',
    usedtx: '0',
    stereo: '0',
    maxaveragebitrate: String(OPUS_BITRATE)
  }
  // Her ses satırına (yayın + çekilen akışlar) uygulanır.
  const line = new RegExp(`^a=fmtp:${pt} ([^\\r\\n]*)`, 'gm')
  const merge = (params: string): string => {
    const map = new Map(
      params
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.split('=') as [string, string])
    )
    for (const [k, v] of Object.entries(want)) map.set(k, v)
    return [...map].map(([k, v]) => `${k}=${v}`).join(';')
  }
  if (sdp.match(line)) return sdp.replace(line, (_m, params: string) => `a=fmtp:${pt} ${merge(params)}`)
  return sdp.replace(
    new RegExp(`^(a=rtpmap:${pt} opus/48000[^\\r\\n]*)`, 'gim'),
    `$1\r\na=fmtp:${pt} ${merge('')}`
  )
}

/** SFU'dan gelen her SDP Opus ayarlarıyla uygulanır (sonraki alışverişler ayarı ezmesin). */
function tuned(d: Sdp): Sdp {
  return { type: d.type, sdp: tuneOpus(d.sdp) }
}

async function api<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cf-sfu', { body: payload })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.hint ?? body?.errorDescription ?? body?.error ?? 'Ses sunucusu hatası.')
    }
    throw new Error('Ses sunucusuna ulaşılamadı.')
  }
  const res = data as T & { errorCode?: string; errorDescription?: string }
  if (res?.errorCode) throw new Error(res.errorDescription ?? res.errorCode)
  return res
}

export class SfuSession {
  readonly pc: RTCPeerConnection
  private queue: Promise<unknown> = Promise.resolve()
  private closed = false
  /** Çekilen akışlar mid ile eşlenir; ontrack eşlemeden önce gelirse bekletilir. */
  private trackWaiters = new Map<string, (t: MediaStreamTrack) => void>()
  private arrived = new Map<string, MediaStreamTrack>()

  private constructor(
    readonly sessionId: string,
    iceServers: RTCIceServer[]
  ) {
    this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' })
    this.pc.ontrack = (e) => {
      const mid = e.transceiver.mid
      if (!mid) return
      const waiter = this.trackWaiters.get(mid)
      if (waiter) {
        this.trackWaiters.delete(mid)
        waiter(e.track)
      } else {
        this.arrived.set(mid, e.track)
      }
    }
  }

  static async create(channelId: string): Promise<SfuSession> {
    const res = await api<{ sessionId: string; iceServers: RTCIceServer[] }>({
      action: 'session',
      channel_id: channelId
    })
    return new SfuSession(res.sessionId, res.iceServers)
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => {
      if (this.closed) throw new Error('closed')
      return fn()
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  private call<T>(action: string, extra: Record<string, unknown>): Promise<T> {
    return api<T>({ action, session_id: this.sessionId, ...extra })
  }

  /** Bağlantı kurulana kadar bekler (ilk SDP alışverişinden sonra). */
  waitConnected(timeoutMs = 15_000): Promise<void> {
    if (this.pc.connectionState === 'connected') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('Ses sunucusuna bağlantı zaman aşımına uğradı.'))
      }, timeoutMs)
      const onChange = (): void => {
        const s = this.pc.connectionState
        if (s === 'connected') {
          cleanup()
          resolve()
        } else if (s === 'failed' || s === 'closed') {
          cleanup()
          reject(new Error('Ses sunucusuna bağlanılamadı.'))
        }
      }
      const cleanup = (): void => {
        clearTimeout(timer)
        this.pc.removeEventListener('connectionstatechange', onChange)
      }
      this.pc.addEventListener('connectionstatechange', onChange)
    })
  }

  /** Yerel bir akışı yayınlar; dönen transceiver sonradan kapatmak için saklanır. */
  publish(track: MediaStreamTrack, trackName: string, stream?: MediaStream): Promise<RTCRtpTransceiver> {
    return this.enqueue(async () => {
      const tx = this.pc.addTransceiver(track, {
        direction: 'sendonly',
        streams: stream ? [stream] : []
      })
      await this.pc.setLocalDescription(await this.pc.createOffer())
      if (!tx.mid) throw new Error('Yayın hazırlanamadı.')
      const res = await this.call<TracksResponse>('tracks', {
        sessionDescription: this.local(),
        tracks: [{ location: 'local', mid: tx.mid, trackName }]
      })
      const answer = res.sessionDescription!
      await this.pc.setRemoteDescription(tuned(answer))
      const failed = res.tracks?.find((t) => t.errorCode)
      if (failed) throw new Error(failed.errorDescription ?? failed.errorCode)
      // Ses paketleri ağda öncelikli; bit hızı tavanı SDP ile aynı.
      const params = tx.sender.getParameters()
      if (params.encodings?.length) {
        params.encodings[0].maxBitrate = OPUS_BITRATE
        params.encodings[0].priority = 'high'
        params.encodings[0].networkPriority = 'high'
        await tx.sender.setParameters(params).catch(() => undefined)
      }
      return tx
    })
  }

  /** Yayını durdurur (SDP anlaşmalı kapatma). */
  unpublish(tx: RTCRtpTransceiver): Promise<void> {
    return this.enqueue(async () => {
      const mid = tx.mid
      tx.sender.track?.stop()
      tx.stop()
      if (!mid) return
      await this.pc.setLocalDescription(await this.pc.createOffer())
      const res = await this.call<TracksResponse>('close', {
        mids: [mid],
        sessionDescription: this.local()
      })
      if (res.sessionDescription) await this.pc.setRemoteDescription(tuned(res.sessionDescription))
    })
  }

  /**
   * Uzak akışları çeker. Başarılı olanlar için mid ve gelen MediaStreamTrack döner;
   * henüz hazır olmayanlar (yayıncı daha yayınlamadı) atlanır, çağıran yeniden dener.
   */
  pull(
    remotes: { sessionId: string; trackName: string }[]
  ): Promise<{ pulled: (PulledTrack & { track: Promise<MediaStreamTrack> })[]; failed: typeof remotes }> {
    return this.enqueue(async () => {
      const res = await this.call<TracksResponse>('tracks', {
        tracks: remotes.map((r) => ({ location: 'remote', sessionId: r.sessionId, trackName: r.trackName }))
      })
      const pulled: (PulledTrack & { track: Promise<MediaStreamTrack> })[] = []
      const failed: typeof remotes = []
      res.tracks?.forEach((t, i) => {
        if (t.errorCode || !t.mid) failed.push(remotes[i])
        else
          pulled.push({
            sessionId: remotes[i].sessionId,
            trackName: remotes[i].trackName,
            mid: t.mid,
            track: this.trackFor(t.mid)
          })
      })
      if (res.requiresImmediateRenegotiation && res.sessionDescription) {
        await this.pc.setRemoteDescription(tuned(res.sessionDescription))
        await this.pc.setLocalDescription(await this.pc.createAnswer())
        await this.call('renegotiate', { sessionDescription: this.local() })
      }
      return { pulled, failed }
    })
  }

  /** Çekilen akışları bırakır. */
  stopPull(mids: string[]): Promise<void> {
    if (mids.length === 0) return Promise.resolve()
    return this.enqueue(async () => {
      for (const mid of mids) {
        this.trackWaiters.delete(mid)
        this.arrived.delete(mid)
        this.pc.getTransceivers().find((t) => t.mid === mid)?.stop()
      }
      await this.pc.setLocalDescription(await this.pc.createOffer())
      const res = await this.call<TracksResponse>('close', { mids, sessionDescription: this.local() })
      if (res.sessionDescription) await this.pc.setRemoteDescription(tuned(res.sessionDescription))
    })
  }

  /** Bağlantı kalitesi: gidiş-dönüş süresi, gelen seste paket kaybı, aktarıcı kullanımı. */
  async quality(prev?: { lost: number; received: number }): Promise<{
    rtt: number | null
    loss: number | null
    relay: string | null
    totals: { lost: number; received: number }
  }> {
    const stats = await this.pc.getStats()
    let pairId: string | undefined
    let lost = 0
    let received = 0
    stats.forEach((s) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId
      if (s.type === 'inbound-rtp' && s.kind === 'audio') {
        lost += s.packetsLost ?? 0
        received += s.packetsReceived ?? 0
      }
    })
    const pair = pairId ? stats.get(pairId) : undefined
    const local = pair ? stats.get(pair.localCandidateId) : undefined
    const dLost = lost - (prev?.lost ?? 0)
    const dTotal = dLost + received - (prev?.received ?? 0)
    return {
      rtt: pair?.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : null,
      loss: dTotal > 0 ? Math.max(0, (dLost / dTotal) * 100) : null,
      relay: local?.candidateType === 'relay' ? (local.relayProtocol ?? 'udp') : null,
      totals: { lost, received }
    }
  }

  async close(): Promise<void> {
    this.closed = true
    for (const tx of this.pc.getTransceivers()) tx.sender.track?.stop()
    this.pc.close()
    await this.call('end', {}).catch(() => undefined)
  }

  private trackFor(mid: string): Promise<MediaStreamTrack> {
    const ready = this.arrived.get(mid)
    if (ready) {
      this.arrived.delete(mid)
      return Promise.resolve(ready)
    }
    return new Promise((resolve) => this.trackWaiters.set(mid, resolve))
  }

  private local(): Sdp {
    const d = this.pc.localDescription!
    return { type: d.type as Sdp['type'], sdp: d.sdp }
  }
}
