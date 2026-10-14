import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Hash, Users, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatTarget } from '@/lib/types'
import { useChannels, useMyProfile, useServer } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import ChatView from '@/components/chat/ChatView'
import MemberList from '@/components/server/MemberList'
import VoiceRoom from '@/components/voice/VoiceRoom'

const MEMBERS_KEY = 'oldrictalk-show-members'

export default function ChannelPage(): React.JSX.Element {
  const { serverId = '', channelId = '' } = useParams()
  const { data: server } = useServer(serverId)
  const { data: channels, isLoading } = useChannels(serverId)
  const { data: me } = useMyProfile()
  const { members, isModerator, roles } = useMembership(serverId)
  const [showMembers, setShowMembers] = useState(() => localStorage.getItem(MEMBERS_KEY) !== '0')
  const channel = channels?.find((c) => c.id === channelId)
  const target = useMemo<ChatTarget>(
    () => ({ kind: 'channel', id: channelId, serverId }),
    [channelId, serverId]
  )

  if (isLoading || !me || !server) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!channel) return <Navigate to={`/channels/${serverId}`} replace />

  const Icon = channel.type === 'text' ? Hash : Volume2

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/30 px-4 shadow-sm">
        <Icon className="h-6 w-6 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-semibold text-header">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="mx-2 h-6 w-px shrink-0 bg-border" />
            <span className="truncate text-sm text-muted-foreground">{channel.topic}</span>
          </>
        )}
        <div className={cn('ml-auto flex items-center gap-4', channel.type !== 'text' && 'hidden')}>
          <Tooltip label={showMembers ? 'Üye Listesini Gizle' : 'Üye Listesini Göster'}>
            <button
              onClick={() => {
                localStorage.setItem(MEMBERS_KEY, showMembers ? '0' : '1')
                setShowMembers(!showMembers)
              }}
              className={cn('hover:text-header', showMembers ? 'text-header' : 'text-muted-foreground')}
            >
              <Users className="h-6 w-6" />
            </button>
          </Tooltip>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {channel.type === 'text' ? (
          <ChatView
            target={target}
            me={me}
            placeholder={`#${channel.name} kanalına mesaj gönder`}
            canModerate={isModerator}
            roles={roles}
            welcome={
              <div className="m-4 mt-auto pt-16">
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-selected">
                  <Hash className="h-10 w-10 text-header" />
                </div>
                <h2 className="mt-2 text-3xl font-bold text-header">#{channel.name} kanalına hoş geldin!</h2>
                <p className="mt-1 text-muted-foreground">Bu, #{channel.name} kanalının başlangıcı.</p>
              </div>
            }
          />
        ) : (
          <VoiceRoom channel={channel} server={server} />
        )}
        {showMembers && channel.type === 'text' && <MemberList members={members} server={server} />}
      </div>
    </>
  )
}
