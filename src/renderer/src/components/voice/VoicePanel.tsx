import { useNavigate } from 'react-router-dom'
import { PhoneOff, Signal, SlidersHorizontal, X } from 'lucide-react'
import { clearVoiceError, leaveVoice, useVoice, type VoiceQuality } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { useModal } from '@/stores/modal'
import { Tooltip } from '@/components/ui/tooltip'

/** Discord'daki gibi: iyi yeşil, orta sarı, kötü kırmızı. */
function grade(q: VoiceQuality | null): 'good' | 'fair' | 'bad' {
  if (!q || q.rtt == null) return 'good'
  const loss = q.loss ?? 0
  if (q.rtt < 150 && loss < 1) return 'good'
  if (q.rtt < 300 && loss < 5) return 'fair'
  return 'bad'
}

function qualityText(q: VoiceQuality | null): string | null {
  if (!q || q.rtt == null) return null
  const loss = q.loss == null ? '' : ` · kayıp %${q.loss.toFixed(q.loss < 10 ? 1 : 0).replace('.', ',')}`
  const relay = q.relay ? ` · aktarıcı (${q.relay.toUpperCase()})` : ''
  return `${q.rtt} ms${loss}${relay}`
}

/** Kenar çubuğunun altında "Ses Bağlandı" paneli (Discord'daki gibi). */
export default function VoicePanel(): React.JSX.Element | null {
  const v = useVoice()
  const navigate = useNavigate()
  const openModal = useModal((s) => s.open)

  if (v.status === 'idle') {
    if (!v.error) return null
    return (
      <div className="flex items-start gap-2 border-b border-black/30 bg-[hsl(225_7%_15%)] px-3 py-2 text-xs text-dnd">
        <span className="flex-1">{v.error}</span>
        <button onClick={clearVoiceError} aria-label="Kapat" className="text-muted-foreground hover:text-header">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const statusText = v.status === 'connecting' ? 'Bağlanıyor…' : 'Ses Bağlandı'
  const g = grade(v.quality)
  const detail = qualityText(v.quality)

  return (
    <div className="border-b border-black/30 bg-[hsl(225_7%_15%)] px-2 pb-2 pt-1.5">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 pl-1">
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-semibold',
              v.status !== 'connected' ? 'text-idle' : g === 'good' ? 'text-online' : g === 'fair' ? 'text-idle' : 'text-dnd'
            )}
          >
            <Signal className="h-4 w-4" /> {statusText}
          </div>
          <button
            onClick={() => navigate(`/channels/${v.serverId}/${v.channelId}`)}
            className="block max-w-full truncate text-xs text-muted-foreground hover:underline"
          >
            {v.channelName} / {v.serverName}
          </button>
          {detail && (
            <p className="truncate text-[11px] text-muted-foreground" aria-label="Bağlantı kalitesi">
              Bağlantı: {detail}
            </p>
          )}
        </div>
        <Tooltip label="Ses Ayarları">
          <button
            onClick={() => openModal({ type: 'voiceSettings' })}
            aria-label="Ses Ayarları"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-hover hover:text-header"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
        <Tooltip label="Bağlantıyı Kes">
          <button
            onClick={() => void leaveVoice()}
            aria-label="Bağlantıyı Kes"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-hover hover:text-dnd"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>
      {v.error && <p className="px-1 pt-1 text-xs text-idle">{v.error}</p>}
    </div>
  )
}
