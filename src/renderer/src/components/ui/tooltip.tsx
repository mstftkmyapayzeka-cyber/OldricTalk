import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({
  label,
  side = 'top',
  children
}: {
  label: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <TooltipPrimitive.Root delayDuration={50}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={side === 'right' ? 14 : 6}
          className="z-[60] max-w-xs rounded-md bg-floating px-3 py-1.5 text-sm font-semibold text-header shadow-lg animate-fade-in"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[hsl(var(--floating))]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
