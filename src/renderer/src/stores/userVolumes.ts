import { create } from 'zustand'

/**
 * Kişi başı ses düzeyi (0–2 = %0–%200) ve yalnızca bu bilgisayarda susturma.
 * Karşı tarafı etkilemez; localStorage'da kişi kimliğiyle saklanır.
 */
export type UserVolume = { volume: number; muted: boolean }

const KEY = 'oldrictalk-user-volumes'
export const DEFAULT_VOLUME: UserVolume = { volume: 1, muted: false }
export const MAX_VOLUME = 2

function load(): Record<string, UserVolume> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Partial<UserVolume>>
    const out: Record<string, UserVolume> = {}
    for (const [id, v] of Object.entries(raw)) {
      const volume = typeof v.volume === 'number' ? Math.min(MAX_VOLUME, Math.max(0, v.volume)) : 1
      out[id] = { volume, muted: !!v.muted }
    }
    return out
  } catch {
    return {}
  }
}

export const useUserVolumes = create<{ byUser: Record<string, UserVolume> }>(() => ({ byUser: load() }))

export function userVolume(userId: string): UserVolume {
  return useUserVolumes.getState().byUser[userId] ?? DEFAULT_VOLUME
}

/** Hoparlöre giden kazanç: susturulmuşsa 0. */
export function effectiveGain(userId: string): number {
  const v = userVolume(userId)
  return v.muted ? 0 : v.volume
}

export function setUserVolume(userId: string, patch: Partial<UserVolume>): void {
  const next = { ...userVolume(userId), ...patch }
  next.volume = Math.min(MAX_VOLUME, Math.max(0, next.volume))
  const byUser = { ...useUserVolumes.getState().byUser }
  // Varsayılana dönen kişi listeden çıkar; depo şişmez.
  if (next.volume === 1 && !next.muted) delete byUser[userId]
  else byUser[userId] = next
  useUserVolumes.setState({ byUser })
  try {
    localStorage.setItem(KEY, JSON.stringify(byUser))
  } catch {
    // depolama kapalıysa ayar yalnızca bu oturumda geçerli
  }
}
