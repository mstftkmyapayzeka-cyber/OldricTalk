import { useEffect, useRef, useState } from 'react'
import { Headphones, RotateCcw } from 'lucide-react'
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
  }, [preview, s.gateAuto, s.gateDb])

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
                  className={cn('h-full transition-[width] duration-75', meter.open ? 'bg-online' : 'bg-border-strong')}
                  style={{ width: `${toPct(meter.level)}%` }}
                />
              </div>
              <div
                className="absolute -bottom-[3px] -top-[3px] w-0.5 rounded-pill bg-idle"
                style={{ left: `${toPct(meter.threshold)}%` }}
                title="Eşik"
              />
            </div>
            {testError ? (
              <ErrorBox>{testError}</ErrorBox>
            ) : (
              <span className="text-meta text-text-muted">
                Konuşmaya başla; çubuk sarı çizgiyi geçtiğinde sesin karşı tarafa gider.
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
            onClick={() => setAudioSettings({ ...DEFAULT_AUDIO, inputId: s.inputId, outputId: s.outputId })}
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
