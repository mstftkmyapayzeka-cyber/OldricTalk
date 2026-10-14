import { useMemo } from 'react'
import { useAllChannels, useConversations, useReadStates } from './queries'

/**
 * Okunmamış durumu: hedefin son mesajı, son okunma zamanından yeniyse okunmamış.
 * Hiç okunmamış kanal, okunmuş sayılır (yeni katılınan sunucu her yeri kırmızıya boyamasın);
 * hiç açılmamış DM ise okunmamış sayılır.
 */
export function useUnread() {
  const { data: reads } = useReadStates()
  const { data: channels } = useAllChannels()
  const { data: conversations } = useConversations()

  return useMemo(() => {
    const channelUnread = new Set<string>()
    const serverUnread = new Set<string>()
    const dmUnread = new Set<string>()
    if (reads) {
      for (const c of channels ?? []) {
        if (c.type !== 'text' || !c.last_message_at) continue
        const r = reads[c.id]
        if (r && c.last_message_at > r) {
          channelUnread.add(c.id)
          serverUnread.add(c.server_id)
        }
      }
      for (const c of conversations ?? []) {
        if (!c.last_message_at) continue
        const r = reads[c.id]
        if (!r || c.last_message_at > r) dmUnread.add(c.id)
      }
    }
    return { channelUnread, serverUnread, dmUnread }
  }, [reads, channels, conversations])
}
