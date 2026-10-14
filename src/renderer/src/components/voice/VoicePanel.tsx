import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonitorUp, PhoneOff, Signal, Video, VideoOff, X } from 'lucide-react'
import { clearVoiceError, leaveVoice, stopScreenShare, toggleCamera, useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import ScreenPicker from './ScreenPicker'

/** Kenar çubuğunun altında "Ses Bağlandı" paneli (Discord'daki gibi). */
export default function VoicePanel(): React.JSX.Element | null {
  const v = useVoice()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)

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

  return (
    <div className="border-b border-black/30 bg-[hsl(225_7%_15%)] px-2 pb-2 pt-1.5">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 pl-1">
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-semibold',
              v.status === 'connected' ? 'text-online' : 'text-idle'
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
        </div>
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
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => void toggleCamera()}
          disabled={v.status !== 'connected'}
          aria-label={v.camera ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-md text-sm disabled:opacity-50',
            v.camera ? 'bg-online text-white' : 'bg-sidebar text-foreground hover:bg-hover'
          )}
        >
          {v.camera ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />} Kamera
        </button>
        <button
          onClick={() => (v.screen ? void stopScreenShare() : setPicking(true))}
          disabled={v.status !== 'connected'}
          aria-label={v.screen ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-md text-sm disabled:opacity-50',
            v.screen ? 'bg-online text-white' : 'bg-sidebar text-foreground hover:bg-hover'
          )}
        >
          <MonitorUp className="h-4 w-4" /> {v.screen ? 'Durdur' : 'Ekran'}
        </button>
      </div>
      {picking && <ScreenPicker onClose={() => setPicking(false)} />}
    </div>
  )
}
