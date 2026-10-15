import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Hash, PanelRightClose, PanelRightOpen, Settings, UserPlus, Volume2 } from 'lucide-react'
import type { ChatTarget } from '@/lib/types'
import { useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { useChannels, useMyProfile, useServer } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useModal } from '@/stores/modal'
import { GRADE, grade } from '@/components/voice/VoicePanel'
import { Spinner } from '@/components/ui/spinner'
import { IconButton } from '@/components/ui/icon-button'
import { TopBar, TopBarSep, TopBarSub, TopBarTitle, useMinWidth } from '@/components/layout/parts'
import ChatView from '@/components/chat/ChatView'
import MemberList from '@/components/server/MemberList'
import VoiceRoom from '@/components/voice/VoiceRoom'

const MEMBERS_KEY = 'oldrictalk-show-members'

/** Kanal başındaki karşılama bloğu; yalnızca kanalın ilk mesajından önce görünür. */
export function ChannelWelcome({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="mt-auto px-4 pb-4 pt-8">
      <div className="mb-4 grid h-[68px] w-[68px] place-items-center rounded-full bg-selected text-header">
        <Hash className="h-9 w-9" />
      </div>
      <h2 className="text-title-lg text-header">#{name} kanalına hoş geldin!</h2>
      <p className="mt-2 text-body text-text-muted">Bu, #{name} kanalının başlangıcı. İlk mesajı sen yaz.</p>
    </div>
  )
}

/** Ses kanalı üst çubuğu: bağlıyken kalite (ikon + renk + söz), değilken kanal türü. */
function VoiceTopBarStatus({ channelId, serverName }: { channelId: string; serverName: string }): React.JSX.Element {
  const v = useVoice()
  if (v.channelId !== channelId || v.status !== 'connected' || v.quality?.rtt == null) {
    return <TopBarSub>Ses kanalı · {serverName}</TopBarSub>
  }
  const g = GRADE[grade(v.quality)]
  return (
    <span className="flex min-w-0 items-center gap-[5px]">
      <g.Icon className={cn('h-4 w-4 shrink-0', g.color)} />
      <TopBarSub>
        {g.label} · {v.quality.rtt} ms
      </TopBarSub>
    </span>
  )
}

export default function ChannelPage(): React.JSX.Element {
  const { serverId = '', channelId = '' } = useParams()
  const { data: server } = useServer(serverId)
  const { data: channels, isLoading } = useChannels(serverId)
  const { data: me } = useMyProfile()
  const { members, isModerator, roles } = useMembership(serverId)
  const openModal = useModal((s) => s.open)
  // Geniş pencerede kullanıcının tercihi saklanır; < 1100px'te liste kendiliğinden
  // gizlenir ve yalnızca bu oturum için elle açılabilir.
  const wide = useMinWidth(1100)
  const [showMembers, setShowMembers] = useState(() => localStorage.getItem(MEMBERS_KEY) !== '0')
  const [narrowOpen, setNarrowOpen] = useState(false)
  const membersOpen = wide ? showMembers : narrowOpen
  const channel = channels?.find((c) => c.id === channelId)
  const target = useMemo<ChatTarget>(
    () => ({ kind: 'channel', id: channelId, serverId }),
    [channelId, serverId]
  )

  if (isLoading || !me || !server) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }
  if (!channel) return <Navigate to={`/channels/${serverId}`} replace />

  function toggleMembers(): void {
    if (!wide) return setNarrowOpen(!narrowOpen)
    localStorage.setItem(MEMBERS_KEY, showMembers ? '0' : '1')
    setShowMembers(!showMembers)
  }

  return (
    <>
      <TopBar>
        <TopBarTitle icon={channel.type === 'text' ? <Hash /> : <Volume2 />}>{channel.name}</TopBarTitle>
        {channel.topic && (
          <>
            <TopBarSep />
            <TopBarSub title={channel.topic}>{channel.topic}</TopBarSub>
          </>
        )}
        {channel.type === 'voice' && (
          <>
            <TopBarSep />
            <VoiceTopBarStatus channelId={channel.id} serverName={server.name} />
          </>
        )}
        <div className="flex-1" />
        {channel.type === 'voice' && (
          <IconButton label="İnsanları Davet Et" onClick={() => openModal({ type: 'invite', server })}>
            <UserPlus />
          </IconButton>
        )}
        {channel.type === 'voice' && isModerator && (
          <IconButton label="Kanalı Düzenle" onClick={() => openModal({ type: 'editChannel', channel })}>
            <Settings />
          </IconButton>
        )}
        {channel.type === 'text' && (
          <IconButton
            label={membersOpen ? 'Üye listesini gizle' : 'Üye listesini göster'}
            active={membersOpen}
            onClick={toggleMembers}
          >
            {membersOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </IconButton>
        )}
      </TopBar>
      <div className="flex min-h-0 flex-1">
        {channel.type === 'text' ? (
          <ChatView
            target={target}
            me={me}
            placeholder={`#${channel.name} kanalına mesaj gönder`}
            dropTarget={`#${channel.name} kanalına`}
            canModerate={isModerator}
            roles={roles}
            welcome={<ChannelWelcome name={channel.name} />}
          />
        ) : (
          <VoiceRoom channel={channel} server={server} />
        )}
        {membersOpen && channel.type === 'text' && <MemberList members={members} server={server} />}
      </div>
    </>
  )
}
