import { useEffect, useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Ban, Check, Clock, UserRound } from 'lucide-react'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import { watchDm } from '@/lib/realtime'
import type { ChatTarget } from '@/lib/types'
import { useBlocks, useConversations, useFriendships, useMyProfile } from '@/hooks/queries'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Spinner } from '@/components/ui/spinner'
import { TopBar, TopBarSub, TopBarTitle } from '@/components/layout/parts'
import ChatView from '@/components/chat/ChatView'
import UserCard from '@/components/user/UserCard'

export default function DmPage(): React.JSX.Element {
  const { conversationId = '' } = useParams()
  const { data: conversations, isLoading } = useConversations()
  const { data: me } = useMyProfile()
  const { data: blocked = [] } = useBlocks()
  const { data: friendships = [] } = useFriendships()
  const conv = conversations?.find((c) => c.id === conversationId)
  const target = useMemo<ChatTarget>(() => ({ kind: 'dm', id: conversationId }), [conversationId])

  useEffect(() => watchDm(conversationId), [conversationId])

  if (isLoading || !me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }
  if (!conv) return <Navigate to="/channels/@me" replace />

  const other = conv.other
  const status = displayStatus(other)
  const isBlocked = blocked.some((b) => b.id === other.id)
  const rel = friendships.find((f) => f.requester_id === other.id || f.addressee_id === other.id)

  // DM karşılaması: kişi kartı + arkadaşlık durumu rozeti.
  const relation = isBlocked
    ? { Icon: Ban, label: 'Engellendi' }
    : rel?.status === 'accepted'
      ? { Icon: Check, label: 'Arkadaşsınız' }
      : rel?.status === 'pending'
        ? { Icon: Clock, label: 'İstek bekliyor' }
        : null

  return (
    <>
      <TopBar>
        <Avatar src={other.avatar_url} name={other.display_name} seed={other.id} size={24} status={status} />
        <TopBarTitle>{other.display_name}</TopBarTitle>
        <TopBarSub>· {other.custom_status || STATUS_LABEL[status]}</TopBarSub>
        <div className="flex-1" />
        <UserCard userId={other.id} side="bottom">
          <IconButton label="Profili göster">
            <UserRound />
          </IconButton>
        </UserCard>
      </TopBar>
      <ChatView
        target={target}
        me={me}
        placeholder={`@${other.display_name} kişisine mesaj gönder`}
        dropTarget={`@${other.display_name} kişisine`}
        disabledReason={isBlocked ? 'Bu kullanıcıyı engelledin. Mesaj göndermek için engeli kaldır.' : null}
        welcome={
          <div className="mt-auto px-4 pb-4 pt-8 [--ot-ring:hsl(var(--chat))]">
            <Avatar src={other.avatar_url} name={other.display_name} seed={other.id} size={80} status={status} />
            <h2 className="mt-4 text-title-lg text-header">{other.display_name}</h2>
            <p className="mt-2 text-body text-text-muted">@{other.username} ile özel sohbetinin başlangıcı.</p>
            <div className="mt-4 flex items-center gap-2">
              {relation && (
                <span className="inline-flex h-[30px] items-center gap-2 rounded-md bg-selected px-3 text-meta font-semibold text-header">
                  <relation.Icon className="h-3.5 w-3.5" /> {relation.label}
                </span>
              )}
              <UserCard userId={other.id}>
                <Button variant="ghost" size="sm">
                  Profili Göster
                </Button>
              </UserCard>
            </div>
          </div>
        }
      />
    </>
  )
}
