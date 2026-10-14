import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import { colorFor } from '@/lib/utils'
import type { MemberRole, Profile } from '@/lib/types'
import { qk, useFriendships, useProfile } from '@/hooks/queries'
import { useOpenDm } from '@/hooks/useOpenDm'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Yönetici',
  moderator: 'Moderatör',
  guest: 'Üye'
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
        <Spinner />
      </div>
    )
  }
  const p: Profile = profile
  const rel = friendships.find((f) => f.requester_id === p.id || f.addressee_id === p.id)
  const status = displayStatus(p)

  async function addFriend(): Promise<void> {
    const { error } = await supabase.rpc('send_friend_request', { p_username: p.username })
    setNote(error ? errorMessage(error) : 'Arkadaşlık isteği gönderildi.')
    void qc.invalidateQueries({ queryKey: qk.friendships })
  }

  return (
    <>
      <div className="h-[60px]" style={{ background: colorFor(p.id) }} />
      <div className="px-4 pb-4">
        <div className="-mt-10 mb-3 w-fit rounded-full p-1.5 [background:hsl(var(--floating))]">
          <Avatar
            src={p.avatar_url}
            name={p.display_name}
            seed={p.id}
            size={80}
            status={status}
            ringClass="ring-floating"
          />
        </div>
        <div className="rounded-lg bg-[hsl(225_7%_11%)] p-3">
          <div className="text-xl font-bold text-header">{p.display_name}</div>
          <div className="text-sm text-foreground">@{p.username}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {p.custom_status || STATUS_LABEL[status]}
          </div>
          {role && (
            <div className="mt-3 border-t border-border pt-3 text-xs">
              <span className="font-bold uppercase text-muted-foreground">Rol</span>
              <div className="mt-1 text-foreground">{ROLE_LABEL[role]}</div>
            </div>
          )}
          {p.id !== me && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => void openDm(p.id)}>
                Mesaj Gönder
              </Button>
              {!rel && (
                <Button size="sm" variant="success" onClick={() => void addFriend()}>
                  Arkadaş Ekle
                </Button>
              )}
            </div>
          )}
          {rel?.status === 'pending' && (
            <p className="mt-2 text-xs text-muted-foreground">Arkadaşlık isteği bekliyor.</p>
          )}
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
    </>
  )
}

export default function UserCard({
  userId,
  role,
  side = 'right',
  children
}: {
  userId: string
  role?: MemberRole
  side?: 'right' | 'left'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[300px] overflow-hidden rounded-lg bg-floating shadow-2xl animate-fade-in"
        >
          <Card userId={userId} role={role} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
