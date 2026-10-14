import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-sm bg-floating px-3 py-2 text-[15px] text-header placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function Field({
  label,
  error,
  hint,
  children
}: {
  label: string
  error?: string | null
  hint?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="block space-y-2">
      <span
        className={cn(
          'block text-xs font-bold uppercase tracking-wide',
          error ? 'text-dnd' : 'text-muted-foreground'
        )}
      >
        {label}
        {error && <span className="ml-1 normal-case font-normal italic">— {error}</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
