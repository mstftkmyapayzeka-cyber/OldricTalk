// Sütunların ortak parçaları: kenar çubuğu, üst çubuk, kategori başlığı, liste satırı.
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

/** Kanal/DM listesi sütunu: 240px (< 1000px pencerede 200px), sidebar zemin. */
export function Sidebar({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-sidebar [--ot-ring:hsl(var(--sidebar))] max-[999px]:w-[200px]">
      {children}
    </aside>
  )
}

/** Kenar çubuğunun 48px başlığı (sunucu adı ya da arama). */
export function SidebarHead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">{children}</div>
  )
}

/** Ana içeriğin 48px üst çubuğu. */
export function TopBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <header className="relative z-[1] flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 shadow-sm [--ot-ring:hsl(var(--chat))]">
      {children}
    </header>
  )
}

export function TopBarTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <h1 className="flex min-w-0 shrink-0 items-center gap-2 text-title-sm text-header">
      {icon && <span className="text-text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
      <span className="truncate">{children}</span>
    </h1>
  )
}

export function TopBarSep(): React.JSX.Element {
  return <div className="mx-2 h-5 w-px shrink-0 bg-border" />
}

export function TopBarSub({ children, title }: { children: React.ReactNode; title?: string }): React.JSX.Element {
  return (
    <span className="min-w-0 truncate text-label font-normal text-text-muted" title={title}>
      {children}
    </span>
  )
}

/** HEP BÜYÜK HARF kategori başlığı ("METİN KANALLARI"); isteğe bağlı + düğmesi. */
export function Category({
  label,
  addLabel,
  onAdd
}: {
  label: string
  addLabel?: string
  onAdd?: () => void
}): React.JSX.Element {
  return (
    <div className="flex w-full items-center gap-1 px-2 pb-1 pt-4 text-overline uppercase text-text-muted">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {onAdd && addLabel && (
        <Tooltip label={addLabel}>
          <button
            onClick={onAdd}
            aria-label={addLabel}
            className="grid h-5 w-5 place-items-center rounded-xs text-text-muted transition-colors duration-fast hover:text-header"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Kanal / gezinme satırı: 34px, radius-sm. Normal text-muted, üzerine hover,
 * seçili selected + header, okunmamış header + solda 4×8px çubuk.
 */
export function rowClass({
  active,
  unread,
  className
}: {
  active?: boolean
  unread?: boolean
  className?: string
}): string {
  return cn(
    'group relative mb-px flex w-full items-center gap-2 rounded-sm px-2 text-left text-label font-semibold transition-colors duration-fast hover:[--ot-ring:hsl(var(--hover))]',
    active
      ? 'bg-selected text-header [--ot-ring:hsl(var(--selected))] hover:[--ot-ring:hsl(var(--selected))]'
      : unread
        ? 'text-header hover:bg-hover'
        : 'text-text-muted hover:bg-hover hover:text-text',
    className
  )
}

export function UnreadBar(): React.JSX.Element {
  return <span aria-hidden className="absolute -left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-xs bg-header" />
}

/** Sayı rozeti: dnd zemin, on-dnd metin (okunmamış, bekleyen istek). */
export function CountBadge({ count, className }: { count: number; className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-pill bg-dnd px-[5px] text-tiny text-on-dnd',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Pencere genişliği eşiği (üye listesi < 1100px'te kendiliğinden gizlenir). */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = (): void => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}
