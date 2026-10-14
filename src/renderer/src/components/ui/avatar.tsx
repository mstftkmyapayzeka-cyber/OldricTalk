import * as React from 'react'
import { cn, colorFor, initials } from '@/lib/utils'
import type { DisplayStatus } from '@/lib/types'

const STATUS_COLOR: Record<DisplayStatus, string> = {
  online: 'bg-online',
  idle: 'bg-idle',
  dnd: 'bg-dnd',
  offline: 'bg-offline'
}

export function StatusDot({
  status,
  className
}: {
  status: DisplayStatus
  className?: string
}): React.JSX.Element {
  return (
    <span className={cn('relative block rounded-full', STATUS_COLOR[status], className)}>
      {status === 'idle' && (
        <span className="absolute left-0 top-0 h-[55%] w-[55%] rounded-full bg-[inherit] [background:hsl(var(--sidebar))]" />
      )}
      {status === 'dnd' && (
        <span className="absolute left-1/2 top-1/2 h-[22%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full [background:hsl(var(--sidebar))]" />
      )}
      {status === 'offline' && (
        <span className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full [background:hsl(var(--sidebar))]" />
      )}
    </span>
  )
}

export function Avatar({
  src,
  name,
  seed,
  size = 40,
  status,
  ringClass = 'ring-sidebar',
  className
}: {
  src?: string | null
  name: string
  seed?: string
  size?: number
  status?: DisplayStatus
  ringClass?: string
  className?: string
}): React.JSX.Element {
  const [failed, setFailed] = React.useState(false)
  const dot = Math.max(10, Math.round(size * 0.3))
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: colorFor(seed ?? name), fontSize: Math.round(size * 0.38) }}
        >
          {initials(name)}
        </div>
      )}
      {status && (
        <span
          className={cn('absolute -bottom-0.5 -right-0.5 rounded-full ring-[3px]', ringClass)}
          style={{ width: dot, height: dot }}
        >
          <StatusDot status={status} className="h-full w-full" />
        </span>
      )}
    </div>
  )
}
