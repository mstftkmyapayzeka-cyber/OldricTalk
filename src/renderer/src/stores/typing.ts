import { create } from 'zustand'

/** Hedef (kanal/DM) başına yazmakta olanlar: kullanıcı id → { ad, bitiş zamanı }. */
type TypingStore = {
  byTarget: Record<string, Record<string, { name: string; until: number }>>
  add: (targetId: string, userId: string, name: string) => void
  remove: (targetId: string, userId: string) => void
  prune: () => void
}

export const TYPING_TTL_MS = 6000

export const useTyping = create<TypingStore>((set) => ({
  byTarget: {},
  add: (targetId, userId, name) =>
    set((s) => ({
      byTarget: {
        ...s.byTarget,
        [targetId]: { ...s.byTarget[targetId], [userId]: { name, until: Date.now() + TYPING_TTL_MS } }
      }
    })),
  remove: (targetId, userId) =>
    set((s) => {
      if (!s.byTarget[targetId]?.[userId]) return s
      const next = { ...s.byTarget[targetId] }
      delete next[userId]
      return { byTarget: { ...s.byTarget, [targetId]: next } }
    }),
  prune: () =>
    set((s) => {
      const now = Date.now()
      let changed = false
      const byTarget: TypingStore['byTarget'] = {}
      for (const [t, users] of Object.entries(s.byTarget)) {
        const kept = Object.fromEntries(Object.entries(users).filter(([, u]) => u.until > now))
        if (Object.keys(kept).length !== Object.keys(users).length) changed = true
        if (Object.keys(kept).length) byTarget[t] = kept
      }
      return changed ? { byTarget } : s
    })
}))
