import { cn } from '@/lib/utils'
import { LogoMark, LogoText } from '@/components/layout/Logo'

// Uygulamadaki tek dönen öğe: border halka, brand üst kenar. 16 · 28 · 40 px.
const SIZE = { sm: 'h-4 w-4 border-2', md: 'h-7 w-7 border-[3px]', lg: 'h-10 w-10 border-4' }

export function Spinner({
  size = 'sm',
  className
}: {
  size?: keyof typeof SIZE
  className?: string
}): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="Yükleniyor"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-border border-t-brand [animation-duration:.8s]',
        SIZE[size],
        className
      )}
    />
  )
}

/** Açılış: rail zemin, ortada logo kilidi, altında 16px halka + tek satır metin. */
export function FullScreenLoader({ label = 'Bağlanılıyor…' }: { label?: string }): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-rail">
      <div className="flex items-center gap-2">
        <LogoMark size={34} />
        <LogoText className="text-[30px] font-black leading-[34px] tracking-[-0.02em]" />
      </div>
      <div className="flex items-center gap-2">
        <Spinner />
        <p className="text-meta text-text-muted">{label}</p>
      </div>
    </div>
  )
}
