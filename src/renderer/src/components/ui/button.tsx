import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-hover',
        secondary: 'bg-selected text-header hover:bg-[hsl(228_6%_35%)]',
        danger: 'bg-dnd text-white hover:bg-[hsl(358_70%_52%)]',
        success: 'bg-online text-white hover:bg-[hsl(142_65%_33%)]',
        ghost: 'text-foreground hover:bg-hover hover:text-header',
        link: 'text-[hsl(200_100%_65%)] underline-offset-4 hover:underline px-0'
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-[38px] px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-8 w-8'
      }
    },
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
