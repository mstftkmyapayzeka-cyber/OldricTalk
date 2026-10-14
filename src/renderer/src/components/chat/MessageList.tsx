import { Fragment, useEffect, useMemo, useRef } from 'react'
import { isSameDay } from 'date-fns'
import { ServerCrash } from 'lucide-react'
import type { ChatMessage, ChatTarget, MemberRole } from '@/lib/types'
import { useMessages } from '@/hooks/queries'
import { Spinner } from '@/components/ui/spinner'
import MessageItem, { DateDivider } from './MessageItem'

const GROUP_WINDOW_MS = 7 * 60 * 1000

type Props = {
  target: ChatTarget
  me: string
  myUsername?: string
  canModerate: boolean
  welcome: React.ReactNode
  roles?: Map<string, { role: MemberRole; nickname: string | null }>
}

export default function MessageList({
  target,
  me,
  myUsername,
  canModerate,
  welcome,
  roles
}: Props): React.JSX.Element {
  const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(target)
  const topRef = useRef<HTMLDivElement>(null)

  // Yeniden eskiye gelen sayfaları ekran için eskiden yeniye çevir.
  const messages = useMemo<ChatMessage[]>(
    () => (data ? data.pages.flat().slice().reverse() : []),
    [data]
  )

  // Üst kenara yaklaşınca eski mesajları yükle.
  useEffect(() => {
    const el = topRef.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '600px 0px 0px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (status === 'pending') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <ServerCrash className="h-10 w-10" />
        <p>Mesajlar yüklenemedi.</p>
      </div>
    )
  }

  // flex-col-reverse: kaydırma en altta başlar ve yeni mesajlarda altta kalır.
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      <div className="pb-6">
        <div ref={topRef} />
        {hasNextPage ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          welcome
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))
          const continuation =
            !!prev &&
            !newDay &&
            prev.author_id === m.author_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
          const r = roles?.get(m.author_id)
          return (
            <Fragment key={m.id}>
              {newDay && <DateDivider iso={m.created_at} />}
              <MessageItem
                msg={m}
                target={target}
                continuation={continuation}
                me={me}
                myUsername={myUsername}
                canModerate={canModerate}
                authorRole={r?.role}
                authorName={r?.nickname ?? undefined}
                pending={m.pending}
              />
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
