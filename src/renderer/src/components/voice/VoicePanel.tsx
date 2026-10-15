import { useNavigate } from 'react-router-dom'
import { PhoneOff, SignalHigh, SignalLow, SignalMedium, SlidersHorizontal, TriangleAlert, X } from 'lucide-react'
import { clearVoiceError, leaveVoice, useVoice, type VoiceQuality } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { useModal } from '@/stores/modal'
import { Tooltip } from '@/components/ui/tooltip'

/** Bağlantı kalitesi hem renk hem sinyal ikonuyla: iyi online, orta idle, kötü dnd. */
export function grade(q: VoiceQuality | null): 'good' | 'fair' | 'bad' {
  if (!q || q.rtt == null) return 'good'
  const loss = q.loss ?? 0
  if (q.rtt < 150 && loss < 1) return 'good'
  if (q.rtt < 300 && loss < 5) return 'fair'
  return 'bad'
}

export const GRADE = {
  good: { Icon: SignalHigh, color: 'text-online', label: 'Bağlantı iyi' },
  fair: { Icon: SignalMedium, color: 'text-idle', label: 'Bağlantı orta' },
  bad: { Icon: SignalLow, color: 'text-dnd', label: 'Bağlantı zayıf' }
}

function qualityText(q: VoiceQuality | null): string | null {
  if (!q || q.rtt == null) return null
  const loss = q.loss == null ? '' : ` · kayıp %${q.loss.toFixed(q.loss < 10 ? 1 : 0).replace('.', ',')}`
  const relay = q.relay ? ` · aktarıcı (${q.relay.toUpperCase()})` : ''
  return `${q.rtt} ms${loss}${relay}`
}

const smallIconBtn =
  'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header'

/** Kenar çubuğunun altında, yalnızca sesliyken görünen "Ses Bağlandı" paneli (58px, rail zemin). */
export default function VoicePanel(): React.JSX.Element | null {
  const v = useVoice()
  const navigate = useNavigate()
  const openModal = useModal((s) => s.open)

  if (v.status === 'idle') {
    if (!v.error) return null
    return (
      <div role="alert" className="flex items-start gap-2 border-b border-border bg-dnd-soft px-3 py-2 text-meta text-text">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-dnd" />
        <span className="min-w-0 flex-1">{v.error}</span>
        <Tooltip label="Kapat">
          <button onClick={clearVoiceError} aria-label="Kapat" className={cn(smallIconBtn, 'h-5 w-5')}>
            <X className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
    )
  }

  const connecting = v.status !== 'connected'
  const g = GRADE[connecting ? 'fair' : grade(v.quality)]
  const detail = qualityText(v.quality)

  return (
    <div className="bg-rail">
      <div className="flex min-h-voice-panel items-center gap-2 py-1.5 pl-3 pr-2">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <div className={cn('flex items-center gap-1 text-[13px] font-semibold leading-4', g.color)}>
            <g.Icon className="h-4 w-4 shrink-0" />
            {connecting ? 'Bağlanıyor…' : 'Ses Bağlandı'}
          </div>
          <button
            onClick={() => navigate(`/channels/${v.serverId}/${v.channelId}`)}
            className="block max-w-full truncate text-left text-meta text-text hover:underline"
          >
            {v.channelName} / {v.serverName}
          </button>
          {detail && (
            <p className="truncate text-meta text-text-muted" aria-label="Bağlantı kalitesi">
              Bağlantı: {detail}
            </p>
          )}
        </div>
        <Tooltip label="Ses Ayarları">
          <button
            onClick={() => openModal({ type: 'voiceSettings' })}
            aria-label="Ses Ayarları"
            className={smallIconBtn}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip label="Bağlantıyı Kes">
          <button
            onClick={() => void leaveVoice()}
            aria-label="Bağlantıyı Kes"
            className={cn(smallIconBtn, 'hover:bg-dnd hover:text-on-dnd')}
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
      {v.error && (
        <p className="flex items-start gap-1 px-3 pb-2 text-meta text-idle">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {v.error}
        </p>
      )}
    </div>
  )
}
