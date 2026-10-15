import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Crown, MessageCircle, MoreVertical, Shield, UserPlus, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import { cn, colorFor } from '@/lib/utils'
import type { MemberRole, Profile } from '@/lib/types'
import { qk, useFriendships, useProfile } from '@/hooks/queries'
import { useOpenDm } from '@/hooks/useOpenDm'
import { useUserId } from '@/stores/auth'
import { Avatar, StatusDot } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

// Rol etiketi: renk + ikon + sözcük.
const ROLE_TAG: Record<MemberRole, { label: string; Icon: typeof Crown; className: string }> = {
  admin: { label: 'Yönetici', Icon: Crown, className: 'bg-dnd-soft text-role-admin' },
  moderator: { label: 'Moderatör', Icon: Shield, className: 'bg-selected text-role-mod' },
  guest: { label: 'Üye', Icon: UserRound, className: 'bg-selected text-text' }
}

function Card({ userId, role }: { userId: string; role?: MemberRole }): React.JSX.Element {
  const me = useUserId()
  const qc = useQueryClient()
  const { data: profile } = useProfile(userId)
  const { data: friendships = [] } = useFriendships()
  const openDm = useOpenDm()
  const [note, setNote] = useState<string | null>(null)

  if (!profile) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }
  const p: Profile = profile
  const rel = friendships.find((f) => f.requester_id === p.id || f.addressee_id === p.id)
  const status = displayStatus(p)
  const tag = role ? ROLE_TAG[role] : null

  async function call(fn: 'send_friend_request' | 'block_user', ok: string): Promise<void> {
    const { error } =
      fn === 'send_friend_request'
        ? await supabase.rpc(fn, { p_username: p.username })
        : await supabase.rpc(fn, { p_other: p.id })
    setNote(error ? errorMessage(error) : ok)
    void qc.invalidateQueries({ queryKey: qk.friendships })
    void qc.invalidateQueries({ queryKey: qk.blocks })
  }

  return (
    <>
      <div className="h-16" style={{ background: colorFor(p.id) }} />
      <div className="px-4 pb-4">
        <div className="-mt-10 w-fit rounded-full shadow-[0_0_0_6px_hsl(var(--floating))]">
          <Avatar src={p.avatar_url} name={p.display_name} seed={p.id} size={80} status={status} />
        </div>
        <div className="mt-3 flex flex-col gap-px">
          <span className="selectable truncate text-[18px] font-bold leading-6 text-header">{p.display_name}</span>
          <span className="selectable text-label font-normal text-text-muted">@{p.username}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tag && (
            <span
              className={cn(
                'inline-flex h-5 items-center gap-1 rounded-xs px-2 text-[11px] font-bold leading-[14px]',
                tag.className
              )}
            >
              <tag.Icon className="h-3 w-3" /> {tag.label}
            </span>
          )}
          <span className="flex items-center gap-[5px] text-meta text-text-muted">
            <StatusDot status={status} />
            {STATUS_LABEL[status]}
          </span>
        </div>
        {p.custom_status && <p className="selectable mt-2 text-label font-normal text-text">{p.custom_status}</p>}

        {p.id !== me && (
          <>
            <div className="my-3 h-px bg-border" />
            <div className="flex items-center gap-2">
              {rel?.status === 'accepted' ? (
                <Button size="sm" className="flex-1" onClick={() => void openDm(p.id)}>
                  <MessageCircle className="h-4 w-4" /> Mesaj Gönder
                </Button>
              ) : rel?.status === 'pending' ? (
                <Button size="sm" variant="secondary" className="flex-1" disabled>
                  Arkadaşlık isteği bekliyor.
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="success"
                  className="flex-1"
                  onClick={() => void call('send_friend_request', 'Arkadaşlık isteği gönderildi.')}
                >
                  <UserPlus className="h-4 w-4" /> Arkadaş Ekle
                </Button>
              )}
              <DropdownMenu>
                <Tooltip label="Diğer">
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Diğer"
                      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-sidebar text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header data-[state=open]:bg-hover"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {rel?.status !== 'accepted' && (
                    <DropdownMenuItem onSelect={() => void openDm(p.id)}>
                      <MessageCircle /> Mesaj Gönder
                    </DropdownMenuItem>
                  )}
                  {rel?.status !== 'accepted' && <DropdownMenuSeparator />}
                  <DropdownMenuItem danger onSelect={() => void call('block_user', 'Kullanıcıyı engelledin.')}>
                    <Ban /> Engelle
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
        {note && <p className="mt-2 text-meta text-text-muted">{note}</p>}
      </div>
    </>
  )
}

/** Ada ya da avatara tıklayınca açılan profil kartı: 320px, 64px renkli şerit, 80px avatar. */
export default function UserCard({
  userId,
  role,
  side = 'right',
  children
}: {
  userId: string
  role?: MemberRole
  side?: 'right' | 'left' | 'bottom'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={side === 'bottom' ? 'end' : 'center'}
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[320px] overflow-hidden rounded-lg border border-border bg-floating shadow-md animate-fade-in [--ot-ring:hsl(var(--floating))]"
        >
          <Card userId={userId} role={role} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
