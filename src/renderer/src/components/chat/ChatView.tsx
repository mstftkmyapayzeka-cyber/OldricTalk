import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { markRead } from '@/lib/actions'
import type { ChatTarget, MemberRole, ProfileLite } from '@/lib/types'
import { useActiveTarget } from '@/stores/active'
import MessageList from './MessageList'
import Composer, { type ComposerHandle } from './Composer'
import TypingIndicator from './TypingIndicator'

type Props = {
  target: ChatTarget
  me: ProfileLite & { username: string }
  placeholder: string
  welcome: React.ReactNode
  canModerate?: boolean
  roles?: Map<string, { role: MemberRole; nickname: string | null }>
  disabledReason?: string | null
}

/** Mesaj listesi + yazma kutusu; dosya sürükle-bırak ve okundu işareti burada. */
export default function ChatView({
  target,
  me,
  placeholder,
  welcome,
  canModerate = false,
  roles,
  disabledReason
}: Props): React.JSX.Element {
  const qc = useQueryClient()
  const composer = useRef<ComposerHandle>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  // Açık hedef: bildirimleri bastırır ve okundu işaretler.
  useEffect(() => {
    useActiveTarget.setState({ targetId: target.id })
    void markRead(qc, me.id, target.id)
    const onFocus = (): void => void markRead(qc, me.id, target.id)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (useActiveTarget.getState().targetId === target.id) {
        useActiveTarget.setState({ targetId: null })
      }
    }
  }, [qc, me.id, target.id])

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files') || disabledReason) return
        dragDepth.current++
        setDragging(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f && !disabledReason) composer.current?.attach(f)
      }}
    >
      <MessageList
        key={target.id}
        target={target}
        me={me.id}
        myUsername={me.username}
        canModerate={canModerate}
        welcome={welcome}
        roles={roles}
      />
      <Composer
        key={`c-${target.id}`}
        ref={composer}
        target={target}
        me={me}
        placeholder={placeholder}
        disabledReason={disabledReason}
      />
      <TypingIndicator targetId={target.id} />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-brand p-8 text-white shadow-2xl">
            <Upload className="h-12 w-12" />
            <p className="text-lg font-bold">Dosyayı yüklemek için bırak</p>
          </div>
        </div>
      )}
    </div>
  )
}
