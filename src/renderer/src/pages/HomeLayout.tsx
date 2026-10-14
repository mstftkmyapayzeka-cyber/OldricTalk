import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Users, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { displayStatus } from '@/lib/presence'
import { useConversations } from '@/hooks/queries'
import { useUnread } from '@/hooks/useUnread'
import { Avatar } from '@/components/ui/avatar'
import UserPanel from '@/components/layout/UserPanel'

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
  const { dmUnread } = useUnread()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(loadHidden)
  const [filter, setFilter] = useState('')

  function hide(id: string, at: string | null): void {
    const next = { ...hidden, [id]: at ?? new Date().toISOString() }
    setHidden(next)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
    navigate('/channels/@me')
  }

  const visible = (conversations ?? []).filter(
    (c) =>
      !(hidden[c.id] && (c.last_message_at ?? '') <= hidden[c.id]) &&
      (!filter ||
        c.other.display_name.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')) ||
        c.other.username.includes(filter.toLowerCase()))
  )

  return (
    <>
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar">
        <div className="flex h-12 shrink-0 items-center border-b border-black/30 px-2.5 shadow-sm">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Sohbet bul ya da başlat"
            className="h-7 w-full rounded-sm bg-rail px-2 text-sm text-header placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="thin-scroll flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          <NavLink
            to="/channels/@me"
            end
            className={({ isActive }) =>
              cn(
                'flex h-[42px] items-center gap-3 rounded-md px-3 font-medium',
                isActive ? 'bg-selected text-header' : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              )
            }
          >
            <Users className="h-5 w-5" /> Arkadaşlar
          </NavLink>

          <div className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Direkt Mesajlar
          </div>
          {visible.map((c) => (
            <NavLink
              key={c.id}
              to={`/channels/@me/${c.id}`}
              className={({ isActive }) =>
                cn(
                  'group flex h-[42px] items-center gap-3 rounded-md px-2',
                  isActive
                    ? 'bg-selected text-header'
                    : dmUnread.has(c.id)
                      ? 'text-header hover:bg-hover'
                      : 'text-muted-foreground hover:bg-hover hover:text-foreground'
                )
              }
            >
              <Avatar
                src={c.other.avatar_url}
                name={c.other.display_name}
                seed={c.other.id}
                size={32}
                status={displayStatus(c.other)}
              />
              <span className={cn('flex-1 truncate', dmUnread.has(c.id) && 'font-semibold')}>
                {c.other.display_name}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  hide(c.id, c.last_message_at)
                }}
                className="hidden text-muted-foreground hover:text-header group-hover:block"
                aria-label="Gizle"
              >
                <X className="h-4 w-4" />
              </button>
            </NavLink>
          ))}
          {visible.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {filter ? 'Eşleşen sohbet yok.' : 'Henüz direkt mesajın yok.'}
            </p>
          )}
        </div>
        <UserPanel />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-chat">
        <Outlet />
      </main>
    </>
  )
}
