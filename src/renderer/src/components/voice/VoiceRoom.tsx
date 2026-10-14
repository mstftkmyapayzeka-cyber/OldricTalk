import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { joinVoice, leaveVoice, toggleDeafen, toggleMute, useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import type { Channel, Server } from '@/lib/types'
import { useChannelVoiceMembers, type VoiceMember } from '@/stores/voiceRoster'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'

function Tile({ member: m, speaking }: { member: VoiceMember; speaking: boolean }): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-rail ring-2 transition',
        speaking ? 'ring-online' : 'ring-transparent'
      )}
    >
      <Avatar src={m.avatar_url} name={m.name} seed={m.user_id} size={72} />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-sm text-white">
        {m.deafened ? <HeadphoneOff className="h-3.5 w-3.5 text-dnd" /> : m.muted && <MicOff className="h-3.5 w-3.5 text-dnd" />}
        <span className="max-w-[200px] truncate">{m.name}</span>
      </div>
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
  const cols = members.length <= 1 ? 1 : members.length <= 4 ? 2 : members.length <= 9 ? 3 : 4
  const speaking = new Set(v.speaking)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-floating">
      {v.status !== 'connected' ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
          <Spinner /> Bağlanıyor…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div
            className="grid w-full max-w-[1200px] gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {members.map((m) => (
              <Tile key={m.user_id} member={m} speaking={speaking.has(m.user_id) && !m.muted} />
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
        <ControlButton label="Bağlantıyı Kes" danger onClick={() => void leaveVoice()}>
          <PhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>
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
