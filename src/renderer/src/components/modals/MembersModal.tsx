import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, MoreVertical, Shield, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import type { Member, MemberRole, Profile, Server } from '@/lib/types'
import { qk } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useUserId } from '@/stores/auth'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<MemberRole, string> = { admin: 'Yönetici', moderator: 'Moderatör', guest: 'Üye' }

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
  const [kick, setKick] = useState<{ member: Member; ban: boolean } | null>(null)
  const [reason, setReason] = useState('')
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

  async function unban(profileId: string): Promise<void> {
    const { error } = await supabase.rpc('unban_member', { p_server: server.id, p_profile: profileId })
    if (error) setError(errorMessage(error))
    void bans.refetch()
  }

  function canAct(m: Member): boolean {
    if (m.profile_id === me || m.profile_id === server.owner_id) return false
    if (myRole === 'admin') return true
    return myRole === 'moderator' && m.role === 'guest'
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Üyeleri Yönet</DialogTitle>
            <DialogDescription>{members.length} üye</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 px-4">
            {(['members', 'bans'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  tab === t ? 'bg-selected text-header' : 'text-muted-foreground hover:bg-hover'
                )}
              >
                {t === 'members' ? 'Üyeler' : 'Yasaklananlar'}
              </button>
            ))}
          </div>
          <DialogBody className="thin-scroll max-h-[420px] overflow-y-auto">
            {error && <p className="text-sm text-dnd">{error}</p>}
            {tab === 'members' &&
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar src={m.profile.avatar_url} name={m.profile.display_name} seed={m.profile_id} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate font-medium text-header">
                      {m.nickname ?? m.profile.display_name}
                      {m.profile_id === server.owner_id ? (
                        <Crown className="h-4 w-4 text-idle" />
                      ) : m.role === 'admin' ? (
                        <ShieldCheck className="h-4 w-4 text-dnd" />
                      ) : m.role === 'moderator' ? (
                        <Shield className="h-4 w-4 text-[hsl(200_90%_65%)]" />
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{m.profile.username} • {ROLE_LABEL[m.role]}
                    </div>
                  </div>
                  {canAct(m) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-header">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {myRole === 'admin' &&
                          (['admin', 'moderator', 'guest'] as const).map((r) => (
                            <DropdownMenuItem key={r} disabled={m.role === r} onSelect={() => void setRole(m, r)}>
                              {ROLE_LABEL[r]} yap {m.role === r && '✓'}
                            </DropdownMenuItem>
                          ))}
                        {myRole === 'admin' && <DropdownMenuSeparator />}
                        <DropdownMenuItem danger onSelect={() => setKick({ member: m, ban: false })}>
                          Sunucudan at
                        </DropdownMenuItem>
                        <DropdownMenuItem danger onSelect={() => setKick({ member: m, ban: true })}>
                          Yasakla
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            {tab === 'bans' &&
              (bans.data?.length ? (
                bans.data.map((b) => (
                  <div key={b.profile.id} className="flex items-center gap-3">
                    <Avatar src={b.profile.avatar_url} name={b.profile.display_name} seed={b.profile.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-header">{b.profile.display_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{b.reason || 'Sebep belirtilmedi'}</div>
                    </div>
                    <button
                      onClick={() => void unban(b.profile.id)}
                      className="text-sm text-[hsl(200_100%_65%)] hover:underline"
                    >
                      Yasağı kaldır
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-muted-foreground">Yasaklanan kimse yok.</p>
              ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {kick && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setKick(null)
              setReason('')
            }
          }}
          title={`'${kick.member.profile.display_name}' ${kick.ban ? 'yasaklansın mı?' : 'atılsın mı?'}`}
          description={
            kick.ban
              ? 'Yasaklanan kişi sunucudan atılır ve davetle yeniden katılamaz.'
              : 'Atılan kişi yeni bir davetle yeniden katılabilir.'
          }
          confirmLabel={kick.ban ? 'Yasakla' : 'At'}
          onConfirm={async () => {
            const { error } = await supabase.rpc('kick_member', {
              p_member: kick.member.id,
              p_ban: kick.ban,
              p_reason: reason.trim() || undefined
            })
            if (error) throw error
            await qc.invalidateQueries({ queryKey: qk.members(server.id) })
            void bans.refetch()
          }}
        >
          {kick.ban && (
            <div className="mt-4">
              <Field label="Sebep (isteğe bağlı)">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={512} />
              </Field>
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
