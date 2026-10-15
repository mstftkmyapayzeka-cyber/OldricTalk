import * as React from 'react'
import { CircleAlert, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Kutular yüzeyden içe gömülü: input zemin, border-strong çerçeve; odakta brand çerçeve + brand-soft halka.
export const inputClass =
  'w-full rounded-md border border-border-strong bg-input px-3 text-[14px] leading-5 text-text transition-[border-color,background-color] duration-fast placeholder:text-text-muted hover:border-text-muted focus:border-brand focus:shadow-[0_0_0_2px_hsl(var(--brand-soft))] focus:outline-none focus-visible:outline-none disabled:opacity-45 aria-[invalid=true]:border-dnd aria-[invalid=true]:focus:shadow-[0_0_0_2px_hsl(var(--dnd-soft))]'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(inputClass, 'h-10', className)} {...props} />
  )
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, 'resize-none py-2', className)} {...props} />
))
Textarea.displayName = 'Textarea'

/** Kutunun içinde duran, kullanıcının yazmadığı ön ek ("@", "#"). */
export function PrefixedInput({
  prefix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix: string }): React.JSX.Element {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[14px] leading-5 text-text-muted">
        {prefix}
      </span>
      <Input className={cn('pl-[30px]', className)} {...props} />
    </div>
  )
}

export function Overline({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return <span className={cn('block text-overline uppercase text-text-muted', className)} {...props} />
}

/**
 * Etiketli alan. Yardım metni kalıcıdır; hata metni onun yerine değil altına gelir.
 * ok: müsaitlik gibi olumlu geri bildirim.
 */
export function Field({
  label,
  required,
  error,
  ok,
  hint,
  children
}: {
  label: string
  required?: boolean
  error?: string | null
  ok?: string | null
  hint?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <Overline>
        {label}
        {required && <span className="text-dnd"> *</span>}
      </Overline>
      {children}
      {hint && <span className="text-meta text-text-muted">{hint}</span>}
      {error ? (
        <span className="flex items-center gap-1 text-meta text-dnd">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> {error}
        </span>
      ) : (
        ok && (
          <span className="flex items-center gap-1 text-meta text-online">
            <Check className="h-3.5 w-3.5 shrink-0" /> {ok}
          </span>
        )
      )}
    </label>
  )
}

/** Hata kutusu: ne olduğunu söyler; çıkış yolu çağıranın düğmesidir. */
export function ErrorBox({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border border-dnd bg-dnd-soft p-3 text-label font-normal text-text',
        className
      )}
    >
      <CircleAlert className="mt-px h-4 w-4 shrink-0 text-dnd" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
