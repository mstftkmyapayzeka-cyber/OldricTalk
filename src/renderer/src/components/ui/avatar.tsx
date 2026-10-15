import * as React from 'react'
import { cn, colorFor, initials } from '@/lib/utils'
import type { DisplayStatus } from '@/lib/types'

// Durum rengin yanında ŞEKİL de taşır: çevrimiçi dolu daire, boşta hilal,
// rahatsız etmeyin eksi, çevrimdışı içi boş halka. Halka/ısırık rengi bulunduğu
// yüzeyden gelir: yüzey --ot-ring değişkenini tanımlar (varsayılan sidebar).
const RING = 'var(--ot-ring, hsl(var(--sidebar)))'

const FILL: Record<DisplayStatus, string> = {
  online: 'hsl(var(--online))',
  idle: 'hsl(var(--idle))',
  dnd: 'hsl(var(--dnd))',
  offline: RING
}

function StatusShape({
  status,
  size,
  stroke
}: {
  status: DisplayStatus
  size: number
  stroke: number
}): React.JSX.Element | null {
  if (status === 'idle') {
    return (
      <span
        className="absolute h-[72%] w-[72%] rounded-full"
        style={{ background: RING, right: '-24%', top: '-24%' }}
      />
    )
  }
  if (status === 'dnd') {
    return (
      <span
        className="h-[2px] w-[62%] rounded-full bg-on-dnd"
        style={size >= 20 ? { height: 4 } : undefined}
      />
    )
  }
  if (status === 'offline') {
    return (
      <span
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: `inset 0 0 0 ${stroke}px hsl(var(--offline))` }}
      />
    )
  }
  return null
}

/** Satır içi durum noktası (menüde, kartta, listede). */
export function StatusDot({
  status,
  size = 12,
  className
}: {
  status: DisplayStatus
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, background: FILL[status] }}
    >
      <StatusShape status={status} size={size} stroke={size <= 12 ? 2.5 : 3} />
    </span>
  )
}

// Avatar boyutları: 20 ses satırı · 24 üst çubuk · 32 liste · 40 mesaj · 48 yığın · 80 kart · 96 karo.
const FONT: Record<number, number> = { 20: 9, 24: 10, 32: 13, 40: 15, 48: 18, 80: 30, 96: 34, 120: 42 }

function statusMetrics(size: number): { dot: number; border: number; offset: number } {
  if (size <= 28) return { dot: 10, border: 2, offset: -2 }
  if (size <= 56) return { dot: 14, border: 3, offset: -2 }
  if (size <= 88) return { dot: 24, border: 5, offset: 0 }
  return { dot: 28, border: 5, offset: 2 }
}

export function Avatar({
  src,
  name,
  seed,
  size = 40,
  status,
  speaking,
  className
}: {
  src?: string | null
  name: string
  seed?: string
  size?: number
  status?: DisplayStatus
  /** Konuşan kişi: 3px online halka (yalnızca ses varken). */
  speaking?: boolean
  className?: string
}): React.JSX.Element {
  const [failed, setFailed] = React.useState(false)
  const m = statusMetrics(size)
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-full transition-shadow duration-slow',
        speaking && 'shadow-[0_0_0_3px_hsl(var(--online))]',
        className
      )}
      style={{ width: size, height: size }}
    >
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
          className="grid h-full w-full place-items-center rounded-full font-bold text-on-avatar"
          style={{
            background: colorFor(seed ?? name),
            fontSize: FONT[size] ?? Math.round(size * 0.37)
          }}
        >
          {initials(name)}
        </div>
      )}
      {status && (
        <span
          className="absolute grid place-items-center overflow-hidden rounded-full"
          style={{
            width: m.dot,
            height: m.dot,
            right: m.offset,
            bottom: m.offset,
            border: `${m.border}px solid ${RING}`,
            background: FILL[status]
          }}
        >
          <StatusShape status={status} size={m.dot} stroke={m.border} />
        </span>
      )}
    </div>
  )
}
