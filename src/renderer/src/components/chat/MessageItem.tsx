import { memo, useEffect, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Copy, Download, FileText, Pencil, Trash2 } from 'lucide-react'
import { deleteMessage, editMessage } from '@/lib/actions'
import { errorMessage } from '@/lib/errors'
import { mentions } from '@/lib/markdown'
import { isImage } from '@/lib/upload'
import { cn } from '@/lib/utils'
import type { ChatMessage, ChatTarget, MemberRole } from '@/lib/types'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import UserCard from '@/components/user/UserCard'
import Markdown from './Markdown'

export function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return `Bugün ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Dün ${format(d, 'HH:mm')}`
  return format(d, 'd.MM.yyyy HH:mm')
}

const ROLE_COLOR: Partial<Record<MemberRole, string>> = {
  admin: 'text-[hsl(358_85%_70%)]',
  moderator: 'text-[hsl(200_90%_65%)]'
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
        <button className={cn('font-medium text-header hover:underline', authorRole && ROLE_COLOR[authorRole])}>
          {name}
        </button>
      </UserCard>
      <span className="text-xs text-muted-foreground">{formatStamp(msg.created_at)}</span>
    </div>
  )

  const body = msg.deleted ? (
    <p className="text-sm italic text-muted-foreground">Bu mesaj silindi.</p>
  ) : editing ? (
    <div className="my-1">
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
        className="w-full resize-none rounded-lg bg-input px-4 py-2.5 text-foreground focus:outline-none"
      />
      <p className="text-xs text-muted-foreground">
        iptal için <b className="text-[hsl(200_100%_65%)]">esc</b> • kaydetmek için{' '}
        <b className="text-[hsl(200_100%_65%)]">enter</b>
      </p>
      {error && <p className="text-xs text-dnd">{error}</p>}
    </div>
  ) : (
    <>
      {msg.content && (
        <div className={cn('selectable whitespace-pre-wrap break-words leading-[1.375rem]', pending && 'opacity-50')}>
          <Markdown content={msg.content} myUsername={myUsername} />
          {msg.edited_at && (
            <Tooltip label={formatStamp(msg.edited_at)}>
              <span className="ml-1 text-[10px] text-muted-foreground">(düzenlendi)</span>
            </Tooltip>
          )}
        </div>
      )}
      {msg.file_url &&
        (isImage(msg.file_type) ? (
          <a href={msg.file_url} target="_blank" rel="noreferrer" className="mt-1 block w-fit">
            <img
              src={msg.file_url}
              alt={msg.file_name ?? ''}
              loading="lazy"
              className="max-h-[300px] max-w-[min(400px,100%)] rounded-lg object-contain"
            />
          </a>
        ) : (
          <div className="mt-1 flex w-fit max-w-[420px] items-center gap-3 rounded-lg border border-black/30 bg-sidebar p-3">
            <FileText className="h-8 w-8 shrink-0 text-brand" />
            <a
              href={msg.file_url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[hsl(200_100%_65%)] hover:underline"
            >
              {msg.file_name ?? 'Dosya'}
            </a>
            <a href={msg.file_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-header">
              <Download className="h-5 w-5" />
            </a>
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
              'group relative pr-12 hover:bg-[hsl(228_6%_19%)]',
              continuation ? 'py-0.5' : 'mt-[17px] py-0.5',
              mentioned && 'border-l-2 border-idle bg-idle/10 hover:bg-idle/15'
            )}
          >
            {continuation ? (
              <div className="flex">
                <span className="invisible w-[72px] shrink-0 pt-1 text-right pr-3 text-[11px] text-muted-foreground group-hover:visible">
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
                <div className="min-w-0 flex-1">{body}</div>
              </div>
            ) : (
              <div className="flex">
                <div className="w-[72px] shrink-0 pl-4 pt-0.5">
                  <UserCard userId={msg.author_id} role={authorRole}>
                    <button className="rounded-full active:translate-y-px">
                      <Avatar
                        src={msg.author?.avatar_url}
                        name={name}
                        seed={msg.author_id}
                        size={40}
                      />
                    </button>
                  </UserCard>
                </div>
                <div className="min-w-0 flex-1">
                  {header}
                  {body}
                </div>
              </div>
            )}

            {!editing && !pending && (canEdit || canDelete) && (
              <div className="absolute -top-4 right-4 hidden overflow-hidden rounded-md border border-black/30 bg-chat shadow group-hover:flex">
                {canEdit && (
                  <Tooltip label="Düzenle">
                    <button
                      aria-label="Düzenle"
                      onClick={() => {
                        setDraft(msg.content)
                        setEditing(true)
                      }}
                      className="p-1.5 text-muted-foreground hover:bg-hover hover:text-header"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip label="Sil (Shift ile onaysız)">
                    <button
                      aria-label="Sil"
                      onClick={(e) => {
                        if (e.shiftKey) void deleteMessage(target, msg.id)
                        else setConfirmDelete(true)
                      }}
                      className="p-1.5 text-dnd hover:bg-hover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {msg.content && !msg.deleted && (
            <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(msg.content)}>
              <Copy className="h-4 w-4" /> Metni kopyala
            </ContextMenuItem>
          )}
          {canEdit && (
            <ContextMenuItem
              onSelect={() => {
                setDraft(msg.content)
                setEditing(true)
              }}
            >
              <Pencil className="h-4 w-4" /> Mesajı düzenle
            </ContextMenuItem>
          )}
          {canDelete && (
            <ContextMenuItem danger onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Mesajı sil
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(msg.id)}>
            Mesaj kimliğini kopyala
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Mesajı Sil"
        description="Bu mesajı silmek istediğinden emin misin?"
        confirmLabel="Sil"
        onConfirm={() => deleteMessage(target, msg.id)}
      >
        <div className="mt-3 rounded-md bg-sidebar p-3 text-sm shadow-inner">
          <div className="font-medium text-header">{name}</div>
          <div className="line-clamp-4 whitespace-pre-wrap break-words">
            {msg.content || msg.file_name}
          </div>
        </div>
      </ConfirmDialog>
    </>
  )
}

const MessageItem = memo(MessageItemInner)
export default MessageItem

export function DateDivider({ iso }: { iso: string }): React.JSX.Element {
  return (
    <div className="relative mx-4 mt-6 mb-2 flex items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="relative bg-chat px-2 text-xs font-semibold text-muted-foreground">
        {format(new Date(iso), 'd MMMM yyyy', { locale: tr })}
      </span>
    </div>
  )
}
