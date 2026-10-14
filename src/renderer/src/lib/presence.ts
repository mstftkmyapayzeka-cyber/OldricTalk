import type { DisplayStatus, Profile } from './types'

/** İstemciler bu aralıkla heartbeat gönderir. */
export const HEARTBEAT_MS = 45_000
/** Bu süreden eski heartbeat çevrimdışı sayılır. */
export const ONLINE_WINDOW_MS = 100_000

export function displayStatus(
  p: Pick<Profile, 'status' | 'last_seen_at'>,
  now: number = Date.now()
): DisplayStatus {
  if (p.status === 'invisible') return 'offline'
  if (now - new Date(p.last_seen_at).getTime() > ONLINE_WINDOW_MS) return 'offline'
  return p.status
}

export const STATUS_LABEL: Record<DisplayStatus | 'invisible', string> = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız Etmeyin',
  offline: 'Çevrimdışı',
  invisible: 'Görünmez'
}
