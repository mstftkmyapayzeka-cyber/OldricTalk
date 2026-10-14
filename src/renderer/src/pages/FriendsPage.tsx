import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, MessageCircle, MoreVertical, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { qk, useBlocks, useFriendships } from '@/hooks/queries'
import { useOpenDm } from '@/hooks/useOpenDm'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add'

const TABS: { id: Exclude<Tab, 'add'>; label: string }[] = [
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Bekleyen' },
  { id: 'blocked', label: 'Engellenen' }
]

function RoundAction({
  label,
  onClick,
  danger,
  children
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-muted-foreground',
          danger ? 'hover:text-dnd' : 'hover:text-header'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function Row({
  profile,
  subtitle,
  onClick,
  children
}: {
  profile: Profile
  subtitle: string
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      className="group mx-[-10px] flex h-[62px] cursor-pointer items-center gap-3 rounded-lg border-t border-border px-2.5 hover:border-transparent hover:bg-hover"
    >
      <Avatar
        src={profile.avatar_url}
        name={profile.display_name}
        seed={profile.id}
        size={32}
        status={displayStatus(profile)}
        ringClass="ring-chat group-hover:ring-hover"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-header">
          {profile.display_name}
          <span className="ml-1.5 hidden text-sm font-normal text-muted-foreground group-hover:inline">
            @{profile.username}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="flex gap-2.5">{children}</div>
    </div>
  )
}

function AddFriend(): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('send_friend_request', {
      p_username: username.trim().replace(/^@/, '')
    })
    setBusy(false)
    if (error) {
      setResult({ ok: false, text: errorMessage(error) })
      return
    }
    const texts: Record<string, string> = {
      sent: `@${username} kullanıcısına arkadaşlık isteği gönderildi.`,
      accepted: `@${username} ile artık arkadaşsınız!`,
      already_friends: `@${username} zaten arkadaşın.`,
      already_pending: `@${username} kullanıcısına zaten istek göndermiştin.`
    }
    setResult({ ok: true, text: texts[data] ?? 'Tamam.' })
    setUsername('')
    void qc.invalidateQueries({ queryKey: qk.friendships })
  }

  return (
    <div className="border-b border-border px-8 py-5">
      <h2 className="font-semibold uppercase text-header">Arkadaş Ekle</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        OldricTalk kullanıcı adlarıyla arkadaşlarını ekleyebilirsin.
      </p>
      <form
        onSubmit={submit}
        className={cn(
          'mt-4 flex items-center rounded-lg bg-floating px-3 py-1.5 ring-1',
          result ? (result.ok ? 'ring-online' : 'ring-dnd') : 'ring-black/40 focus-within:ring-brand'
        )}
      >
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase())
            setResult(null)
          }}
          placeholder="Kullanıcı adı yazarak arkadaş ekleyebilirsin."
          className="h-10 flex-1 bg-transparent text-header placeholder:text-muted-foreground focus:outline-none"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={!username.trim() || busy}>
          Arkadaşlık İsteği Gönder
        </Button>
      </form>
      {result && (
        <p className={cn('mt-2 text-sm', result.ok ? 'text-online' : 'text-dnd')}>{result.text}</p>
      )}
    </div>
  )
}

