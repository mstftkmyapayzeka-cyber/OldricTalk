import { useEffect, useRef, useState } from 'react'
import { Headphones } from 'lucide-react'
import { MicPipeline } from '@/lib/micPipeline'
import { cn } from '@/lib/utils'
import { DEFAULT_AUDIO, setAudioSettings, useAudioSettings } from '@/stores/audioSettings'
import { Button } from '@/components/ui/button'
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

function Switch({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="flex-1">
        <span className="block font-medium text-header">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition',
          checked ? 'bg-online' : 'bg-[hsl(220_5%_40%)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </button>
    </label>
  )
}

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
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={value && list.some((d) => d.deviceId === value) ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-10 w-full rounded-sm bg-floating px-2 text-[15px] text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <option value="">Windows varsayılanı</option>
        {list.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
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
      .catch(() => !cancelled && setTestError('Mikrofon açılamadı. Windows ses ayarlarında mikrofon iznini kontrol edin.'))
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
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Ses Ayarları</DialogTitle>
          <DialogDescription>Bu ayarlar yalnızca bu bilgisayar için geçerlidir.</DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[65vh] space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <DeviceSelect
              label="Mikrofon"
              kind="audioinput"
              devices={devices}
              value={s.inputId}
              onChange={(inputId) => setAudioSettings({ inputId })}
            />
            <DeviceSelect
              label="Hoparlör / kulaklık"
              kind="audiooutput"
              devices={devices}
              value={s.outputId}
              onChange={(outputId) => setAudioSettings({ outputId })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mikrofon testi</span>
              <Button
                type="button"
                size="sm"
                variant={listening ? 'success' : 'secondary'}
                onClick={() => setListening((v) => !v)}
              >
                <Headphones className="h-4 w-4" /> {listening ? 'Dinlemeyi durdur' : 'Kendimi dinle'}
              </Button>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-floating" aria-label="Mikrofon seviyesi">
              <div
                className={cn('h-full transition-[width] duration-75', meter.open ? 'bg-online' : 'bg-[hsl(220_5%_45%)]')}
                style={{ width: `${toPct(meter.level)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-idle"
                style={{ left: `${toPct(meter.threshold)}%` }}
                title="Eşik"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {testError ??
                (meter.open
                  ? 'Ses gidiyor (yeşil). Konuşmadığınızda çubuk griye dönmeli; dönüyorsa cızırtı karşıya gitmez.'
                  : 'Konuşun: çubuk yeşile dönünce sesiniz gidiyor demektir. Sarı çizgi eşiktir.')}
            </p>
            <audio ref={loopback} hidden />
          </div>

          <Switch
            label="Gürültü engelleme (önerilen)"
            hint="Yapay zekâ ile cızırtı, fan, klavye gibi arka plan seslerini temizler."
            checked={s.denoise}
            onChange={(denoise) => setAudioSettings({ denoise })}
          />

          <div className="space-y-2">
            <Switch
              label="Giriş hassasiyetini otomatik ayarla"
              hint="Konuşmadığınız anlarda mikrofon hiç ses göndermez; eşik ortam gürültüsüne göre ayarlanır."
              checked={s.gateAuto}
              onChange={(gateAuto) => setAudioSettings({ gateAuto })}
            />
            {!s.gateAuto && (
              <label className="block space-y-1">
                <input
                  type="range"
                  min={METER_MIN_DB}
                  max={-10}
                  step={1}
                  value={s.gateDb}
                  aria-label="Giriş hassasiyeti"
                  onChange={(e) => setAudioSettings({ gateDb: Number(e.target.value) })}
                  className="w-full accent-[hsl(var(--brand))]"
                />
                <span className="block text-xs text-muted-foreground">
                  Eşik: {s.gateDb} dB — sarı çizginin solundaki sesler gönderilmez.
                </span>
              </label>
            )}
          </div>

          <Switch
            label="Otomatik ses seviyesi"
            hint="Sesinizi otomatik yükseltir/alçaltır. Cızırtı artıyorsa kapatmayı deneyin."
            checked={s.agc}
            onChange={(agc) => setAudioSettings({ agc })}
          />
          <Switch
            label="Yankı engelleme"
            hint="Hoparlörden gelen sesin mikrofona geri girmesini önler. Kulaklıkla kapatılabilir."
            checked={s.echo}
            onChange={(echo) => setAudioSettings({ echo })}
          />
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button
            type="button"
            variant="link"
            className="text-foreground"
            onClick={() => setAudioSettings({ ...DEFAULT_AUDIO, inputId: s.inputId, outputId: s.outputId })}
          >
            Varsayılanlara dön
          </Button>
          <Button type="button" onClick={onClose}>
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
