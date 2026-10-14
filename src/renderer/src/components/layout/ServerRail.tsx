import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import { cn, colorFor, initials } from '@/lib/utils'
import { useConversations, useServers } from '@/hooks/queries'
import { useUnread } from '@/hooks/useUnread'
import { useModal } from '@/stores/modal'
import { Tooltip } from '@/components/ui/tooltip'
import { Avatar } from '@/components/ui/avatar'

// Soldaki beyaz gösterge: okunmamışta nokta, üzerine gelince orta, seçiliyken uzun.
function Pill({ state }: { state: 'none' | 'unread' | 'active' }): React.JSX.Element {
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-header transition-all',
        state === 'none' && 'h-0 group-hover:h-5',
        state === 'unread' && 'h-2 group-hover:h-5',
        state === 'active' && 'h-10'
      )}
    />
  )
}

function RailButton({
  label,
  active,
  unread,
  onClick,
  children,
  className
}: {
  label: string
  active: boolean
  unread?: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip label={label} side="right">
      <div className="group relative flex w-full justify-center">
        <Pill state={active ? 'active' : unread ? 'unread' : 'none'} />
        <button
          onClick={onClick}
          aria-label={label}
          className={cn(
            'flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-150',
            active ? 'rounded-2xl' : 'rounded-3xl group-hover:rounded-2xl',
            className
          )}
        >
          {children}
        </button>
      </div>
    </Tooltip>
  )
}

export default function ServerRail(): React.JSX.Element {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: servers } = useServers()
  const { data: conversations } = useConversations()
  const { serverUnread, dmUnread } = useUnread()
  const open = useModal((s) => s.open)
  const inHome = pathname.startsWith('/channels/@me')

  const unreadDms = (conversations ?? []).filter((c) => dmUnread.has(c.id)).slice(0, 5)

  return (
    <nav className="no-scrollbar flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail pb-3 pt-1">
      <RailButton
        label="Direkt Mesajlar"
        active={inHome}
        onClick={() => navigate('/channels/@me')}
        className={cn(
          inHome ? 'bg-brand text-white' : 'bg-chat text-foreground group-hover:bg-brand group-hover:text-white'
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </RailButton>

      {unreadDms.map((c) => (
        <Tooltip key={c.id} label={c.other.display_name} side="right">
          <NavLink to={`/channels/@me/${c.id}`} className="relative">
            <Avatar src={c.other.avatar_url} name={c.other.display_name} seed={c.other.id} size={48} />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-dnd ring-4 ring-rail" />
          </NavLink>
        </Tooltip>
      ))}

      <div className="mx-auto h-0.5 w-8 rounded-full bg-chat" />

      {servers?.map((s) => {
        const active = pathname.startsWith(`/channels/${s.id}`)
        return (
          <RailButton
            key={s.id}
            label={s.name}
            active={active}
            unread={serverUnread.has(s.id)}
            onClick={() => navigate(`/channels/${s.id}`)}
            className={cn(!s.icon_url && (active ? 'bg-brand' : 'bg-chat group-hover:bg-brand'))}
          >
            {s.icon_url ? (
              <img src={s.icon_url} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <span
                className="text-[15px] font-medium text-header"
                style={active ? undefined : { color: colorFor(s.id).replace('45%', '80%') }}
              >
                {initials(s.name)}
              </span>
            )}
          </RailButton>
        )
      })}

      <RailButton
        label="Sunucu Ekle"
        active={false}
        onClick={() => open({ type: 'addServer' })}
        className="bg-chat text-online group-hover:bg-online group-hover:text-white"
      >
        <Plus className="h-6 w-6" />
      </RailButton>
    </nav>
  )
}
