import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/lib/config'
import type {
  Channel,
  ChatMessage,
  ChatTarget,
  Conversation,
  Friendship,
  Member,
  Profile,
  Server
} from '@/lib/types'
import { useUserId } from '@/stores/auth'

export const qk = {
  profile: (id: string) => ['profile', id] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['server', id] as const,
  channels: (serverId: string) => ['channels', serverId] as const,
  members: (serverId: string) => ['members', serverId] as const,
  messages: (targetId: string) => ['messages', targetId] as const,
  conversations: ['conversations'] as const,
  friendships: ['friendships'] as const,
  blocks: ['blocks'] as const,
  readStates: ['readStates'] as const
}

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: qk.profile(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      must(await supabase.from('profiles').select('*').eq('id', id!).single()) as Profile
  })
}

export function useMyProfile() {
  return useProfile(useUserId())
}

export function useServers() {
  return useQuery({
    queryKey: qk.servers,
    queryFn: async () =>
      must(
        await supabase.from('servers').select('*').order('created_at', { ascending: true })
      ) as Server[]
  })
}

export function useServer(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.server(serverId ?? ''),
    enabled: !!serverId,
    queryFn: async () =>
      must(await supabase.from('servers').select('*').eq('id', serverId!).maybeSingle()) as
        | Server
        | null
  })
}

export function useChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.channels(serverId ?? ''),
    enabled: !!serverId,
    queryFn: async () =>
      must(
        await supabase
          .from('channels')
          .select('*')
          .eq('server_id', serverId!)
          .order('position')
          .order('created_at')
      ) as Channel[]
  })
}

/** Tüm sunuculardaki kanallar (okunmamış göstergesi için). */
export function useAllChannels() {
  return useQuery({
    queryKey: ['channels', 'all'] as const,
    queryFn: async () =>
      must(await supabase.from('channels').select('id, server_id, type, last_message_at')) as Pick<
        Channel,
        'id' | 'server_id' | 'type' | 'last_message_at'
      >[]
  })
}

const ROLE_ORDER = { admin: 0, moderator: 1, guest: 2 } as const

export function useMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.members(serverId ?? ''),
    enabled: !!serverId,
    // Çevrimiçi durumu heartbeat'e bağlı; liste periyodik tazelenir.
    refetchInterval: 60_000,
    queryFn: async () => {
      const rows = must(
        await supabase.from('members').select('*, profile:profiles(*)').eq('server_id', serverId!)
      ) as Member[]
      return rows.sort(
        (a, b) =>
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
          (a.nickname ?? a.profile.display_name).localeCompare(
            b.nickname ?? b.profile.display_name,
            'tr'
          )
      )
    }
  })
}

export function useConversations() {
  const me = useUserId()
  return useQuery({
    queryKey: qk.conversations,
    refetchInterval: 60_000,
    queryFn: async () => {
      type Row = {
        id: string
        last_message_at: string | null
        created_at: string
        conversation_participants: { profile: Profile }[]
      }
      const rows = must(
        await supabase
          .from('conversations')
          .select('id, last_message_at, created_at, conversation_participants(profile:profiles(*))')
      ) as unknown as Row[]
      return rows
        .map((r): Conversation | null => {
          const other = r.conversation_participants.find((p) => p.profile.id !== me)?.profile
          return other ? { id: r.id, last_message_at: r.last_message_at ?? r.created_at, other } : null
        })
        .filter((c): c is Conversation => c !== null)
        .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
    }
  })
}

export function useFriendships() {
  return useQuery({
    queryKey: qk.friendships,
    refetchInterval: 60_000,
    queryFn: async () =>
      must(
        await supabase
          .from('friendships')
          .select(
            '*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)'
          )
      ) as unknown as Friendship[]
  })
}

export function useBlocks() {
  return useQuery({
    queryKey: qk.blocks,
    queryFn: async () => {
      const rows = must(
        await supabase.from('blocks').select('blocked:profiles!blocks_blocked_id_fkey(*)')
      ) as unknown as { blocked: Profile }[]
      return rows.map((r) => r.blocked)
    }
  })
}

export function useReadStates() {
  return useQuery({
    queryKey: qk.readStates,
    queryFn: async () => {
      const rows = must(await supabase.from('read_states').select('target_id, last_read_at'))
      return Object.fromEntries(rows.map((r) => [r.target_id, r.last_read_at])) as Record<
        string,
        string
      >
    }
  })
}

// ---------------------------------------------------------------- mesajlar
const AUTHOR = 'author:profiles!%s_author_id_fkey(id, username, display_name, avatar_url)'

export type MessagePages = InfiniteData<ChatMessage[], string | null>

/** Sayfalar yeniden eskiye; her sayfa da yeniden eskiye sıralı. */
export function useMessages(target: ChatTarget) {
  return useInfiniteQuery({
    queryKey: qk.messages(target.id),
    initialPageParam: null as string | null,
    getNextPageParam: (last: ChatMessage[]) =>
      last.length < LIMITS.pageSize ? null : last[last.length - 1].created_at,
    staleTime: Infinity, // Gerçek zamanlı olaylarla güncel tutulur.
    queryFn: async ({ pageParam }) => {
      const before = pageParam ?? '9999-12-31T00:00:00Z'
      const res =
        target.kind === 'channel'
          ? await supabase
              .from('messages')
              .select(`*, ${AUTHOR.replace('%s', 'messages')}`)
              .eq('channel_id', target.id)
              .lt('created_at', before)
              .order('created_at', { ascending: false })
              .limit(LIMITS.pageSize)
          : await supabase
              .from('direct_messages')
              .select(`*, ${AUTHOR.replace('%s', 'direct_messages')}`)
              .eq('conversation_id', target.id)
              .lt('created_at', before)
              .order('created_at', { ascending: false })
              .limit(LIMITS.pageSize)
      return must(res) as unknown as ChatMessage[]
    }
  })
}
