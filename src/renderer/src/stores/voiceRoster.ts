import { create } from 'zustand'

/** Bir ses kanalındaki kişi (Supabase presence ile yayılır; bağlanmadan da görünür). */
export type VoiceMember = {
  user_id: string
  channel_id: string
  name: string
  avatar_url: string | null
  muted: boolean
  deafened: boolean
  video: boolean
  screen: boolean
}

type RosterStore = {
  /** sunucu id → kanal id → kişiler */
  byServer: Record<string, Record<string, VoiceMember[]>>
  setServer: (serverId: string, members: VoiceMember[]) => void
  clearServer: (serverId: string) => void
}

export const useVoiceRoster = create<RosterStore>((set) => ({
  byServer: {},
  setServer: (serverId, members) =>
    set((s) => {
      const byChannel: Record<string, VoiceMember[]> = {}
      for (const m of members) (byChannel[m.channel_id] ??= []).push(m)
      for (const list of Object.values(byChannel)) list.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      return { byServer: { ...s.byServer, [serverId]: byChannel } }
    }),
  clearServer: (serverId) =>
    set((s) => {
      const next = { ...s.byServer }
      delete next[serverId]
      return { byServer: next }
    })
}))

const EMPTY: VoiceMember[] = []

export function useChannelVoiceMembers(serverId: string, channelId: string): VoiceMember[] {
  return useVoiceRoster((s) => s.byServer[serverId]?.[channelId] ?? EMPTY)
}
