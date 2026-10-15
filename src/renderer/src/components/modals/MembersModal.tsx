import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ChevronDown, Search, UserMinus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { displayStatus } from '@/lib/presence'
import type { Member, MemberRole, Profile, Server } from '@/lib/types'
import { qk } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EmptyState, PeopleArt } from '@/components/ui/empty'
import { ErrorBox, Field, Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuCheck
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { RoleIcon } from '@/components/server/MemberList'

const ROLE_LABEL: Record<MemberRole, string> = { admin: 'Yönetici', moderator: 'Moderatör', guest: 'Üye' }

/** 132px rol seçici (açılır seçim görünümünde); dar olduğu için ad kırpılır, tam adı ipucunda. */
function RoleSelect({
  role,
  onChange
}: {
  role: MemberRole
  onChange: (role: MemberRole) => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <Tooltip label={`Rol: ${ROLE_LABEL[role]}`}>
        <DropdownMenuTrigger asChild>
          <button className="flex h-8 w-[132px] shrink-0 items-center gap-2 rounded-md border border-border-strong bg-input px-3 text-left text-[14px] leading-5 text-text transition-colors duration-fast hover:border-text-muted data-[state=open]:border-brand data-[state=open]:shadow-[0_0_0_2px_hsl(var(--brand-soft))]">
            <span className="min-w-0 flex-1 truncate">{ROLE_LABEL[role]}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {(['admin', 'moderator', 'guest'] as const).map((r) => (
          <DropdownMenuItem
            key={r}
            onSelect={() => r !== role && onChange(r)}
            className={cn(role === r && 'bg-brand-soft text-header')}
          >
            {ROLE_LABEL[r]}
            {role === r && <MenuCheck />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MemberRow({
  profile,
  sub,
  children
}: {
  profile: Profile
  sub: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md border-t border-border px-3 py-2 transition-colors duration-fast first:border-t-transparent hover:border-transparent hover:bg-hover hover:[--ot-ring:hsl(var(--hover))] [&:hover+div]:border-t-transparent">
      <Avatar
        src={profile.avatar_url}
        name={profile.display_name}
        seed={profile.id}
        size={32}
        status={displayStatus(profile)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold leading-[19px] text-header">{profile.display_name}</span>
        <span className="truncate text-meta text-text-muted">{sub}</span>
      </div>
      {children}
    </div>
  )
}

export default function MembersModal({
  server,
  onClose
}: {
  server: Server
  onClose: () => void
}): React.JSX.Element {
  const qc = useQueryClient()
  const me = useUserId()
  const { members, role: myRole } = useMembership(server.id)
  const [tab, setTab] = useState<'members' | 'bans'>('members')
  const [banning, setBanning] = useState<Member | null>(null)
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bans = useQuery({
    queryKey: ['bans', server.id],
    enabled: tab === 'bans',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('server_bans')
        .select('reason, created_at, profile:profiles!server_bans_profile_id_fkey(*)')
        .eq('server_id', server.id)
      if (error) throw error
      return data as unknown as { reason: string | null; created_at: string; profile: Profile }[]
    }
  })

  async function setRole(m: Member, role: MemberRole): Promise<void> {
    setError(null)
    const { error } = await supabase.rpc('set_member_role', { p_member: m.id, p_role: role })
    if (error) setError(errorMessage(error))
    void qc.invalidateQueries({ queryKey: qk.members(server.id) })
  }

  // "At" onay istemez: atılan kişi yeni bir davetle geri gelebilir.
  async function kick(m: Member): Promise<void> {
    setError(null)
    const { error } = await supabase.rpc('kick_member', { p_member: m.id, p_ban: false })
    if (error) setError(errorMessage(error))
    void qc.invalidateQueries({ queryKey: qk.members(server.id) })
  }

  async function unban(profileId: string): Promise<void> {
    setError(null)
    const { error } = await supabase.rpc('unban_member', { p_server: server.id, p_profile: profileId })
    if (error) setError(errorMessage(error))
    void bans.refetch()
  }

  function canAct(m: Member): boolean {
    if (m.profile_id === me || m.profile_id === server.owner_id) return false
    if (myRole === 'admin') return true
    return myRole === 'moderator' && m.role === 'guest'
  }

  const q = query.trim().toLocaleLowerCase('tr')
  const shown = members.filter(
    (m) =>
      !q ||
      (m.nickname ?? m.profile.display_name).toLocaleLowerCase('tr').includes(q) ||
      m.profile.username.includes(q)
  )

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[600px]">
          <DialogHeader>
            <DialogTitle>Üyeleri Yönet</DialogTitle>
            <DialogDescription>{members.length} üye</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-0">
            {/* Pencere içinde alt çizgili sekmeler. */}
            <div role="tablist" className="mb-3 flex items-center gap-1 border-b border-border">
              {(['members', 'bans'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'relative h-9 px-3 text-label font-semibold transition-colors duration-fast',
                    tab === t
                      ? 'text-header after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-pill after:bg-brand'
                      : 'text-text-muted hover:text-text'
                  )}
                >
                  {t === 'members' ? 'Üyeler' : 'Yasaklananlar'}
                </button>
              ))}
            </div>
            {error && <ErrorBox className="mb-3">{error}</ErrorBox>}

            {tab === 'members' && (
              <>
                <label className="mb-2 flex h-8 items-center gap-2 rounded-md border border-transparent bg-input px-2 text-text-muted transition-colors duration-fast hover:border-border focus-within:border-brand">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Üye ara"
                    aria-label="Üye ara"
                    className="h-full min-w-0 flex-1 bg-transparent text-label font-normal text-text placeholder:text-text-muted focus:outline-none focus-visible:outline-none"
                  />
                </label>
                <div className="thin-scroll -mx-1 max-h-[400px] overflow-y-auto px-1 [--ot-ring:hsl(var(--floating))]">
                  {shown.map((m) => (
                    <MemberRow
                      key={m.id}
                      profile={m.profile}
                      sub={
                        <span className="inline-flex items-center gap-1">
                          @{m.profile.username}
                          <RoleIcon role={m.role} owner={m.profile_id === server.owner_id} />
                        </span>
                      }
                    >
                      {canAct(m) ? (
                        <>
                          {myRole === 'admin' && <RoleSelect role={m.role} onChange={(r) => void setRole(m, r)} />}
                          <Button size="sm" variant="ghost" onClick={() => void kick(m)}>
                            <UserMinus className="h-3.5 w-3.5" /> At
                          </Button>
                          <Button size="sm" variant="dangerGhost" onClick={() => setBanning(m)}>
                            <Ban className="h-3.5 w-3.5" /> Yasakla
                          </Button>
                        </>
                      ) : (
                        <span className="shrink-0 text-meta text-text-muted">
                          {m.profile_id === server.owner_id ? 'Sunucu Sahibi' : ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </MemberRow>
                  ))}
                  {shown.length === 0 && <EmptyState title="Eşleşen üye yok." sub="Aramayı değiştirip yeniden dene." />}
                </div>
              </>
            )}

            {tab === 'bans' &&
              (bans.data?.length ? (
                <div className="thin-scroll -mx-1 max-h-[440px] overflow-y-auto px-1 [--ot-ring:hsl(var(--floating))]">
                  {bans.data.map((b) => (
                    <MemberRow key={b.profile.id} profile={b.profile} sub={b.reason || 'Sebep belirtilmedi'}>
                      <Button size="sm" variant="outline" onClick={() => void unban(b.profile.id)}>
                        Yasağı Kaldır
                      </Button>
                    </MemberRow>
                  ))}
                </div>
              ) : (
                <EmptyState
                  art={<PeopleArt crossed />}
                  title="Yasaklanan kimse yok."
                  sub="Birini yasaklarsan burada listelenir ve yasağı buradan kaldırabilirsin."
                />
              ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {banning && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setBanning(null)
              setReason('')
            }
          }}
          title="Üyeyi Yasakla"
          confirmLabel="Yasakla"
          onConfirm={async () => {
            const { error } = await supabase.rpc('kick_member', {
              p_member: banning.id,
              p_ban: true,
              p_reason: reason.trim() || undefined
            })
            if (error) throw error
            await qc.invalidateQueries({ queryKey: qk.members(server.id) })
            void bans.refetch()
          }}
        >
          <div className="flex items-start gap-3 text-body text-text">
            <Avatar
              src={banning.profile.avatar_url}
              name={banning.profile.display_name}
              seed={banning.profile_id}
              size={48}
            />
            <span>
              <b className="font-semibold text-header">{banning.nickname ?? banning.profile.display_name}</b>{' '}
              sunucudan yasaklanacak ve davetle bile geri dönemeyecek.
            </span>
          </div>
          <Field label="Sebep (isteğe bağlı)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={512} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  )
}
