import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { House, Plus } from 'lucide-react'
import { cn, colorFor, initials } from '@/lib/utils'
import { useConversations, useServers } from '@/hooks/queries'
import { useUnread } from '@/hooks/useUnread'
import { useModal } from '@/stores/modal'
import { Tooltip } from '@/components/ui/tooltip'
import { Avatar } from '@/components/ui/avatar'

// Soldaki gösterge: seçiliyken 32px brand, okunmamışta 8px nokta, üzerine gelince 18px.
function Indicator({ state }: { state: 'none' | 'unread' | 'active' }): React.JSX.Element {
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-xs transition-[height,background-color] duration-base',
        state === 'active' ? 'h-8 bg-brand' : 'bg-header',
        state === 'none' && 'h-0 group-hover:h-[18px]',
        state === 'unread' && 'h-2 group-hover:h-[18px]'
      )}
    />
  )
}

// 48px düğme, radius-xl; üzerine gelince ya da seçiliyken radius-md.
const railButton =
  'grid h-12 w-12 place-items-center overflow-hidden text-[15px] font-bold leading-none transition-[background-color,color,border-radius] duration-base'

function RailItem({
  label,
  active,
  unread,
  onClick,
  children,
  className,
  style
}: {
  label: string
  active: boolean
  unread?: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <div className="group relative grid w-full place-items-center">
      <Indicator state={active ? 'active' : unread ? 'unread' : 'none'} />
      <Tooltip label={label} side="right">
        <button
          onClick={onClick}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(railButton, active ? 'rounded-md' : 'rounded-xl hover:rounded-md', className)}
          style={style}
        >
          {children}
        </button>
      </Tooltip>
    </div>
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
    <nav
      aria-label="Sunucular"
      className="no-scrollbar flex w-rail shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail py-2 [--ot-ring:hsl(var(--rail))]"
    >
      <RailItem
        label="Ana Sayfa"
        active={inHome}
        onClick={() => navigate('/channels/@me')}
        className={
          inHome
            ? 'bg-brand text-on-brand'
            : 'bg-floating text-header hover:bg-brand hover:text-on-brand'
        }
      >
        <House className="h-[22px] w-[22px]" />
      </RailItem>

      {unreadDms.map((c) => (
        <div key={c.id} className="relative grid w-full place-items-center">
          <Indicator state="unread" />
          <Tooltip label={c.other.display_name} side="right">
            <NavLink to={`/channels/@me/${c.id}`} className="relative rounded-full" aria-label={c.other.display_name}>
              <Avatar src={c.other.avatar_url} name={c.other.display_name} seed={c.other.id} size={48} />
              <span className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full border-[3px] border-rail bg-dnd" />
            </NavLink>
          </Tooltip>
        </div>
      ))}

      <div role="separator" className="my-1 h-0.5 w-8 shrink-0 rounded-pill bg-border" />

      {servers?.map((s) => {
        const active = pathname.startsWith(`/channels/${s.id}`)
        return (
          <RailItem
            key={s.id}
            label={s.name}
            active={active}
            unread={serverUnread.has(s.id)}
            onClick={() => navigate(`/channels/${s.id}`)}
            className={cn(!s.icon_url && (active ? 'bg-brand text-on-brand' : 'text-on-avatar'))}
            style={!s.icon_url && !active ? { background: colorFor(s.id) } : undefined}
          >
            {s.icon_url ? (
              <img src={s.icon_url} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              initials(s.name)
            )}
          </RailItem>
        )
      })}

      <div className="mt-auto w-full pt-2">
        <RailItem
          label="Sunucu Ekle"
          active={false}
          onClick={() => open({ type: 'addServer' })}
          className="bg-floating text-online hover:bg-online hover:text-on-online"
        >
          <Plus className="h-6 w-6" />
        </RailItem>
      </div>
    </nav>
  )
}
