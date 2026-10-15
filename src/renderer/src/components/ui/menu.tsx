// Açılır menü ve sağ tık menüsü; ikisi aynı görünümü paylaşır.
// floating zemin, border çerçeve, shadow-md, radius-lg; iç dolgu 6px, öğe 34px.
import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { cn } from '@/lib/utils'

const contentClass =
  'z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-floating p-1.5 text-text shadow-md [--ot-ring:hsl(var(--floating))] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base'
// İkonlar text-muted, üzerine gelince header; tehlikeli öğe dnd → dnd zemin + on-dnd.
const itemClass =
  'relative flex h-row cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-label font-semibold outline-none transition-colors duration-fast [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-text-muted data-[highlighted]:bg-hover data-[highlighted]:text-header [&[data-highlighted]>svg]:text-header data-[disabled]:pointer-events-none data-[disabled]:opacity-45 focus-visible:outline-none'
const dangerClass =
  'text-dnd [&>svg]:text-dnd data-[highlighted]:bg-dnd data-[highlighted]:text-on-dnd [&[data-highlighted]>svg]:text-on-dnd'
const separatorClass = 'my-1 h-px bg-border'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(contentClass, className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(itemClass, danger && dangerClass, className)}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export function DropdownMenuSeparator(): React.JSX.Element {
  return <DropdownMenuPrimitive.Separator className={separatorClass} />
}

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content ref={ref} className={cn(contentClass, className)} {...props} />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = 'ContextMenuContent'

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(itemClass, danger && dangerClass, className)}
    {...props}
  />
))
ContextMenuItem.displayName = 'ContextMenuItem'

export function ContextMenuSeparator(): React.JSX.Element {
  return <ContextMenuPrimitive.Separator className={separatorClass} />
}

/** Menüde seçili öğenin sağındaki ✓ (brand). */
export function MenuCheck(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="ml-auto !h-4 !w-4 !text-brand"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
