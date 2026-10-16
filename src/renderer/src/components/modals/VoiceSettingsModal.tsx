import { useEffect, useRef, useState } from 'react'
import { Headphones, RotateCcw, TriangleAlert } from 'lucide-react'
import { MicPipeline } from '@/lib/micPipeline'
import { cn } from '@/lib/utils'
import { DEFAULT_AUDIO, setAudioSettings, useAudioSettings } from '@/stores/audioSettings'
import { Button } from '@/components/ui/button'
import { ErrorBox, Overline } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const METER_MIN_DB = -80
const toPct = (db: number): number =>
  Math.min(100, Math.max(0, ((db - METER_MIN_DB) / -METER_MIN_DB) * 100))

/** Aygıt seçimi; ilk seçenek her zaman "Windows varsayılanı". */
function DeviceSelect({
  label,
  kind,
  devices,
  value,
  onChange
}: {
  label: string
  kind: MediaDeviceKind
  devices: MediaDeviceInfo[]
  value: string | null
  onChange: (id: string | null) => void
}): React.JSX.Element {
  const list = devices.filter((d) => d.kind === kind && d.deviceId !== 'default' && d.deviceId !== 'communications')
  const options = [
    { value: '', label: 'Windows varsayılanı' },
    ...list.map((d, i) => ({ value: d.deviceId, label: d.label || `${label} ${i + 1}` }))
  ]
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Overline>{label}</Overline>
      <Select
        label={label}
        value={value && list.some((d) => d.deviceId === value) ? value : ''}
        options={options}
        onChange={(v) => onChange(v || null)}
      />
    </div>
  )
}

/** Klavye düzenine göre tuş adı (Türkçe Q'da "Ç", "Ş" doğru görünsün). */
function keyLabelFromEvent(e: KeyboardEvent): string | null {
  const named: Record<string, string> = {
    ' ': 'Boşluk',
    Control: 'Ctrl',
    AltGraph: 'AltGr',
    CapsLock: 'Caps Lock',
    Backspace: 'Geri Sil',
    ArrowUp: 'Yukarı Ok',
    ArrowDown: 'Aşağı Ok',
    ArrowLeft: 'Sol Ok',
    ArrowRight: 'Sağ Ok'
  }
  let label = named[e.key] ?? (e.key.length === 1 ? e.key.toLocaleUpperCase('tr') : e.key)
  if (e.location === 2 && ['Ctrl', 'Shift', 'Alt'].includes(label)) label = `Sağ ${label}`
  if (e.location === 3) label = `Num ${label}`
  return label === 'Escape' || label === 'Unidentified' ? null : label
}

