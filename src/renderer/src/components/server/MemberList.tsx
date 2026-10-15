import { Crown, Shield } from 'lucide-react'
import { displayStatus } from '@/lib/presence'
import { cn } from '@/lib/utils'
import type { Member, MemberRole, Server } from '@/lib/types'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import UserCard from '@/components/user/UserCard'

const GROUPS: { role: MemberRole; label: string }[] = [
  { role: 'admin', label: 'Yöneticiler' },
  { role: 'moderator', label: 'Moderatörler' },
  { role: 'guest', label: 'Üyeler' }
]

export const ROLE_COLOR: Partial<Record<MemberRole, string>> = {
  admin: 'text-role-admin',
  moderator: 'text-role-mod'
}

/** Rol rengi tek başına anlam taşımaz: yanında taç (yönetici) ya da kalkan (moderatör). */
export function RoleIcon({ role, owner }: { role: MemberRole; owner?: boolean }): React.JSX.Element | null {
  if (role === 'admin' || owner) {
    return (
      <Tooltip label={owner ? 'Sunucu Sahibi' : 'Yönetici'}>
        <Crown className="h-3.5 w-3.5 shrink-0 text-role-admin" aria-label={owner ? 'Sunucu Sahibi' : 'Yönetici'} />
      </Tooltip>
    )
  }
  if (role === 'moderator') {
    return (
      <Tooltip label="Moderatör">
        <Shield className="h-3.5 w-3.5 shrink-0 text-role-mod" aria-label="Moderatör" />
      </Tooltip>
    )
  }
  return null
}

function Row({ m, server }: { m: Member; server: Server }): React.JSX.Element {
  const status = displayStatus(m.profile)
  const offline = status === 'offline'
  return (
    <UserCard userId={m.profile_id} role={m.role} side="left">
      <button
        className={cn(
          'flex h-[42px] w-full items-center gap-2 rounded-sm px-2 text-left transition-[background-color,opacity] duration-fast hover:bg-hover hover:[--ot-ring:hsl(var(--hover))] data-[state=open]:bg-hover',
          offline && 'opacity-[.62] hover:opacity-100'
        )}
      >
        <Avatar
          src={m.profile.avatar_url}
          name={m.profile.display_name}
          seed={m.profile_id}
          size={32}
          status={status}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center gap-1 text-[14px] font-semibold leading-[19px] text-text',
              offline ? 'text-offline' : ROLE_COLOR[m.role]
            )}
          >
            <span className="truncate">{m.nickname ?? m.profile.display_name}</span>
            <RoleIcon role={m.role} owner={server.owner_id === m.profile_id} />
          </div>
          {m.profile.custom_status && !offline && (
            <div className="truncate text-meta text-text-muted">{m.profile.custom_status}</div>
          )}
        </div>
      </button>
    </UserCard>
  )
}

function Group({ label, list, server }: { label: string; list: Member[]; server: Server }): React.JSX.Element {
  return (
    <section>
      <h3 className="truncate px-2 pb-1 pt-3 text-overline uppercase text-text-muted">
        {label} — {list.length}
      </h3>
      {list.map((m) => (
        <Row key={m.id} m={m} server={server} />
      ))}
    </section>
  )
}

/** Üye listesi: 240px, sidebar zemin; çevrimdışılar %62 opaklık ve offline ad rengiyle. */
export default function MemberList({
  members,
  server
}: {
  members: Member[]
  server: Server
}): React.JSX.Element {
  const online = members.filter((m) => displayStatus(m.profile) !== 'offline')
  const offline = members.filter((m) => displayStatus(m.profile) === 'offline')

  return (
    <aside
      aria-label="Üyeler"
      className="thin-scroll w-members shrink-0 overflow-y-auto overflow-x-hidden border-l border-border bg-sidebar px-2 py-4 [--ot-ring:hsl(var(--sidebar))]"
    >
      {GROUPS.map(({ role, label }) => {
        const list = online.filter((m) => m.role === role)
        return list.length ? <Group key={role} label={label} list={list} server={server} /> : null
      })}
      {offline.length > 0 && <Group label="Çevrimdışı" list={offline} server={server} />}
    </aside>
  )
}
