import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider

// Simge düğmelerinde zorunlu; 90ms gecikme, tek satır, nokta yok. Kısayol ikinci satırda (sub).
export function Tooltip({
  label,
  sub,
  side = 'top',
  children
}: {
  label: React.ReactNode
  sub?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <TooltipPrimitive.Root delayDuration={90}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={side === 'right' ? 12 : 8}
          className="z-[60] whitespace-nowrap rounded-sm border border-border bg-floating px-2 py-1 text-meta font-semibold text-header shadow-md animate-fade-in"
        >
          {label}
          {sub && <span className="block text-[11px] font-normal leading-[14px] text-text-muted">{sub}</span>}
          <TooltipPrimitive.Arrow
            width={10}
            height={5}
            className="fill-floating stroke-border [stroke-width:1px]"
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
