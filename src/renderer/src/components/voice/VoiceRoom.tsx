import { useEffect, useMemo, useRef, useState } from 'react'
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
  useVideoStreams,
  useVoice
} from '@/lib/voice'
import { cn } from '@/lib/utils'
import type { Channel, Server } from '@/lib/types'
import { useChannelVoiceMembers, type VoiceMember } from '@/stores/voiceRoster'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import ScreenPicker from './ScreenPicker'

function VideoView({
  stream,
  mirror,
  contain
}: {
  stream: MediaStream
  mirror?: boolean
  contain?: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover', mirror && '-scale-x-100')}
    />
  )
}

type TileData = { key: string; member: VoiceMember; kind: 'camera' | 'screen'; stream?: MediaStream }

function Tile({
  tile,
  isMe,
  speaking,
  big,
  onClick
}: {
  tile: TileData
  isMe: boolean
  speaking: boolean
  big?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const { member: m, kind, stream } = tile
  const isScreen = kind === 'screen'
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-rail ring-2 transition',
        speaking && !isScreen ? 'ring-online' : 'ring-transparent',
        big ? 'h-full w-full' : 'aspect-video w-full'
      )}
    >
      {stream ? (
        <VideoView stream={stream} mirror={isMe && !isScreen} contain={isScreen} />
      ) : isScreen ? (
        <Spinner />
      ) : (
        <Avatar src={m.avatar_url} name={m.name} seed={m.user_id} size={big ? 112 : 72} />
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-sm text-white">
        {!isScreen && (m.deafened ? <HeadphoneOff className="h-3.5 w-3.5 text-dnd" /> : m.muted && <MicOff className="h-3.5 w-3.5 text-dnd" />)}
        {isScreen && <MonitorUp className="h-3.5 w-3.5" />}
        <span className="max-w-[200px] truncate">{isScreen ? `${m.name} — ekran` : m.name}</span>
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

function ConnectedRoom({ members }: { members: VoiceMember[] }): React.JSX.Element {
  const v = useVoice()
  const me = useUserId()
  const streams = useVideoStreams()
  const [picking, setPicking] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)

  // Her kişi için bir karo; ekran paylaşan için ayrıca ekran karosu.
  const tiles = useMemo<TileData[]>(() => {
    const list: TileData[] = []
    for (const m of members) {
      list.push({ key: `${m.user_id}:camera`, member: m, kind: 'camera', stream: streams[m.user_id]?.camera })
      if (m.screen) {
        list.push({ key: `${m.user_id}:screen`, member: m, kind: 'screen', stream: streams[m.user_id]?.screen })
      }
    }
    return list
  }, [members, streams])

  // Ekran paylaşımı varsa ve kullanıcı başka şey seçmediyse o öne çıkar.
  const focused = useMemo(() => {
    if (focus) return tiles.find((t) => t.key === focus) ?? null
    return tiles.find((t) => t.kind === 'screen') ?? null
  }, [tiles, focus])
  const others = focused ? tiles.filter((t) => t.key !== focused.key) : tiles
  const cols = others.length <= 1 ? 1 : others.length <= 4 ? 2 : others.length <= 9 ? 3 : 4
  const speaking = new Set(v.speaking)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-floating">
      {v.status !== 'connected' ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
          <Spinner /> Bağlanıyor…
        </div>
      ) : focused ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="min-h-0 flex-1">
            <Tile
              tile={focused}
              isMe={focused.member.user_id === me}
              speaking={speaking.has(focused.member.user_id)}
              big
              onClick={() => setFocus(focus ? null : focused.key)}
            />
          </div>
          {others.length > 0 && (
            <div className="flex h-[120px] shrink-0 justify-center gap-3">
              {others.map((t) => (
                <div key={t.key} className="w-[213px]">
                  <Tile
                    tile={t}
                    isMe={t.member.user_id === me}
                    speaking={speaking.has(t.member.user_id)}
                    onClick={() => setFocus(t.key)}
                  />
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
              <Tile
                key={t.key}
                tile={t}
                isMe={t.member.user_id === me}
                speaking={speaking.has(t.member.user_id)}
                onClick={() => setFocus(t.key)}
              />
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

  if (here) return <ConnectedRoom members={members} />

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
