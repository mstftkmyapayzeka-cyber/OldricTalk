import { useEffect, useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AtSign } from 'lucide-react'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import { watchDm } from '@/lib/realtime'
import type { ChatTarget } from '@/lib/types'
import { useBlocks, useConversations, useMyProfile } from '@/hooks/queries'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import ChatView from '@/components/chat/ChatView'

export default function DmPage(): React.JSX.Element {
  const { conversationId = '' } = useParams()
  const { data: conversations, isLoading } = useConversations()
  const { data: me } = useMyProfile()
  const { data: blocked = [] } = useBlocks()
  const conv = conversations?.find((c) => c.id === conversationId)
  const target = useMemo<ChatTarget>(() => ({ kind: 'dm', id: conversationId }), [conversationId])

  useEffect(() => watchDm(conversationId), [conversationId])

  if (isLoading || !me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!conv) return <Navigate to="/channels/@me" replace />

  const other = conv.other
  const status = displayStatus(other)
  const isBlocked = blocked.some((b) => b.id === other.id)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/30 px-4 shadow-sm">
        <AtSign className="h-6 w-6 text-muted-foreground" />
        <span className="font-semibold text-header">{other.display_name}</span>
        <span className="text-xs text-muted-foreground">• {other.custom_status || STATUS_LABEL[status]}</span>
      </header>
      <ChatView
        target={target}
        me={me}
        placeholder={`@${other.display_name} kişisine mesaj gönder`}
        disabledReason={isBlocked ? 'Bu kullanıcıyı engelledin. Mesaj göndermek için engeli kaldır.' : null}
        welcome={
          <div className="m-4 mt-auto pt-16">
            <Avatar src={other.avatar_url} name={other.display_name} seed={other.id} size={80} />
            <h2 className="mt-3 text-3xl font-bold text-header">{other.display_name}</h2>
            <p className="text-xl text-header">@{other.username}</p>
            <p className="mt-2 text-muted-foreground">
              Bu, <b className="text-foreground">@{other.username}</b> ile olan direkt mesaj geçmişinin
              başlangıcı.
            </p>
          </div>
        }
      />
    </>
  )
}
