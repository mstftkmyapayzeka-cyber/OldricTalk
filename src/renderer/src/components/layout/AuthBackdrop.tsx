import { cn } from '@/lib/utils'

/**
 * Giriş, kayıt ve davet ekranlarının arka planı: chat zemin üzerinde brand ve kişi
 * renklerinden bloklar; hiçbiri karta değmez. Ortadaki kart children olarak gelir.
 */
export default function AuthBackdrop({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('relative grid h-full w-full place-items-center overflow-auto bg-chat p-4', className)}>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1280 770"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        focusable="false"
      >
        <g opacity=".5">
          <rect x="-80" y="120" width="260" height="260" rx="14" fill="hsl(var(--brand))" opacity=".16" />
          <rect x="120" y="430" width="140" height="140" rx="14" fill="hsl(var(--avatar-1))" opacity=".2" />
          <rect x="1080" y="-30" width="260" height="190" rx="14" fill="hsl(var(--avatar-3))" opacity=".18" />
          <rect x="1150" y="470" width="220" height="220" rx="14" fill="hsl(var(--brand))" opacity=".1" />
          <path d="M180 380a64 64 0 0 1-64 64v-64z" fill="hsl(var(--idle))" opacity=".22" />
          <path d="M1080 470a86 86 0 0 1 86-86v86z" fill="hsl(var(--avatar-2))" opacity=".26" />
        </g>
        <g fill="hsl(var(--brand))" opacity=".14">
          {[340, 400, 460].flatMap((x) => [120, 180].map((y) => <circle key={`a${x}${y}`} cx={x} cy={y} r="6" />))}
          {[820, 880, 940].flatMap((x) => [640, 700].map((y) => <circle key={`b${x}${y}`} cx={x} cy={y} r="6" />))}
        </g>
      </svg>
      {children}
    </div>
  )
}

/** Ortadaki kart: floating zemin, border, radius-xl, shadow-lg, 32px dolgu. */
export function AuthCard({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative z-[1] w-[440px] max-w-full rounded-xl border border-border bg-floating p-8 shadow-lg animate-fade-in [--ot-ring:hsl(var(--floating))]',
        className
      )}
    >
      {children}
    </div>
  )
}
