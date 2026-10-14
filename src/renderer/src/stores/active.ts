import { create } from 'zustand'

/** Şu an ekranda açık sohbet hedefi (bildirim ve okundu kararı için). */
export const useActiveTarget = create<{ targetId: string | null }>(() => ({ targetId: null }))
