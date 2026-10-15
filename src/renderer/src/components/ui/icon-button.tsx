import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

// Yalnızca ikon taşıyan düğme; ipucu metni zorunludur ve aria-label olarak da kullanılır.
// md 32px (radius-md) · sm 26px (radius-sm). danger: üzerine gelince dnd zemin + on-dnd.
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    sub?: string
    size?: 'sm' | 'md'
    danger?: boolean
    /** Açık/etkin durum (ör. üye listesi açık): header renk. */
    active?: boolean
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  }
>(({ label, sub, size = 'md', danger, active, tooltipSide, className, children, ...props }, ref) => (
  <Tooltip label={label} sub={sub} side={tooltipSide}>
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'grid shrink-0 place-items-center text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header active:bg-selected disabled:pointer-events-none disabled:opacity-45 [&>svg]:shrink-0',
        size === 'md' ? 'h-8 w-8 rounded-md [&>svg]:h-[18px] [&>svg]:w-[18px]' : 'h-[26px] w-[26px] rounded-sm [&>svg]:h-4 [&>svg]:w-4',
        active && 'text-header',
        danger && 'hover:bg-dnd hover:text-on-dnd',
        className
      )}
      {...props}
    >
      {children}
    </button>
  </Tooltip>
))
IconButton.displayName = 'IconButton'
