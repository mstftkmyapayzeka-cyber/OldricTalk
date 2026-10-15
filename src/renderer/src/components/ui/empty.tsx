import { cn } from '@/lib/utils'

/**
 * Boş durum: ikon ya da illüstrasyon, bir satır başlık, bir satır açıklama.
 * Marka rengi kullanılmaz; ekran sessiz kalır.
 */
export function EmptyState({
  art,
  title,
  sub,
  children,
  className
}: {
  art?: React.ReactNode
  title: string
  sub?: string
  children?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('grid place-items-center gap-4 px-6 py-10 text-center', className)}>
      {art && <div className="text-text-muted">{art}</div>}
      <div className="flex flex-col items-center gap-1">
        <p className="text-body font-semibold text-text">{title}</p>
        {sub && <p className="max-w-[360px] text-label font-normal text-text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

/** İki kişi kartı; ikincisi kesikli ve üstü çizili (engellenen / boş liste). */
export function PeopleArt({ crossed }: { crossed?: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 180 120" width="180" height="120" aria-hidden>
      <rect x="18" y="26" width="64" height="64" rx="14" fill="hsl(var(--selected))" />
      <rect x="98" y="26" width="64" height="64" rx="14" fill="hsl(var(--hover))" />
      <circle cx="50" cy="52" r="12" fill="hsl(var(--sidebar))" />
      <path d="M30 82a20 20 0 0 1 40 0z" fill="hsl(var(--sidebar))" />
      <circle
        cx="130"
        cy="58"
        r="22"
        fill="none"
        stroke="hsl(var(--border-strong))"
        strokeWidth="3"
        strokeDasharray="5 6"
      />
      {crossed && (
        <path d="M116 44l28 28" stroke="hsl(var(--text-muted))" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  )
}
