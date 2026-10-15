import { cn } from '@/lib/utils'

/**
 * Kor alevi taşıyan konuşma balonu. Balon brand, alev on-brand ile satır içi çizilir;
 * böylece krem temada koyu turuncu, koyu temada kor turuncusu + koyu alev olur.
 * 16px'in altında kullanılmaz.
 */
export function LogoMark({ size = 17, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <path
        d="M9 2h14a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7h-8.6L7.4 30.4A1 1 0 0 1 5.8 29.6V26H9a7 7 0 0 1-7-7V9a7 7 0 0 1 7-7z"
        fill="hsl(var(--brand))"
      />
      <path
        d="M16.1 6.6c3.2 2.9 5.9 5.2 5.9 8.8a5.9 5.9 0 0 1-11.8 0c0-2 1-3.4 2.3-4.7.3 1 .8 1.8 1.7 2.2-.4-2.5.6-4.6 1.9-6.3z"
        fill="hsl(var(--on-brand))"
      />
      <path
        d="M16.1 18.9c-.9-.9-1.6-1.5-1.6-2.4 0-.8.5-1.4 1.1-2 .7.7 1.6 1.4 1.6 2.4 0 .8-.5 1.5-1.1 2z"
        fill="hsl(var(--brand))"
      />
    </svg>
  )
}

/** "Oldric" header, "Talk" brand; araya boşluk konmaz. */
export function LogoText({ className }: { className?: string }): React.JSX.Element {
  return (
    <span className={cn('font-extrabold tracking-[-0.01em] text-header', className)}>
      Oldric<span className="text-brand">Talk</span>
    </span>
  )
}
