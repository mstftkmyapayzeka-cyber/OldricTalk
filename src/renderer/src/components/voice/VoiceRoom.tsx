import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  PhoneOff,
  SlidersHorizontal,
  Volume2
} from 'lucide-react'
import { joinVoice, leaveVoice, toggleDeafen, toggleMute, useVoice } from '@/lib/voice'
import { cn, colorFor } from '@/lib/utils'
import type { Channel, Server } from '@/lib/types'
import { useModal } from '@/stores/modal'
import { useChannelVoiceMembers, type VoiceMember } from '@/stores/voiceRoster'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import UserVolumeMenu, { LocalMuteIcon } from './UserVolumeMenu'

// Kişi sayısına göre ızgara: 1 tek karo (≤620px) · 2–4 iki sütun · 5–9 üç sütun · fazlası dört sütun.
function layout(n: number): { cols: number; avatar: number } {
  if (n <= 1) return { cols: 1, avatar: 96 }
  if (n <= 4) return { cols: 2, avatar: 96 }
  if (n <= 9) return { cols: 3, avatar: 48 }
  return { cols: 4, avatar: 32 }
}

/** 16:9 karo; zemin kişinin rengiyle sidebar karışımı. Kamera yok: karo avatarı gösterir. */
function Tile({
  member: m,
  speaking,
  avatar
}: {
  member: VoiceMember
  speaking: boolean
  avatar: number
}): React.JSX.Element {
  return (
    <UserVolumeMenu userId={m.user_id} name={m.name}>
      <div
        className={cn(
          'relative grid aspect-video min-h-0 w-full place-items-center overflow-hidden rounded-xl border-2 transition-[border-color,box-shadow] duration-slow',
          speaking
            ? 'border-online shadow-[0_0_0_4px_color-mix(in_oklab,hsl(var(--online))_26%,transparent)]'
            : 'border-transparent'
        )}
        style={{ background: `color-mix(in oklab, ${colorFor(m.user_id)} 26%, hsl(var(--sidebar)))` }}
      >
        <Avatar src={m.avatar_url} name={m.name} seed={m.user_id} size={avatar} />
        {/* Karo rengi değişken olduğundan ad etiketi sabit siyah %55 zemin + beyaz metindir. */}
        <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-pill bg-black/55 px-2 py-[3px] text-meta font-semibold text-white">
          <span className="truncate">{m.name}</span>
          <LocalMuteIcon userId={m.user_id} />
          {m.deafened ? (
            <HeadphoneOff className="h-3.5 w-3.5 shrink-0 text-dnd" aria-label="Sağırlaştırılmış" />
          ) : (
            m.muted && <MicOff className="h-3.5 w-3.5 shrink-0 text-dnd" aria-label="Sessizde" />
          )}
        </div>
      </div>
    </UserVolumeMenu>
  )
}

/** 48px yuvarlak kontrol; kapalı durum ve "Bağlantıyı Kes" dnd zemin + on-dnd. */
function ControlButton({
  label,
  off,
  leave,
  onClick,
  children
}: {
  label: string
  off?: boolean
  leave?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        aria-pressed={leave ? undefined : !!off}
        onClick={onClick}
        className={cn(
          'grid h-12 w-12 place-items-center rounded-full transition-[background-color,color,filter] duration-fast [&>svg]:h-5 [&>svg]:w-5',
          off || leave ? 'bg-dnd text-on-dnd hover:brightness-[1.08]' : 'bg-selected text-header hover:bg-border'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function ConnectedRoom({ members }: { members: VoiceMember[] }): React.JSX.Element {
  const v = useVoice()
  const openModal = useModal((s) => s.open)
  const { cols, avatar } = layout(members.length)
  const speaking = new Set(v.speaking)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-chat">
      {v.status !== 'connected' ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-label font-normal text-text-muted">
          <Spinner size="md" /> Bağlanıyor…
        </div>
      ) : (
        <div className="thin-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div
            className="grid w-full max-w-[980px] content-center gap-4"
            style={{
              gridTemplateColumns: cols === 1 ? 'minmax(0, 620px)' : `repeat(${cols}, minmax(0, 1fr))`,
              justifyContent: 'center'
            }}
          >
            {members.map((m) => (
              <Tile
                key={m.user_id}
                member={m}
                avatar={avatar}
                speaking={speaking.has(m.user_id) && !m.muted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sıra sabittir: Mikrofon, Kulaklık, Ses Ayarları, Bağlantıyı Kes. */}
      <div className="flex shrink-0 items-center justify-center gap-3 pb-6 pt-4">
        <ControlButton label={v.muted ? 'Mikrofonu Aç' : 'Sessize Al'} off={v.muted} onClick={() => void toggleMute()}>
          {v.muted ? <MicOff /> : <Mic />}
        </ControlButton>
        <ControlButton
          label={v.deafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}
          off={v.deafened}
          onClick={() => void toggleDeafen()}
        >
          {v.deafened ? <HeadphoneOff /> : <Headphones />}
        </ControlButton>
        <ControlButton label="Ses Ayarları" onClick={() => openModal({ type: 'voiceSettings' })}>
          <SlidersHorizontal />
        </ControlButton>
        <ControlButton label="Bağlantıyı Kes" leave onClick={() => void leaveVoice()}>
          <PhoneOff />
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

  const names = members.map((m) => m.name.split(' ')[0])
  const who =
    members.length === 1
      ? `${names[0]} kanalda.`
      : members.length === 2
        ? `${names[0]} ve ${names[1]} kanalda.`
        : `${names[0]}, ${names[1]} ve ${members.length - 2} kişi daha kanalda.`

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-chat p-6 text-center [--ot-ring:hsl(var(--chat))]">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-brand-soft text-brand">
        <Volume2 className="h-10 w-10" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-title-lg text-header">{channel.name}</h2>
        {members.length > 0 ? (
          <>
            <div className="mt-2 flex">
              {members.slice(0, 8).map((m, i) => (
                <Avatar
                  key={m.user_id}
                  src={m.avatar_url}
                  name={m.name}
                  seed={m.user_id}
                  size={48}
                  className={cn('shadow-[0_0_0_3px_hsl(var(--chat))]', i > 0 && '-ml-2.5')}
                />
              ))}
            </div>
            <p className="mt-2 max-w-[360px] text-label font-normal text-text-muted">{who}</p>
          </>
        ) : (
          <p className="text-label font-normal text-text-muted">Şu an kanalda kimse yok.</p>
        )}
      </div>
      {v.error && <ErrorBox className="max-w-[420px] text-left">{v.error}</ErrorBox>}
      <Button size="lg" variant="success" onClick={() => void joinVoice(channel, server.name)}>
        <Headphones className="h-[18px] w-[18px]" /> Sese Katıl
      </Button>
    </div>
  )
}