export default function FriendsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'online'
  const setTab = (t: Tab): void => setParams({ tab: t })
  const me = useUserId()
  const qc = useQueryClient()
  const openDm = useOpenDm()
  const { data: friendships = [] } = useFriendships()
  const { data: blocked = [] } = useBlocks()

  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester_id === me ? f.addressee : f.requester))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'tr'))
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee_id === me)
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester_id === me)

  async function call(fn: string, args: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.rpc(fn as 'remove_friend', args as { p_other: string })
    if (error) alert(errorMessage(error))
    void qc.invalidateQueries({ queryKey: qk.friendships })
    void qc.invalidateQueries({ queryKey: qk.blocks })
  }

  const online = friends.filter((f) => displayStatus(f) !== 'offline')
  const list = tab === 'online' ? online : friends

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-black/30 px-4 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-header">
          <Users className="h-5 w-5 text-muted-foreground" /> Arkadaşlar
        </div>
        <div className="h-6 w-px bg-border" />
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-2 py-0.5 font-medium',
              tab === t.id ? 'bg-selected text-header' : 'text-muted-foreground hover:bg-hover hover:text-foreground'
            )}
          >
            {t.label}
            {t.id === 'pending' && incoming.length > 0 && (
              <span className="ml-1.5 rounded-full bg-dnd px-1.5 text-xs font-bold text-white">
                {incoming.length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setTab('add')}
          className={cn(
            'rounded-md px-2 py-0.5 font-medium',
            tab === 'add' ? 'bg-transparent text-online' : 'bg-online text-white'
          )}
        >
          Arkadaş Ekle
        </button>
      </header>

      {tab === 'add' && <AddFriend />}

      <div className="thin-scroll flex-1 overflow-y-auto px-8 pt-4">
        {(tab === 'online' || tab === 'all') && (
          <>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tab === 'online' ? 'Çevrimiçi' : 'Tüm arkadaşlar'} — {list.length}
            </h3>
            {list.map((p) => (
              <Row
                key={p.id}
                profile={p}
                subtitle={p.custom_status || STATUS_LABEL[displayStatus(p)]}
                onClick={() => void openDm(p.id)}
              >
                <RoundAction label="Mesaj" onClick={() => void openDm(p.id)}>
                  <MessageCircle className="h-5 w-5" />
                </RoundAction>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button
                      aria-label="Diğer"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-muted-foreground hover:text-header"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem danger onSelect={() => void call('remove_friend', { p_other: p.id })}>
                      Arkadaşlıktan çıkar
                    </DropdownMenuItem>
                    <DropdownMenuItem danger onSelect={() => void call('block_user', { p_other: p.id })}>
                      Engelle
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Row>
            ))}
            {list.length === 0 && (
              <Empty
                text={
                  tab === 'online'
                    ? 'Şu an çevrimiçi arkadaşın yok.'
                    : 'Henüz arkadaşın yok. “Arkadaş Ekle” ile başlayabilirsin.'
                }
              />
            )}
          </>
        )}

        {tab === 'pending' && (
          <>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bekleyen — {incoming.length + outgoing.length}
            </h3>
            {incoming.map((f) => (
              <Row key={f.requester_id} profile={f.requester} subtitle="Gelen arkadaşlık isteği">
                <RoundAction
                  label="Kabul et"
                  onClick={() => void call('accept_friend_request', { p_requester: f.requester_id })}
                >
                  <Check className="h-5 w-5" />
                </RoundAction>
                <RoundAction
                  label="Reddet"
                  danger
                  onClick={() => void call('decline_friend_request', { p_requester: f.requester_id })}
                >
                  <X className="h-5 w-5" />
                </RoundAction>
              </Row>
            ))}
            {outgoing.map((f) => (
              <Row key={f.addressee_id} profile={f.addressee} subtitle="Giden arkadaşlık isteği">
                <RoundAction
                  label="İptal et"
                  danger
                  onClick={() => void call('remove_friend', { p_other: f.addressee_id })}
                >
                  <X className="h-5 w-5" />
                </RoundAction>
              </Row>
            ))}
            {incoming.length + outgoing.length === 0 && <Empty text="Bekleyen arkadaşlık isteği yok." />}
          </>
        )}

        {tab === 'blocked' && (
          <>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Engellenen — {blocked.length}
            </h3>
            {blocked.map((p) => (
              <Row key={p.id} profile={p} subtitle="Engellendi">
                <RoundAction label="Engeli kaldır" onClick={() => void call('unblock_user', { p_other: p.id })}>
                  <X className="h-5 w-5" />
                </RoundAction>
              </Row>
            ))}
            {blocked.length === 0 && <Empty text="Engellediğin kimse yok." />}
          </>
        )}
      </div>
    </>
  )
}

function Empty({ text }: { text: string }): React.JSX.Element {
  return <p className="py-16 text-center text-muted-foreground">{text}</p>
}
