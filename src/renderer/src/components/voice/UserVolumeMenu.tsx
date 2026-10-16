import { RotateCcw, VolumeX } from 'lucide-react'
import { useUserId } from '@/stores/auth'
import { DEFAULT_VOLUME, MAX_VOLUME, setUserVolume, useUserVolumes } from '@/stores/userVolumes'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  MenuCheck
} from '@/components/ui/menu'
import { cn } from '@/lib/utils'

export function useUserVolume(userId: string): typeof DEFAULT_VOLUME {
  return useUserVolumes((s) => s.byUser[userId] ?? DEFAULT_VOLUME)
}

/** Yalnızca bu bilgisayarda susturulan kişi için küçük ikon (renk + şekil). */
export function LocalMuteIcon({ userId, className }: { userId: string; className?: string }): React.JSX.Element | null {
  const { muted } = useUserVolume(userId)
  if (!muted) return null
  return <VolumeX className={cn('h-3.5 w-3.5 shrink-0 text-dnd', className)} aria-label="Senin için susturuldu" />
}

/**
 * Ses kanalındaki bir kişiye sağ tıklayınca: kişi başı ses düzeyi (%0–%200) ve
 * yalnızca senin için susturma. Karşı tarafı etkilemez. Kendinde menü açılmaz.
 */
export default function UserVolumeMenu({
  userId,
  name,
  children
}: {
  userId: string
  name: string
  children: React.ReactElement
}): React.JSX.Element {
  const me = useUserId()
  const v = useUserVolume(userId)
  if (userId === me) return children

  const percent = Math.round(v.volume * 100)
  const changed = v.volume !== DEFAULT_VOLUME.volume || v.muted
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-[232px]">
        <div className="px-2 pb-1 pt-2">
          <div className="truncate text-label font-semibold text-header">{name}</div>
          <div className="mt-2 flex items-center justify-between text-overline uppercase text-text-muted">
            <span>Kullanıcı ses düzeyi</span>
            <span className="font-mono normal-case tracking-normal text-text">%{percent}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_VOLUME * 100}
            step={5}
            value={percent}
            aria-label={`${name} ses düzeyi`}
            aria-valuetext={`%${percent}`}
            disabled={v.muted}
            // Menü ok tuşlarını yakalamasın; kaydırıcı klavyeyle de ayarlanabilsin.
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => setUserVolume(userId, { volume: Number(e.target.value) / 100 })}
            className="range mt-1 disabled:opacity-45"
            style={{ ['--fill' as string]: `${(percent / (MAX_VOLUME * 100)) * 100}%` }}
          />
          <p className="mt-1 text-meta text-text-muted">Yalnızca senin duyduğun sesi değiştirir.</p>
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setUserVolume(userId, { muted: !v.muted })
          }}
          className={cn(v.muted && 'bg-brand-soft text-header')}
        >
          <VolumeX /> Benim için sustur
          {v.muted && <MenuCheck />}
        </ContextMenuItem>
        {changed && (
          <ContextMenuItem onSelect={() => setUserVolume(userId, DEFAULT_VOLUME)}>
            <RotateCcw /> Varsayılana döndür
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
