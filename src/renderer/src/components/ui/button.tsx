import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Dolgulu düğmelerde metin beyaz değil on-brand / on-online / on-dnd mürekkebidir.
const buttonVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold transition-[background-color,color,border-color,box-shadow,filter,translate] duration-fast disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-on-brand hover:bg-brand-hover hover:shadow-brand active:translate-y-px active:bg-brand-hover active:shadow-none',
        success:
          'bg-online text-on-online hover:brightness-[1.08] active:translate-y-px active:brightness-[.94]',
        danger:
          'bg-dnd text-on-dnd hover:brightness-[1.08] active:translate-y-px active:brightness-[.94]',
        secondary: 'bg-selected text-header hover:bg-border active:translate-y-px active:bg-selected',
        ghost: 'text-text hover:bg-hover hover:text-header active:bg-selected',
        outline: 'border-border-strong text-text hover:bg-hover hover:text-header',
        dangerGhost: 'text-dnd hover:bg-dnd-soft',
        link: 'rounded-xs text-link hover:underline',
        // Yalnızca ikon taşıyan düğme; ipucu zorunludur.
        icon: 'text-text-muted hover:bg-hover hover:text-header active:bg-selected'
      },
      size: {
        sm: 'h-[30px] px-3 text-meta',
        md: 'h-9 px-4 text-label',
        lg: 'h-11 px-5 text-body',
        icon: 'h-8 w-8 px-0'
      }
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
