import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />
}

export function FullScreenLoader({ label }: { label?: string }): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-rail">
      <Spinner className="h-8 w-8" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}
