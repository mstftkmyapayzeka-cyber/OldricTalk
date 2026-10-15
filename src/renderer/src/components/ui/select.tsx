import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuCheck
} from './menu'

/**
 * Açılır seçim: kapalı hali metin kutusuyla aynı ölçüde, sağda chevron-down.
 * Açıkken liste floating menüdür; seçili satırda brand ✓.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  className?: string
}): React.JSX.Element {
  const current = options.find((o) => o.value === value) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={current?.label}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-border-strong bg-input px-3 text-left text-[14px] leading-5 text-text transition-colors duration-fast hover:border-text-muted data-[state=open]:border-brand data-[state=open]:shadow-[0_0_0_2px_hsl(var(--brand-soft))]',
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate">{current?.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="thin-scroll max-h-[280px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className={cn(o.value === value && 'bg-brand-soft text-header')}
          >
            <span className="min-w-0 flex-1 truncate" title={o.label}>
              {o.label}
            </span>
            {o.value === value && <MenuCheck />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