/** Giriş modu: ses etkinliği ya da bas-konuş (+ tuş atama). */
function InputModeSection(): React.JSX.Element {
  const s = useAudioSettings()
  const [capturing, setCapturing] = useState(false)
  const lastLabel = useRef<string | null>(null)
  const supported = !!window.oldric?.capturePtt

  // Tuş atanırken basılan tuş pencerede başka bir şey yapmasın (Esc pencereyi kapatmasın).
  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      lastLabel.current = keyLabelFromEvent(e)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing])

  useEffect(() => () => window.oldric?.cancelPttCapture(), [])

  async function assign(): Promise<void> {
    if (!window.oldric) return
    lastLabel.current = null
    setCapturing(true)
    const result = await window.oldric.capturePtt()
    // Pencere odaktaysa tuş adını klavye düzeninden al (ana süreçten gelen ad yedek).
    await new Promise((r) => setTimeout(r, 60))
    setCapturing(false)
    if (!result) return
    const label = result.kind === 'key' ? (lastLabel.current ?? result.label) : result.label
    setAudioSettings({ pttKey: { kind: result.kind, code: result.code, label }, inputMode: 'ptt' })
  }

  function cancel(): void {
    window.oldric?.cancelPttCapture()
    setCapturing(false)
  }

  const modes = [
    { id: 'voice' as const, label: 'Ses Etkinliği' },
    { id: 'ptt' as const, label: 'Bas-Konuş' }
  ]

  return (
    <div className="mt-5 flex flex-col gap-1.5">
      <Overline>Giriş modu</Overline>
      <div role="radiogroup" aria-label="Giriş modu" className="flex items-center gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={s.inputMode === m.id}
            disabled={m.id === 'ptt' && !supported}
            onClick={() => setAudioSettings({ inputMode: m.id })}
            className={cn(
              'inline-flex h-7 items-center rounded-sm px-3 text-label font-semibold transition-colors duration-fast disabled:opacity-45',
              s.inputMode === m.id ? 'bg-selected text-header' : 'text-text-muted hover:bg-hover hover:text-text'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="text-meta text-text-muted">
        {s.inputMode === 'ptt'
          ? 'Ses yalnızca tuş basılıyken gider; uygulama arka plandayken de çalışır.'
          : 'Konuştuğunda mikrofon kendiliğinden açılır.'}
      </span>

      {s.inputMode === 'ptt' && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Overline>Bas-konuş tuşu</Overline>
          <div className="flex items-center gap-2">
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'flex h-10 min-w-0 flex-1 items-center rounded-md border bg-input px-3 text-[14px] leading-5',
                capturing
                  ? 'border-brand text-text-muted shadow-[0_0_0_2px_hsl(var(--brand-soft))]'
                  : 'border-border-strong text-header'
              )}
            >
              {capturing ? (
                'Bir tuşa ya da fare yan tuşuna bas… (Esc: vazgeç)'
              ) : s.pttKey ? (
                <kbd className="rounded-xs border border-border-strong bg-floating px-2 py-0.5 font-mono text-[13px] font-medium shadow-sm">
                  {s.pttKey.label}
                </kbd>
              ) : (
                <span className="text-text-muted">Tuş atanmadı</span>
              )}
            </div>
            {capturing ? (
              <Button type="button" variant="ghost" onClick={cancel}>
                Vazgeç
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => void assign()}>
                {s.pttKey ? 'Değiştir' : 'Tuş Ata'}
              </Button>
            )}
          </div>
          {!s.pttKey && !capturing ? (
            <span className="flex items-center gap-1 text-meta text-idle">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Tuş atamadan bas-konuşta sesin gitmez.
            </span>
          ) : (
            <span className="text-meta text-text-muted">
              Yönetici olarak açılmış oyunların içindeyken tuş algılanmayabilir.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function VoiceSettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const s = useAudioSettings()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [meter, setMeter] = useState({ level: METER_MIN_DB, threshold: -50, open: false })
  const [testError, setTestError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [preview, setPreview] = useState<MicPipeline | null>(null)
  const loopback = useRef<HTMLAudioElement | null>(null)

  // Cihaz listesi (takılıp çıkarılınca güncellenir).
  useEffect(() => {
    const refresh = (): void => {
      void navigator.mediaDevices.enumerateDevices().then(setDevices)
    }
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [])

  // Önizleme mikrofonu: cihaz/işleme ayarı değişince yeniden kurulur.
  useEffect(() => {
    let cancelled = false
    let pipeline: MicPipeline | null = null
    setTestError(null)
    void MicPipeline.create(useAudioSettings.getState())
      .then((p) => {
        if (cancelled) return p.destroy()
        pipeline = p
        setPreview(p)
        // İzin verildikten sonra cihaz adları görünür olur.
        void navigator.mediaDevices.enumerateDevices().then(setDevices)
      })
      .catch(() => !cancelled && setTestError('Mikrofon açılamadı. Windows ses ayarlarında mikrofon iznini kontrol et.'))
    return () => {
      cancelled = true
      pipeline?.destroy()
    }
  }, [s.inputId, s.denoise, s.agc, s.echo])

  useEffect(() => {
    preview?.setGate(s.gateAuto, s.gateDb)
    preview?.setBypass(s.inputMode === 'ptt')
  }, [preview, s.gateAuto, s.gateDb, s.inputMode])

  // Bas-konuşta ses kapısı yok: çubuk yalnızca sesin geldiğini gösterir.
  const ptt = s.inputMode === 'ptt'
  const meterActive = ptt ? meter.level > -60 : meter.open

  // Ölçer.
  useEffect(() => {
    if (!preview) return
    let raf = 0
    const loop = (): void => {
      setMeter({ level: preview.levelDb, threshold: preview.thresholdDb, open: preview.gateOpen })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [preview])

  // "Kendimi dinle": işlenmiş sesi seçili kulaklıktan çalar.
  useEffect(() => {
    const el = loopback.current
    if (!el) return
    if (listening && preview) {
      el.srcObject = preview.stream
      void el.setSinkId(s.outputId ?? '').catch(() => undefined)
      void el.play().catch(() => undefined)
    } else {
      el.pause()
      el.srcObject = null
    }
  }, [listening, preview, s.outputId])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-modal-lg">
        <DialogHeader>
          <DialogTitle>Ses Ayarları</DialogTitle>
          <DialogDescription>Bu ayarlar yalnızca bu bilgisayar için geçerlidir.</DialogDescription>
        </DialogHeader>
        <DialogBody className="thin-scroll max-h-[65vh] space-y-0 overflow-y-auto">
          <div className="flex items-start gap-3">
            <DeviceSelect
              label="Mikrofon"
              kind="audioinput"
              devices={devices}
              value={s.inputId}
              onChange={(inputId) => setAudioSettings({ inputId })}
            />
            <DeviceSelect
              label="Hoparlör / Kulaklık"
              kind="audiooutput"
              devices={devices}
              value={s.outputId}
              onChange={(outputId) => setAudioSettings({ outputId })}
            />
          </div>

          <InputModeSection />

          <div className="mt-5 flex items-center justify-between">
            <Overline>Mikrofon testi</Overline>
            <Button
              type="button"
              size="sm"
              variant={listening ? 'success' : 'outline'}
              onClick={() => setListening((v) => !v)}
            >
              <Headphones className="h-3.5 w-3.5" /> {listening ? 'Dinlemeyi Durdur' : 'Kendimi dinle'}
            </Button>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {/* Seviye çubuğu: konuşurken online, sessizken border-strong; eşik çizgisi idle, çubuğun üstüne taşar. */}
            <div className="relative" role="meter" aria-label="Mikrofon seviyesi" aria-valuemin={METER_MIN_DB} aria-valuemax={0} aria-valuenow={Math.round(meter.level)}>
              <div className="h-2.5 overflow-hidden rounded-pill border border-border bg-input">
                <div
                  className={cn('h-full transition-[width] duration-75', meterActive ? 'bg-online' : 'bg-border-strong')}
                  style={{ width: `${toPct(meter.level)}%` }}
                />
              </div>
              {!ptt && (
                <div
                  className="absolute -bottom-[3px] -top-[3px] w-0.5 rounded-pill bg-idle"
                  style={{ left: `${toPct(meter.threshold)}%` }}
                  title="Eşik"
                />
              )}
            </div>
            {testError ? (
              <ErrorBox>{testError}</ErrorBox>
            ) : (
              <span className="text-meta text-text-muted">
                {ptt
                  ? 'Konuşmaya başla; çubuk sesinin mikrofona ulaştığını gösterir. Bas-konuşta ses yalnızca tuş basılıyken gider.'
                  : 'Konuşmaya başla; çubuk sarı çizgiyi geçtiğinde sesin karşı tarafa gider.'}
              </span>
            )}
            <audio ref={loopback} hidden />
          </div>

          <div className="mt-3">
            <SwitchRow
              title="Gürültü engelleme (önerilen)"
              desc="Klavye sesini, fan uğultusunu ve cızırtıyı bastırır."
              checked={s.denoise}
              onChange={(denoise) => setAudioSettings({ denoise })}
            />
            {!ptt && (
              <SwitchRow
                title="Giriş hassasiyetini otomatik ayarla"
                desc="Kapatırsan eşiği kendin belirlersin."
                checked={s.gateAuto}
                onChange={(gateAuto) => setAudioSettings({ gateAuto })}
              >
                {!s.gateAuto && (
                  <div className="flex max-w-[320px] flex-col gap-2">
                    <input
                      type="range"
                      min={METER_MIN_DB}
                      max={-10}
                      step={1}
                      value={s.gateDb}
                      aria-label="Giriş hassasiyeti"
                      onChange={(e) => setAudioSettings({ gateDb: Number(e.target.value) })}
                      className="range"
                      style={{ ['--fill' as string]: `${((s.gateDb - METER_MIN_DB) / (-10 - METER_MIN_DB)) * 100}%` }}
                    />
                    <span className="text-meta text-text-muted">Eşik: {s.gateDb} dB</span>
                  </div>
                )}
              </SwitchRow>
            )}
            <SwitchRow
              title="Otomatik ses seviyesi"
              desc="Sesini diğer kişilerle aynı seviyeye getirir; cızırtı artarsa kapatmayı dene."
              checked={s.agc}
              onChange={(agc) => setAudioSettings({ agc })}
            />
            <SwitchRow
              title="Yankı engelleme"
              desc="Hoparlörden çıkan sesin mikrofona geri dönmesini önler."
              checked={s.echo}
              onChange={(echo) => setAudioSettings({ echo })}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              // Cihazlar, giriş modu ve bas-konuş tuşu korunur; yalnızca ses işleme sıfırlanır.
              setAudioSettings({
                ...DEFAULT_AUDIO,
                inputId: s.inputId,
                outputId: s.outputId,
                inputMode: s.inputMode,
                pttKey: s.pttKey
              })
            }
          >
            <RotateCcw className="h-4 w-4" /> Varsayılanlara dön
          </Button>
          <div className="flex-1" />
          <Button type="button" onClick={onClose}>
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
