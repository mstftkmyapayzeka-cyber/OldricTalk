import { Crown } from 'lucide-react'
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

const ROLE_COLOR: Partial<Record<MemberRole, string>> = {
  admin: 'text-[hsl(358_85%_70%)]',
  moderator: 'text-[hsl(200_90%_65%)]'
}

function Row({ m, server }: { m: Member; server: Server }): React.JSX.Element {
  const status = displayStatus(m.profile)
  const offline = status === 'offline'
  return (
    <UserCard userId={m.profile_id} role={m.role} side="left">
      <button
        className={cn(
          'group flex h-[42px] w-full items-center gap-3 rounded-md px-2 text-left hover:bg-hover',
          offline && 'opacity-40 hover:opacity-100'
        )}
      >
        <Avatar
          src={m.profile.avatar_url}
          name={m.profile.display_name}
          seed={m.profile_id}
          size={32}
          status={status}
          ringClass="ring-sidebar group-hover:ring-hover"
        />
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-1 truncate font-medium text-foreground', ROLE_COLOR[m.role])}>
            <span className="truncate">{m.nickname ?? m.profile.display_name}</span>
            {server.owner_id === m.profile_id && (
              <Tooltip label="Sunucu Sahibi">
                <Crown className="h-3.5 w-3.5 shrink-0 text-idle" />
              </Tooltip>
            )}
          </div>
          {m.profile.custom_status && !offline && (
            <div className="truncate text-xs text-muted-foreground">{m.profile.custom_status}</div>
          )}
        </div>
      </button>
    </UserCard>
  )
}

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
    <aside className="thin-scroll hidden w-60 shrink-0 overflow-y-auto bg-sidebar px-2 pb-4 lg:block">
      {GROUPS.map(({ role, label }) => {
        const list = online.filter((m) => m.role === role)
        if (!list.length) return null
        return (
          <div key={role}>
            <h3 className="px-2 pb-1 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label} — {list.length}
            </h3>
            {list.map((m) => (
              <Row key={m.id} m={m} server={server} />
            ))}
          </div>
        )
      })}
      {offline.length > 0 && (
        <div>
          <h3 className="px-2 pb-1 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Çevrimdışı — {offline.length}
          </h3>
          {offline.map((m) => (
            <Row key={m.id} m={m} server={server} />
          ))}
        </div>
      )}
    </aside>
  )
}
