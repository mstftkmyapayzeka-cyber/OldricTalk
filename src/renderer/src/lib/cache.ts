// Gerçek zamanlı olayları ve iyimser güncellemeleri sorgu önbelleğine işler.
import type { QueryClient } from '@tanstack/react-query'
import type { ChatMessage } from './types'
import type { MessagePages } from '@/hooks/queries'
import { qk } from '@/hooks/queries'

export function upsertMessage(qc: QueryClient, targetId: string, msg: ChatMessage): void {
  qc.setQueryData<MessagePages>(qk.messages(targetId), (data) => {
    if (!data) return data
    let found = false
    const pages = data.pages.map((page) =>
      page.map((m) => {
        if (m.id !== msg.id) return m
        found = true
        // Gerçek zamanlı yükte yazar yoksa eldekini koru; sunucudan gelen kayıt kesinleşmiştir.
        return { ...m, ...msg, author: msg.author ?? m.author, pending: msg.pending ?? false }
      })
    )
    if (!found) {
      const [first = [], ...rest] = pages
      pages.splice(0, pages.length, [msg, ...first], ...rest)
    }
    return { ...data, pages }
  })
}

export function settleMessage(qc: QueryClient, targetId: string, id: string): void {
  qc.setQueryData<MessagePages>(qk.messages(targetId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => p.map((m) => (m.id === id ? { ...m, pending: false } : m)))
        }
      : data
  )
}

export function removePendingMessage(qc: QueryClient, targetId: string, id: string): void {
  qc.setQueryData<MessagePages>(qk.messages(targetId), (data) =>
    data ? { ...data, pages: data.pages.map((p) => p.filter((m) => m.id !== id)) } : data
  )
}

export function markReadLocal(qc: QueryClient, targetId: string, at: string): void {
  qc.setQueryData<Record<string, string>>(qk.readStates, (s) => ({ ...(s ?? {}), [targetId]: at }))
}
