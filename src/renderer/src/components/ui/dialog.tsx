import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

// Genişlikler: 420 onay · 460 standart (modal-w) · 560 geniş (modal-w-lg).
// Kapat (✕) yalnızca yıkıcı olmayan pencerelerde bulunur; onaylarda hideClose.
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/[.62] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-slow" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-modal max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-floating text-text shadow-lg [--ot-ring:hsl(var(--floating))]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[calc(50%-4px)] data-[state=open]:duration-slow',
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <Tooltip label="Kapat">
          <DialogPrimitive.Close
            aria-label="Kapat"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-text-muted transition-colors duration-fast hover:bg-hover hover:text-header"
          >
            <X className="h-[18px] w-[18px]" />
          </DialogPrimitive.Close>
        </Tooltip>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('px-5 pb-3 pt-5 pr-12', className)} {...props} />
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('space-y-4 px-5 pb-5', className)} {...props} />
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border bg-sidebar px-5 py-4',
        className
      )}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-title-md text-header', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-label font-normal text-text-muted', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'
