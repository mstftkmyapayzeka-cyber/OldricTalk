import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Check, MessageCircle, MoreVertical, Search, UserMinus, Users, X } from 'lucide-react'
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
import { EmptyState, PeopleArt } from '@/components/ui/empty'
import { ErrorBox, PrefixedInput } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { CountBadge, TopBar, TopBarSep, TopBarTitle } from '@/components/layout/parts'

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add'

// Sekme sırası sabittir: Çevrimiçi, Tümü, Bekleyen, Engellenen.
const TABS: { id: Exclude<Tab, 'add'>; label: string }[] = [
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Bekleyen' },
  { id: 'blocked', label: 'Engellenen' }
]

/** 34px yuvarlak eylem düğmesi; normalde sidebar zeminli nötr daire. */
function RoundAction({
  label,
  onClick,
  tone,
  children
}: {
  label: string
  onClick: () => void
  tone?: 'accept' | 'reject'
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
          'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-sidebar text-text-muted transition-colors duration-fast [&>svg]:h-[18px] [&>svg]:w-[18px]',
          tone === 'accept'
            ? 'hover:bg-online hover:text-on-online'
            : tone === 'reject'
              ? 'hover:bg-dnd hover:text-on-dnd'
              : 'hover:bg-floating hover:text-header'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/** Arkadaş satırı: ~54px, satırlar arası border çizgisi; eylemler her zaman görünür. */
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
      className={cn(
        'group flex items-center gap-3 rounded-md border-t border-border px-3 py-2 transition-colors duration-fast first-of-type:border-t-transparent hover:border-transparent hover:bg-hover hover:[--ot-ring:hsl(var(--hover))] [&:hover+div]:border-t-transparent',
        onClick && 'cursor-pointer'
      )}
    >
      <Avatar
        src={profile.avatar_url}
        name={profile.display_name}
        seed={profile.id}
        size={32}
        status={displayStatus(profile)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-semibold leading-5 text-header">{profile.display_name}</span>
        <span className="truncate text-meta text-text-muted">
          @{profile.username} · {subtitle}
        </span>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  )
}

function ListHead({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return <h3 className={cn('px-3 pb-2 text-overline uppercase text-text-muted', className)}>{children}</h3>
}

function AddFriend(): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const name = username.trim().replace(/^@/, '')
    setBusy(true)
    const { data, error } = await supabase.rpc('send_friend_request', { p_username: name })
    setBusy(false)
    if (error) {
      setResult({ ok: false, text: errorMessage(error) })
      return
    }
    const texts: Record<string, string> = {
      sent: `@${name} kişisine arkadaşlık isteği gönderildi.`,
      accepted: `@${name} ile artık arkadaşsınız!`,
      already_friends: `@${name} zaten arkadaşın.`,
      already_pending: `@${name} kişisine zaten istek göndermiştin.`
    }
    setResult({ ok: true, text: texts[data] ?? 'İstek gönderildi.' })
    // Kutu temizlenmez; kullanıcı yazdığını görmeye devam eder.
    void qc.invalidateQueries({ queryKey: qk.friendships })
  }

  return (
    <div className="flex max-w-content flex-col gap-2 px-3">
      <h2 className="text-title-sm text-header">Arkadaş Ekle</h2>
      <p className="text-meta text-text-muted">
        Kullanıcı adını yazarak arkadaşlık isteği gönderebilirsin. Büyük-küçük harf önemli değil.
      </p>
      <form onSubmit={submit} className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PrefixedInput
            prefix="@"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase())
              setResult(null)
            }}
            aria-label="Kullanıcı adı"
            aria-invalid={result?.ok === false}
            placeholder="kullaniciadi"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={!username.trim() || busy}>
          Arkadaşlık İsteği Gönder
        </Button>
      </form>
      {result && (
        <p className={cn('mt-1 flex items-center gap-1 text-meta', result.ok ? 'text-online' : 'text-dnd')}>
          {result.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {result.text}
        </p>
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
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester_id === me ? f.addressee : f.requester))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'tr'))
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee_id === me)
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester_id === me)

  async function call(fn: string, args: Record<string, unknown>): Promise<void> {
    setActionError(null)
    const { error } = await supabase.rpc(fn as 'remove_friend', args as { p_other: string })
    if (error) setActionError(errorMessage(error))
    void qc.invalidateQueries({ queryKey: qk.friendships })
    void qc.invalidateQueries({ queryKey: qk.blocks })
  }

  const q = query.trim().toLocaleLowerCase('tr')
  const matches = (p: Profile): boolean =>
    !q || p.display_name.toLocaleLowerCase('tr').includes(q) || p.username.includes(q)
  const online = friends.filter((f) => displayStatus(f) !== 'offline')
  const list = (tab === 'online' ? online : friends).filter(matches)

  return (
    <>
      <TopBar>
        <TopBarTitle icon={<Users />}>Arkadaşlar</TopBarTitle>
        <TopBarSep />
        <nav className="flex min-w-0 items-center gap-1" aria-label="Arkadaş listeleri">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-2 rounded-sm px-3 text-label font-semibold transition-colors duration-fast',
                tab === t.id ? 'bg-selected text-header' : 'text-text-muted hover:bg-hover hover:text-text'
              )}
            >
              {t.label}
              {t.id === 'pending' && incoming.length > 0 && <CountBadge count={incoming.length} />}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <Button size="sm" variant="success" onClick={() => setTab('add')} aria-current={tab === 'add' ? 'page' : undefined}>
          Arkadaş Ekle
        </Button>
      </TopBar>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4 [--ot-ring:hsl(var(--chat))]">
        {actionError && <ErrorBox className="mx-3 mb-4">{actionError}</ErrorBox>}

        {tab === 'add' && <AddFriend />}

        {(tab === 'online' || tab === 'all') && (
          <>
            {friends.length > 0 && (
              <div className="px-3 pb-3">
                <label className="flex h-[34px] items-center gap-2 rounded-md border border-transparent bg-input px-2 text-text-muted transition-colors duration-fast hover:border-border focus-within:border-brand">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ara"
                    aria-label="Arkadaşlarda ara"
                    className="h-full min-w-0 flex-1 bg-transparent text-label font-normal text-text placeholder:text-text-muted focus:outline-none focus-visible:outline-none"
                  />
                </label>
              </div>
            )}
            {list.length > 0 && (
              <ListHead>
                {tab === 'online' ? 'Çevrimiçi' : 'Tüm arkadaşlar'} — {list.length}
              </ListHead>
            )}
            <div>
              {list.map((p) => (
                <Row
                  key={p.id}
                  profile={p}
                  subtitle={p.custom_status || STATUS_LABEL[displayStatus(p)]}
                  onClick={() => void openDm(p.id)}
                >
                  <RoundAction label="Mesaj" onClick={() => void openDm(p.id)}>
                    <MessageCircle />
                  </RoundAction>
                  <DropdownMenu>
                    <Tooltip label="Diğer">
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label="Diğer"
                          className="grid h-[34px] w-[34px] place-items-center rounded-full bg-sidebar text-text-muted transition-colors duration-fast hover:bg-floating hover:text-header data-[state=open]:bg-floating data-[state=open]:text-header"
                        >
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                      </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => void openDm(p.id)}>
                        <MessageCircle /> Mesaj gönder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem danger onSelect={() => void call('remove_friend', { p_other: p.id })}>
                        <UserMinus /> Arkadaşlıktan çıkar
                      </DropdownMenuItem>
                      <DropdownMenuItem danger onSelect={() => void call('block_user', { p_other: p.id })}>
                        <Ban /> Engelle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Row>
              ))}
            </div>
            {list.length === 0 &&
              (q ? (
                <EmptyState title="Eşleşen arkadaş yok." sub="Aramayı değiştirip yeniden dene." />
              ) : tab === 'online' && friends.length > 0 ? (
                <EmptyState
                  art={<PeopleArt />}
                  title="Şu an çevrimiçi arkadaşın yok."
                  sub="Arkadaşların bağlandığında burada görünecek."
                />
              ) : (
                <EmptyState
                  art={<PeopleArt />}
                  title="Henüz arkadaşın yok."
                  sub="Arkadaş Ekle ile kullanıcı adını yazarak ilk isteğini gönderebilirsin."
                />
              ))}
          </>
        )}

        {tab === 'pending' && (
          <>
            {incoming.length > 0 && (
              <>
                <ListHead>Gelen istekler — {incoming.length}</ListHead>
                <div>
                  {incoming.map((f) => (
                    <Row key={f.requester_id} profile={f.requester} subtitle="Gelen arkadaşlık isteği">
                      <RoundAction
                        label="Kabul Et"
                        tone="accept"
                        onClick={() => void call('accept_friend_request', { p_requester: f.requester_id })}
                      >
                        <Check />
                      </RoundAction>
                      <RoundAction
                        label="Reddet"
                        tone="reject"
                        onClick={() => void call('decline_friend_request', { p_requester: f.requester_id })}
                      >
                        <X />
                      </RoundAction>
                    </Row>
                  ))}
                </div>
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <ListHead className={incoming.length > 0 ? 'pt-5' : undefined}>
                  Gönderilen istekler — {outgoing.length}
                </ListHead>
                <div>
                  {outgoing.map((f) => (
                    <Row key={f.addressee_id} profile={f.addressee} subtitle="İstek gönderildi">
                      <RoundAction
                        label="İsteği geri al"
                        tone="reject"
                        onClick={() => void call('remove_friend', { p_other: f.addressee_id })}
                      >
                        <X />
                      </RoundAction>
                    </Row>
                  ))}
                </div>
              </>
            )}
            {incoming.length + outgoing.length === 0 && (
              <EmptyState
                art={<PeopleArt />}
                title="Bekleyen arkadaşlık isteği yok."
                sub="Sana gelen ve senin gönderdiğin istekler burada görünür."
              />
            )}
          </>
        )}

        {tab === 'blocked' &&
          (blocked.length > 0 ? (
            <>
              <ListHead>Engellenen — {blocked.length}</ListHead>
              <div>
                {blocked.map((p) => (
                  <Row key={p.id} profile={p} subtitle="Engellendi">
                    <RoundAction label="Engeli kaldır" onClick={() => void call('unblock_user', { p_other: p.id })}>
                      <X />
                    </RoundAction>
                  </Row>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-full"
              art={<PeopleArt crossed />}
              title="Engellediğin kimse yok."
              sub="Engellediğin kişiler burada listelenir; engeli buradan kaldırabilirsin."
            />
          ))}
      </div>
    </>
  )
}
