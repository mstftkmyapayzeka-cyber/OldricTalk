import { memo, useEffect, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Copy, Download, FileText, Hash, Pencil, Trash2 } from 'lucide-react'
import { deleteMessage, editMessage } from '@/lib/actions'
import { errorMessage } from '@/lib/errors'
import { mentions } from '@/lib/markdown'
import { isImage } from '@/lib/upload'
import { cn } from '@/lib/utils'
import type { ChatMessage, ChatTarget, MemberRole } from '@/lib/types'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm'
import { IconButton } from '@/components/ui/icon-button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { ROLE_COLOR } from '@/components/server/MemberList'
import UserCard from '@/components/user/UserCard'
import Markdown from './Markdown'

export function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return `Dün ${format(d, 'HH:mm')}`
  return format(d, 'd MMMM yyyy HH:mm', { locale: tr })
}

type Props = {
  msg: ChatMessage
  target: ChatTarget
  continuation: boolean
  me: string
  myUsername?: string
  canModerate: boolean
  authorRole?: MemberRole
  authorName?: string
  pending?: boolean
}

function MessageItemInner({
  msg,
  target,
  continuation,
  me,
  myUsername,
  canModerate,
  authorRole,
  authorName,
  pending
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const own = msg.author_id === me
  const canEdit = own && !msg.deleted
  const canDelete = !msg.deleted && (own || (target.kind === 'channel' && canModerate))
  const mentioned = !own && !!myUsername && !msg.deleted && mentions(msg.content, myUsername)
  const name = authorName ?? msg.author?.display_name ?? 'Bilinmeyen kullanıcı'

  useEffect(() => {
    if (editing) {
      const el = editRef.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  function startEdit(): void {
    setDraft(msg.content)
    setEditing(true)
  }

  async function saveEdit(): Promise<void> {
    const content = draft.trim()
    if (!content && !msg.file_url) {
      setEditing(false)
      setConfirmDelete(true)
      return
    }
    if (content === msg.content) {
      setEditing(false)
      return
    }
    try {
      await editMessage(target, msg.id, content)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const header = (
    <div className="flex items-baseline gap-2">
      <UserCard userId={msg.author_id} role={authorRole}>
        <button
          className={cn(
            'truncate text-body font-semibold text-header hover:underline',
            authorRole && ROLE_COLOR[authorRole]
          )}
        >
          {name}
        </button>
      </UserCard>
      <time dateTime={msg.created_at} className="shrink-0 text-meta text-text-muted">
        {formatStamp(msg.created_at)}
      </time>
    </div>
  )

  const body = msg.deleted ? (
    <p className="text-body italic text-text-muted">Bu mesaj silindi.</p>
  ) : editing ? (
    <div className="mt-1 flex flex-col gap-0.5">
      <textarea
        ref={editRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void saveEdit()
          } else if (e.key === 'Escape') {
            setDraft(msg.content)
            setEditing(false)
          }
        }}
        rows={Math.min(10, draft.split('\n').length)}
        maxLength={4000}
        aria-label="Mesajı düzenle"
        className="w-full resize-none rounded-md border border-brand bg-input px-3 py-2 text-body text-text focus:outline-none"
      />
      <p className="text-[11px] leading-4 text-text-muted">
        kaydetmek için <b className="font-semibold text-text">Enter</b>, iptal için{' '}
        <b className="font-semibold text-text">Esc</b>
      </p>
      {error && <p className="text-meta text-dnd">{error}</p>}
    </div>
  ) : (
    <>
      {msg.content && (
        <div
          className={cn(
            'selectable whitespace-pre-wrap text-body text-text [overflow-wrap:anywhere]',
            pending && 'opacity-50'
          )}
        >
          <Markdown content={msg.content} myUsername={myUsername} />
          {msg.edited_at && (
            <Tooltip label={formatStamp(msg.edited_at)}>
              <span className="ml-1 text-[11px] leading-4 text-text-muted">(düzenlendi)</span>
            </Tooltip>
          )}
        </div>
      )}
      {msg.file_url &&
        (isImage(msg.file_type) ? (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block w-fit max-w-[min(400px,100%)] overflow-hidden rounded-lg border border-border"
          >
            <img
              src={msg.file_url}
              alt={msg.file_name ?? ''}
              loading="lazy"
              className="block max-h-[300px] max-w-full object-contain"
            />
          </a>
        ) : (
          <div className="mt-2 flex w-full max-w-[400px] items-center gap-3 rounded-md border border-border bg-input p-3">
            <FileText className="h-7 w-7 shrink-0 text-text-muted" />
            <a
              href={msg.file_url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-label font-semibold text-link hover:underline"
            >
              {msg.file_name ?? 'Dosya'}
            </a>
            <Tooltip label="İndir">
              <a
                href={msg.file_url}
                target="_blank"
                rel="noreferrer"
                aria-label="İndir"
                className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-hover hover:text-header"
              >
                <Download className="h-4 w-4" />
              </a>
            </Tooltip>
          </div>
        ))}
    </>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 px-4 transition-colors duration-fast hover:bg-hover',
              continuation ? 'py-px' : 'py-1.5',
              mentioned && 'border-l-2 border-brand bg-brand-soft pl-[14px] hover:bg-brand-soft'
            )}
          >
            {continuation ? (
              <time
                dateTime={msg.created_at}
                className="select-none text-right font-mono text-[11px] leading-[21px] text-text-muted opacity-0 group-hover:opacity-100"
              >
                {format(new Date(msg.created_at), 'HH:mm')}
              </time>
            ) : (
              <div className="grid place-items-start justify-center pt-0.5">
                <UserCard userId={msg.author_id} role={authorRole}>
                  <button className="rounded-full active:translate-y-px" aria-label={`${name} profili`}>
                    <Avatar src={msg.author?.avatar_url} name={name} seed={msg.author_id} size={40} />
                  </button>
                </UserCard>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              {!continuation && header}
              {body}
            </div>

            {/* Üzerine gelince sağ üstte floating araç çubuğu; aynı eylemler sağ tık menüsünde. */}
            {!editing && !pending && (canEdit || canDelete) && (
              <div className="absolute -top-3.5 right-4 z-[1] hidden items-center gap-0.5 rounded-md border border-border bg-floating p-0.5 shadow-md group-hover:flex">
                {canEdit && (
                  <IconButton size="sm" label="Düzenle" onClick={startEdit}>
                    <Pencil />
                  </IconButton>
                )}
                {canDelete && (
                  <IconButton
                    size="sm"
                    danger
                    label="Sil"
                    sub="Shift ile onaysız sil"
                    onClick={(e) => {
                      if (e.shiftKey) void deleteMessage(target, msg.id)
                      else setConfirmDelete(true)
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-[212px]">
          {msg.content && !msg.deleted && (
            <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(msg.content)}>
              <Copy /> Metni kopyala
            </ContextMenuItem>
          )}
          {canEdit && (
            <ContextMenuItem onSelect={startEdit}>
              <Pencil /> Mesajı düzenle
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(msg.id)}>
            <Hash /> Mesaj kimliğini kopyala
          </ContextMenuItem>
          {canDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem danger onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Mesajı sil
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Mesajı Sil"
        description="Bu mesajı silmek istediğinden emin misin?"
        confirmLabel="Mesajı Sil"
        onConfirm={() => deleteMessage(target, msg.id)}
      >
        <div className="rounded-md border border-border bg-sidebar p-3">
          <div className="text-label font-semibold text-header">{name}</div>
          <div className="line-clamp-4 whitespace-pre-wrap text-body text-text [overflow-wrap:anywhere]">
            {msg.content || msg.file_name}
          </div>
        </div>
      </ConfirmDialog>
    </>
  )
}

const MessageItem = memo(MessageItemInner)
export default MessageItem

/** Gün ayırıcı: "14 Ekim 2026" (overline). */
export function DateDivider({ iso }: { iso: string }): React.JSX.Element {
  return (
    <div role="separator" className="flex items-center gap-3 px-4 pb-2 pt-4">
      <span className="h-px flex-1 bg-border" />
      <span className="text-overline text-text-muted">
        {format(new Date(iso), 'd MMMM yyyy', { locale: tr })}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
