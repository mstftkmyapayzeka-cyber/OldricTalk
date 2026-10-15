import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { markRead } from '@/lib/actions'
import { LIMITS } from '@/lib/config'
import { formatBytes } from '@/lib/utils'
import type { ChatTarget, MemberRole, ProfileLite } from '@/lib/types'
import { useActiveTarget } from '@/stores/active'
import MessageList from './MessageList'
import Composer, { type ComposerHandle } from './Composer'
import TypingIndicator from './TypingIndicator'

type Props = {
  target: ChatTarget
  me: ProfileLite & { username: string }
  placeholder: string
  /** Bırakma katmanında hedef: "#genel kanalına", "@Ayşe kişisine". */
  dropTarget: string
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
  dropTarget,
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
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
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
      <div className="px-4 pb-4">
        <TypingIndicator targetId={target.id} />
        <Composer
          key={`c-${target.id}`}
          ref={composer}
          target={target}
          me={me}
          placeholder={placeholder}
          disabledReason={disabledReason}
        />
      </div>

      {/* Bırakma katmanı: siyah %55 örtü, brand kesikli çerçeve, brand-soft zemin. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/55 animate-fade-in">
          <div className="grid place-items-center gap-3 rounded-lg border-2 border-dashed border-brand bg-brand-soft px-10 py-8 text-center">
            <Upload className="h-9 w-9 text-brand" />
            <p className="text-title-md text-header">Dosyayı yüklemek için bırak</p>
            <p className="text-meta text-text-muted">
              {dropTarget} gönderilecek · en fazla {formatBytes(LIMITS.attachmentBytes)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
