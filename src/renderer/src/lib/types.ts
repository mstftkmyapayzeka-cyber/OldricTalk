import type { Enums, Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type ProfileLite = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
export type Server = Tables<'servers'>
export type Channel = Tables<'channels'>
export type ChannelType = Enums<'channel_type'>
export type MemberRole = Enums<'member_role'>
export type UserStatus = Enums<'user_status'>
export type Member = Tables<'members'> & { profile: Profile }

/** Kanal mesajı ya da DM — ikisi aynı biçimde gösterilir. */
export type ChatMessage = {
  id: string
  author_id: string
  content: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  edited_at: string | null
  deleted: boolean
  created_at: string
  channel_id?: string
  conversation_id?: string
  author: ProfileLite | null
  /** İyimser eklenmiş, sunucu henüz onaylamamış. */
  pending?: boolean
}

/** Sohbet hedefi: sunucu kanalı ya da DM konuşması. */
export type ChatTarget =
  | { kind: 'channel'; id: string; serverId: string }
  | { kind: 'dm'; id: string }

export type DisplayStatus = 'online' | 'idle' | 'dnd' | 'offline'

export type Conversation = {
  id: string
  last_message_at: string | null
  other: Profile
}

export type Friendship = Tables<'friendships'> & {
  requester: Profile
  addressee: Profile
}
