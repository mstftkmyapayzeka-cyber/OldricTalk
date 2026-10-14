import { useMemo, useState } from 'react'
import {
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  VideoTrack,
  type TrackReferenceOrPlaceholder
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import {
  Headphones,
  HeadphoneOff,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
  Volume2
} from 'lucide-react'
import {
  joinVoice,
  leaveVoice,
  stopScreenShare,
  toggleCamera,
  toggleDeafen,
  toggleMute,
  useVoice
} from '@/lib/voice'
import { cn } from '@/lib/utils'
import type { Channel, Server } from '@/lib/types'
import { useChannelVoiceMembers } from '@/stores/voiceRoster'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import ScreenPicker from './ScreenPicker'

function avatarOf(metadata: string | undefined): string | null {
  try {
    return (JSON.parse(metadata ?? '{}').avatar_url as string | null) ?? null
  } catch {
    return null
  }
}

const keyOf = (t: TrackReferenceOrPlaceholder): string => `${t.participant.identity}:${t.source}`

function Tile({
  trackRef,
  big,
  onClick
}: {
  trackRef: TrackReferenceOrPlaceholder
  big?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const p = trackRef.participant
  const speaking = useIsSpeaking(p)
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone })
  const isScreen = trackRef.source === Track.Source.ScreenShare
  const hasVideo =
    isTrackReference(trackRef) && !!trackRef.publication.track && !trackRef.publication.isMuted
  const name = p.name || p.identity

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-rail ring-2 transition',
        speaking && !isScreen ? 'ring-online' : 'ring-transparent',
        big ? 'h-full w-full' : 'aspect-video w-full'
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn('h-full w-full', isScreen ? 'object-contain' : 'object-cover')}
        />
      ) : (
        <Avatar src={avatarOf(p.metadata)} name={name} seed={p.identity} size={big ? 112 : 72} />
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-sm text-white">
        {micMuted && !isScreen && <MicOff className="h-3.5 w-3.5 text-dnd" />}
        {isScreen && <MonitorUp className="h-3.5 w-3.5" />}
        <span className="max-w-[200px] truncate">{isScreen ? `${name} — ekran` : name}</span>
      </div>
      {onClick && (
        <span className="absolute right-2 top-2 hidden rounded bg-black/60 p-1 text-white group-hover:block">
          {big ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </span>
      )}
    </div>
  )
}

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children
}: {
  label: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full transition',
          danger
            ? 'bg-dnd text-white hover:bg-[hsl(358_70%_52%)]'
            : active
              ? 'bg-header text-rail'
              : 'bg-selected text-header hover:bg-hover'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function ConnectedRoom(): React.JSX.Element {
  const v = useVoice()
  const [picking, setPicking] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false }
    ],
    { onlySubscribed: false }
  )

  // Ekran paylaşımı varsa ve kullanıcı başka şey seçmediyse o öne çıkar.
  const focused = useMemo(() => {
    if (focus) return tracks.find((t) => keyOf(t) === focus) ?? null
    return tracks.find((t) => t.source === Track.Source.ScreenShare) ?? null
  }, [tracks, focus])
  const others = focused ? tracks.filter((t) => keyOf(t) !== keyOf(focused)) : tracks
  const cols = others.length <= 1 ? 1 : others.length <= 4 ? 2 : others.length <= 9 ? 3 : 4

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-floating">
      {v.status !== 'connected' ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
          <Spinner /> {v.status === 'connecting' ? 'Bağlanıyor…' : 'Yeniden bağlanıyor…'}
        </div>
      ) : focused ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="min-h-0 flex-1">
            <Tile trackRef={focused} big onClick={() => setFocus(focus ? null : keyOf(focused))} />
          </div>
          {others.length > 0 && (
            <div className="flex h-[120px] shrink-0 justify-center gap-3">
              {others.map((t) => (
                <div key={keyOf(t)} className="w-[213px]">
                  <Tile trackRef={t} onClick={() => setFocus(keyOf(t))} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div
            className="grid w-full max-w-[1200px] gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {others.map((t) => (
              <Tile key={keyOf(t)} trackRef={t} onClick={() => setFocus(keyOf(t))} />
            ))}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center gap-3 pb-6 pt-2">
        <ControlButton label={v.muted ? 'Mikrofonu Aç' : 'Sessize Al'} active={v.muted} onClick={() => void toggleMute()}>
          {v.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          label={v.deafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}
          active={v.deafened}
          onClick={() => void toggleDeafen()}
        >
          {v.deafened ? <HeadphoneOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </ControlButton>
        <ControlButton label={v.camera ? 'Kamerayı Kapat' : 'Kamerayı Aç'} active={v.camera} onClick={() => void toggleCamera()}>
          {v.camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          label={v.screen ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
          active={v.screen}
          onClick={() => (v.screen ? void stopScreenShare() : setPicking(true))}
        >
          <MonitorUp className="h-5 w-5" />
        </ControlButton>
        <ControlButton label="Bağlantıyı Kes" danger onClick={() => void leaveVoice()}>
          <PhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>
      {picking && <ScreenPicker onClose={() => setPicking(false)} />}
    </div>
  )
}

export default function VoiceRoom({
  channel,
  server
}: {
  channel: Channel
  server: Server
}): React.JSX.Element {
  const v = useVoice()
  const members = useChannelVoiceMembers(server.id, channel.id)
  const here = v.channelId === channel.id && v.status !== 'idle'

  if (here) return <ConnectedRoom />

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-floating text-center">
      <Volume2 className="h-14 w-14 text-muted-foreground" />
      <h2 className="text-2xl font-bold text-header">{channel.name}</h2>
      {members.length > 0 ? (
        <>
          <div className="flex -space-x-2">
            {members.slice(0, 8).map((m) => (
              <Avatar
                key={m.user_id}
                src={m.avatar_url}
                name={m.name}
                seed={m.user_id}
                size={40}
                className="rounded-full ring-4 ring-floating"
              />
            ))}
          </div>
          <p className="text-muted-foreground">
            {members.map((m) => m.name).slice(0, 3).join(', ')}
            {members.length > 3 && ` ve ${members.length - 3} kişi daha`} kanalda.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">Şu an kanalda kimse yok.</p>
      )}
      {v.error && <p className="text-sm text-dnd">{v.error}</p>}
      <Button size="lg" variant="success" onClick={() => void joinVoice(channel, server.name)}>
        Sese Katıl
      </Button>
    </div>
  )
}
