// Mikrofon işleme zinciri (Web Audio):
//   mikrofon → [RNNoise gürültü engelleme] → 80 Hz alçak kesen → 30 ms gecikme → ses kapısı → yayın
// Kapı, gecikmeden ÖNCEKİ sesi ölçer; böylece kelime başı kapı açıldıktan sonra gelir, kırpılmaz.
// Otomatik eşik, konuşulmayan anlardaki gürültü tabanını izleyip onun biraz üstüne oturur.
import { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletCode from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?raw'
import rnnoiseWasmBase64 from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?base64'
import type { AudioSettings } from '@/stores/audioSettings'

const TICK_MS = 20
const HOLD_MS = 300
const LOOKAHEAD_S = 0.03
/** Otomatik eşik: gürültü tabanının bu kadar dB üstü, şu sınırlar içinde. */
const AUTO_MARGIN_DB = 12
const AUTO_MIN_DB = -65
const AUTO_MAX_DB = -30

let wasmBinary: ArrayBuffer | null = null
let workletUrl: string | null = null

function rnnoiseAssets(): { wasm: ArrayBuffer; worklet: string } {
  if (!wasmBinary) {
    const bin = atob(rnnoiseWasmBase64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    wasmBinary = bytes.buffer
  }
  workletUrl ??= URL.createObjectURL(new Blob([rnnoiseWorkletCode], { type: 'text/javascript' }))
  return { wasm: wasmBinary, worklet: workletUrl }
}

async function openMic(s: AudioSettings): Promise<MediaStream> {
  const audio: MediaTrackConstraints = {
    echoCancellation: s.echo,
    // RNNoise açıksa tarayıcının kendi bastırması kapalı (ikisi üst üste sesi bozar).
    noiseSuppression: !s.denoise,
    autoGainControl: s.agc,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 }
  }
  if (s.inputId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { ...audio, deviceId: { exact: s.inputId } } })
    } catch (e) {
      // Seçilen cihaz çıkarılmışsa varsayılana dön.
      if (!(e instanceof DOMException) || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) throw e
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio })
}

export class MicPipeline {
  /** İşlenmiş ses; yayınlanan ve konuşma algılamada kullanılan akış. */
  readonly stream: MediaStream
  /** Gürültü engellemeden sonraki anlık seviye (dBFS). */
  levelDb = -100
  /** Kapı şu an açık mı (ses gidiyor mu). */
  gateOpen = false
  private floorDb = -70
  private lastLoud = 0
  private gateAuto: boolean
  private gateDb: number
  /** Bas-konuşta kapı hep açık; sesi tuş (track.enabled) keser. */
  private bypass: boolean
  private readonly buf: Float32Array<ArrayBuffer>
  private readonly timer: ReturnType<typeof setInterval>

  private constructor(
    private readonly ctx: AudioContext,
    private readonly raw: MediaStream,
    private readonly analyser: AnalyserNode,
    private readonly gate: GainNode,
    private readonly denoiser: RnnoiseWorkletNode | null,
    dest: MediaStreamAudioDestinationNode,
    s: AudioSettings
  ) {
    this.stream = dest.stream
    this.gateAuto = s.gateAuto
    this.gateDb = s.gateDb
    this.bypass = s.inputMode === 'ptt'
    this.buf = new Float32Array(analyser.fftSize)
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  static async create(s: AudioSettings): Promise<MicPipeline> {
    const raw = await openMic(s)
    const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    try {
      if (ctx.state === 'suspended') await ctx.resume()
      let node: AudioNode = ctx.createMediaStreamSource(raw)
      let denoiser: RnnoiseWorkletNode | null = null
      if (s.denoise) {
        const assets = rnnoiseAssets()
        await ctx.audioWorklet.addModule(assets.worklet)
        // processorOptions yapılandırılmış kopyalanır; asıl tampon önbellekte kalır.
        denoiser = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: assets.wasm.slice(0) })
        node.connect(denoiser)
        node = denoiser
      }
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 80
      node.connect(highpass)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      highpass.connect(analyser)

      const delay = ctx.createDelay(0.1)
      delay.delayTime.value = LOOKAHEAD_S
      const gate = ctx.createGain()
      gate.gain.value = 0
      const dest = ctx.createMediaStreamDestination()
      dest.channelCount = 1
      highpass.connect(delay).connect(gate).connect(dest)

      return new MicPipeline(ctx, raw, analyser, gate, denoiser, dest, s)
    } catch (e) {
      raw.getTracks().forEach((t) => t.stop())
      void ctx.close()
      throw e
    }
  }

  get track(): MediaStreamTrack {
    return this.stream.getAudioTracks()[0]
  }

  /** Mikrofonun gerçek cihaz adı (ayarlarda gösterilir). */
  get deviceLabel(): string {
    return this.raw.getAudioTracks()[0]?.label ?? ''
  }

  /** Kapının açıldığı seviye (dBFS). */
  get thresholdDb(): number {
    if (!this.gateAuto) return this.gateDb
    return Math.min(AUTO_MAX_DB, Math.max(AUTO_MIN_DB, this.floorDb + AUTO_MARGIN_DB))
  }

  setGate(auto: boolean, db: number): void {
    this.gateAuto = auto
    this.gateDb = db
  }

  setBypass(bypass: boolean): void {
    this.bypass = bypass
  }

  private tick(): void {
    this.analyser.getFloatTimeDomainData(this.buf)
    let sum = 0
    for (const v of this.buf) sum += v * v
    const db = 20 * Math.log10(Math.max(Math.sqrt(sum / this.buf.length), 1e-5))
    this.levelDb = db

    const now = performance.now()
    if (db > this.thresholdDb) {
      this.lastLoud = now
      this.gateOpen = true
    } else if (this.gateOpen && now - this.lastLoud > HOLD_MS) {
      this.gateOpen = false
    }
    // Gürültü tabanı: yalnızca konuşulmuyorken; aşağı hızlı, yukarı yavaş (≈1 dB/sn).
    if (!this.gateOpen) {
      this.floorDb = db < this.floorDb ? this.floorDb + (db - this.floorDb) * 0.2 : this.floorDb + 0.02
      this.floorDb = Math.min(-35, Math.max(-95, this.floorDb))
    }
    const open = this.bypass || this.gateOpen
    this.gate.gain.setTargetAtTime(open ? 1 : 0, this.ctx.currentTime, open ? 0.004 : 0.05)
  }

  destroy(): void {
    clearInterval(this.timer)
    this.raw.getTracks().forEach((t) => t.stop())
    this.stream.getTracks().forEach((t) => t.stop())
    this.denoiser?.destroy()
    void this.ctx.close()
  }
}
