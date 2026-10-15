import { useQueryClient } from '@tanstack/react-query'
import { Headphones, LogOut, Mic, Pencil, Settings, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/session'
import { toggleDeafen, toggleMute, useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import VoicePanel from '@/components/voice/VoicePanel'
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
  DropdownMenuTrigger,
  MenuCheck
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

const STATUSES: UserStatus[] = ['online', 'idle', 'dnd', 'invisible']

// Panel düğmeleri 28px; kapalı mikrofon/kulaklık dnd renk + üzerine çizgi.
function PanelButton({
  label,
  off,
  onClick,
  children
}: {
  label: string
  off?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={off}
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors duration-fast hover:bg-hover active:bg-selected',
          off ? 'text-dnd' : 'text-header'
        )}
      >
        <span className={cn('grid place-items-center', off && 'slash')}>{children}</span>
      </button>
    </Tooltip>
  )
}

export default function UserPanel(): React.JSX.Element | null {
  const { data: me } = useMyProfile()
  const qc = useQueryClient()
  const open = useModal((s) => s.open)
  const voice = useVoice()
  if (!me) return null

  async function setStatus(status: UserStatus): Promise<void> {
    qc.setQueryData<Profile>(qk.profile(me!.id), (p) => (p ? { ...p, status } : p))
    await supabase.from('profiles').update({ status }).eq('id', me!.id)
  }

  const shown = displayStatus({ ...me, last_seen_at: new Date().toISOString() })

  return (
    <div className="border-t border-border [--ot-ring:hsl(var(--rail))]">
      <VoicePanel />
      <div className="flex h-user-panel shrink-0 items-center gap-0.5 bg-rail px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Durum menüsü"
              className="mr-1 flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left transition-colors duration-fast hover:bg-hover hover:[--ot-ring:hsl(var(--hover))] data-[state=open]:bg-hover data-[state=open]:[--ot-ring:hsl(var(--hover))]"
            >
              <Avatar src={me.avatar_url} name={me.display_name} seed={me.id} size={32} status={shown} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-4 text-header">{me.display_name}</div>
                <div className="truncate text-meta leading-[15px] text-text-muted">
                  {me.custom_status || STATUS_LABEL[me.status === 'invisible' ? 'invisible' : shown]}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[248px]">
            <div className="flex items-center gap-2 px-2 pb-1 pt-2">
              <Avatar src={me.avatar_url} name={me.display_name} seed={me.id} size={32} status={shown} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-4 text-header">{me.display_name}</div>
                <div className="truncate text-meta text-text-muted">@{me.username}</div>
              </div>
            </div>
            <DropdownMenuSeparator />
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => void setStatus(s)}
                className={cn(me.status === s && 'bg-brand-soft text-header')}
              >
                <StatusDot status={s === 'invisible' ? 'offline' : s} />
                {STATUS_LABEL[s]}
                {me.status === s && <MenuCheck />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => open({ type: 'settings' })}>
              <Pencil /> Profili düzenle
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open({ type: 'voiceSettings' })}>
              <SlidersHorizontal /> Ses ayarları
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => void signOut()}>
              <LogOut /> Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PanelButton
          label={voice.muted ? 'Mikrofonu Aç' : 'Sessize Al'}
          off={voice.muted}
          onClick={() => void toggleMute()}
        >
          <Mic className="h-[18px] w-[18px]" />
        </PanelButton>
        <PanelButton
          label={voice.deafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}
          off={voice.deafened}
          onClick={() => void toggleDeafen()}
        >
          <Headphones className="h-[18px] w-[18px]" />
        </PanelButton>
        <Tooltip label="Ayarlar">
          <button
            onClick={() => open({ type: 'settings' })}
            aria-label="Ayarlar"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header active:bg-selected"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
