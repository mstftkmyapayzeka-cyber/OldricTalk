import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Search, Users, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { displayStatus } from '@/lib/presence'
import { useConversations, useFriendships } from '@/hooks/queries'
import { useUnread } from '@/hooks/useUnread'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import UserPanel from '@/components/layout/UserPanel'
import { Category, CountBadge, rowClass, Sidebar, SidebarHead } from '@/components/layout/parts'

// DM'ler listeden yalnızca yerel olarak gizlenir (yeni mesaj gelince geri döner).
const HIDDEN_KEY = 'oldrictalk-hidden-dms'

function loadHidden(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export default function HomeLayout(): React.JSX.Element {
  const { data: conversations } = useConversations()
  const { data: friendships = [] } = useFriendships()
  const { dmUnread } = useUnread()
  const me = useUserId()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(loadHidden)
  const [filter, setFilter] = useState('')

  function hide(id: string, at: string | null): void {
    const next = { ...hidden, [id]: at ?? new Date().toISOString() }
    setHidden(next)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
    navigate('/channels/@me')
  }

  // Arkadaşlar satırındaki rozet: bana gelen bekleyen istekler.
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee_id === me).length

  const visible = (conversations ?? []).filter(
    (c) =>
      !(hidden[c.id] && (c.last_message_at ?? '') <= hidden[c.id]) &&
      (!filter ||
        c.other.display_name.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')) ||
        c.other.username.includes(filter.toLowerCase()))
  )

  return (
    <>
      <Sidebar>
        <SidebarHead>
          <label className="flex h-[30px] w-full items-center gap-2 rounded-md border border-transparent bg-input px-2 text-text-muted transition-colors duration-fast hover:border-border focus-within:border-brand">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Sohbet bul ya da başlat"
              aria-label="Sohbet bul ya da başlat"
              className="h-full min-w-0 flex-1 bg-transparent text-label font-normal text-text placeholder:text-text-muted focus:outline-none focus-visible:outline-none"
            />
          </label>
        </SidebarHead>
        <nav aria-label="Direkt mesajlar" className="thin-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pt-2">
          <NavLink
            to="/channels/@me"
            end
            className={({ isActive }) => rowClass({ active: isActive, className: 'h-10' })}
          >
            <Users className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Arkadaşlar</span>
            {incoming > 0 && <CountBadge count={incoming} />}
          </NavLink>

          <Category label="Direkt Mesajlar" />
          {visible.map((c) => {
            const unread = dmUnread.has(c.id)
            return (
              <NavLink
                key={c.id}
                to={`/channels/@me/${c.id}`}
                className={({ isActive }) => rowClass({ active: isActive, unread, className: 'h-[42px]' })}
              >
                <Avatar
                  src={c.other.avatar_url}
                  name={c.other.display_name}
                  seed={c.other.id}
                  size={32}
                  status={displayStatus(c.other)}
                />
                <span className={cn('min-w-0 flex-1 truncate', unread && 'font-bold text-header')}>
                  {c.other.display_name}
                </span>
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-dnd" aria-label="Okunmamış" />}
                <Tooltip label="Listeden kaldır">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      hide(c.id, c.last_message_at)
                    }}
                    className="hidden shrink-0 text-text-muted hover:text-header group-hover:block"
                    aria-label="Listeden kaldır"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
              </NavLink>
            )
          })}
          {visible.length === 0 && (
            <p className="px-2 py-4 text-label font-normal text-text-muted">
              {filter ? 'Eşleşen sohbet yok.' : 'Henüz direkt mesajın yok.'}
            </p>
          )}
        </nav>
        <UserPanel />
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-chat [--ot-ring:hsl(var(--chat))]">
        <Outlet />
      </main>
    </>
  )
}
