import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Seçim kartı: sidebar zemin + border; üzerine gelince brand çerçeve + hover zemin,
 * seçiliyken brand-soft zemin + sağda brand ✓. `selected` verilmezse gezinme kartıdır (›).
 */
export function ChoiceCard({
  icon,
  title,
  desc,
  selected,
  onClick
}: {
  icon: React.ReactNode
  title: string
  desc: string
  selected?: boolean
  onClick: () => void
}): React.JSX.Element {
  const selectable = selected !== undefined
  return (
    <button
      type="button"
      onClick={onClick}
      role={selectable ? 'radio' : undefined}
      aria-checked={selectable ? selected : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-4 text-left text-text transition-[border-color,background-color] duration-fast',
        selected ? 'border-brand bg-brand-soft' : 'border-border bg-sidebar hover:border-brand hover:bg-hover'
      )}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-body font-semibold text-header">{title}</span>
        <span className="text-meta leading-[17px] text-text-muted">{desc}</span>
      </span>
      {selectable ? (
        selected && <Check className="h-[18px] w-[18px] shrink-0 text-brand" />
      ) : (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-text-muted" />
      )}
    </button>
  )
}
