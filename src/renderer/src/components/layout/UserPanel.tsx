import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { displayStatus, STATUS_LABEL } from '@/lib/presence'
import type { Profile, UserStatus } from '@/lib/types'
import { qk, useMyProfile } from '@/hooks/queries'
import { useModal } from '@/stores/modal'
import { Avatar, StatusDot } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

const STATUSES: UserStatus[] = ['online', 'idle', 'dnd', 'invisible']

export default function UserPanel(): React.JSX.Element | null {
  const { data: me } = useMyProfile()
  const qc = useQueryClient()
  const open = useModal((s) => s.open)
  if (!me) return null

  async function setStatus(status: UserStatus): Promise<void> {
    qc.setQueryData<Profile>(qk.profile(me!.id), (p) => (p ? { ...p, status } : p))
    await supabase.from('profiles').update({ status }).eq('id', me!.id)
  }

  const shown = displayStatus({ ...me, last_seen_at: new Date().toISOString() })

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-1 bg-[hsl(225_7%_15%)] px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pl-0.5 pr-2 text-left hover:bg-hover">
            <Avatar
              src={me.avatar_url}
              name={me.display_name}
              seed={me.id}
              size={32}
              status={shown}
              ringClass="ring-[hsl(225_7%_15%)]"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-header">{me.display_name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {me.custom_status || STATUS_LABEL[me.status === 'invisible' ? 'invisible' : shown]}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-[230px]">
          <div className="px-2 pb-2 pt-1">
            <div className="font-semibold text-header">{me.display_name}</div>
            <div className="text-xs text-muted-foreground">@{me.username}</div>
          </div>
          <DropdownMenuSeparator />
          {STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => void setStatus(s)}>
              <StatusDot status={s === 'invisible' ? 'offline' : s} className="h-2.5 w-2.5" />
              {STATUS_LABEL[s]}
              {me.status === s && <span className="ml-auto text-xs">✓</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => open({ type: 'settings' })}>
            <Settings className="h-4 w-4" /> Profili düzenle
          </DropdownMenuItem>
          <DropdownMenuItem danger onSelect={() => void supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" /> Çıkış yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip label="Kullanıcı Ayarları">
        <button
          onClick={() => open({ type: 'settings' })}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-header"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </Tooltip>
    </div>
  )
}
