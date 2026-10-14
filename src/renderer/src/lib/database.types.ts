// Supabase'den üretildi (generate_typescript_types); 0004 RPC'leri elle eklendi.
// Şema değişince yeniden üretin.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type MessageColumns = {
  author_id: string
  content: string
  created_at: string
  deleted: boolean
  edited_at: string | null
  file_name: string | null
  file_type: string | null
  file_url: string | null
  id: string
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string }
        Insert: { blocked_id: string; blocker_id: string; created_at?: string }
        Update: { blocked_id?: string; blocker_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey'
            columns: ['blocked_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey'
            columns: ['blocker_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          name: string
          position: number
          server_id: string
          topic: string | null
          type: Database['public']['Enums']['channel_type']
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          name: string
          position?: number
          server_id: string
          topic?: string | null
          type?: Database['public']['Enums']['channel_type']
        }
        Update: {
          name?: string
          position?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'channels_server_id_fkey'
            columns: ['server_id']
            isOneToOne: false
            referencedRelation: 'servers'
            referencedColumns: ['id']
          }
        ]
      }
      conversation_participants: {
        Row: { conversation_id: string; profile_id: string }
        Insert: { conversation_id: string; profile_id: string }
        Update: { conversation_id?: string; profile_id?: string }
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_participants_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: { created_at: string; id: string; last_message_at: string | null }
        Insert: { created_at?: string; id?: string; last_message_at?: string | null }
        Update: { created_at?: string; id?: string; last_message_at?: string | null }
        Relationships: []
      }
      direct_messages: {
        Row: MessageColumns & { conversation_id: string }
        Insert: {
          author_id: string
          content?: string
          conversation_id: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Update: { content?: string }
        Relationships: [
          {
            foreignKeyName: 'direct_messages_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'direct_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          status: Database['public']['Enums']['friendship_status']
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          status?: Database['public']['Enums']['friendship_status']
        }
        Update: {
          status?: Database['public']['Enums']['friendship_status']
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey'
            columns: ['addressee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      members: {
        Row: {
          id: string
          joined_at: string
          nickname: string | null
          profile_id: string
          role: Database['public']['Enums']['member_role']
          server_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          nickname?: string | null
          profile_id: string
          role?: Database['public']['Enums']['member_role']
          server_id: string
        }
        Update: {
          nickname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'members_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'members_server_id_fkey'
            columns: ['server_id']
            isOneToOne: false
            referencedRelation: 'servers'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: MessageColumns & { channel_id: string }
        Insert: {
          author_id: string
          channel_id: string
          content?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Update: { content?: string }
        Relationships: [
          {
            foreignKeyName: 'messages_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_status: string | null
          display_name: string
          id: string
          last_seen_at: string
          status: Database['public']['Enums']['user_status']
          username: string
        }
        Insert: {
          avatar_url?: string | null
          custom_status?: string | null
          display_name: string
          id: string
          status?: Database['public']['Enums']['user_status']
          username: string
        }
        Update: {
          avatar_url?: string | null
          custom_status?: string | null
          display_name?: string
          status?: Database['public']['Enums']['user_status']
          username?: string
        }
        Relationships: []
      }
      read_states: {
        Row: { last_read_at: string; profile_id: string; target_id: string }
        Insert: { last_read_at?: string; profile_id: string; target_id: string }
        Update: { last_read_at?: string; profile_id?: string; target_id?: string }
        Relationships: [
          {
            foreignKeyName: 'read_states_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      server_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          profile_id: string
          reason: string | null
          server_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          profile_id: string
          reason?: string | null
          server_id: string
        }
        Update: { reason?: string | null }
        Relationships: [
          {
            foreignKeyName: 'server_bans_banned_by_fkey'
            columns: ['banned_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'server_bans_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'server_bans_server_id_fkey'
            columns: ['server_id']
            isOneToOne: false
            referencedRelation: 'servers'
            referencedColumns: ['id']
          }
        ]
      }
      servers: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          icon_url?: string | null
          name: string
          owner_id: string
        }
        Update: {
          icon_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'servers_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: { Args: { p_requester: string }; Returns: undefined }
      block_user: { Args: { p_other: string }; Returns: undefined }
      create_server: { Args: { p_icon_url?: string; p_name: string }; Returns: string }
      decline_friend_request: { Args: { p_requester: string }; Returns: undefined }
      delete_direct_message: { Args: { p_message: string }; Returns: undefined }
      delete_message: { Args: { p_message: string }; Returns: undefined }
      delete_server: { Args: { p_server: string }; Returns: undefined }
      heartbeat: { Args: never; Returns: undefined }
      go_offline: { Args: never; Returns: undefined }
      invite_preview: {
        Args: { p_code: string }
        Returns: {
          icon_url: string | null
          is_member: boolean
          member_count: number
          name: string
          server_id: string
        }[]
      }
      join_server: { Args: { p_code: string }; Returns: string }
      kick_member: {
        Args: { p_member: string; p_ban?: boolean; p_reason?: string }
        Returns: undefined
      }
      leave_server: { Args: { p_server: string }; Returns: undefined }
      open_dm: { Args: { p_other: string }; Returns: string }
      regenerate_invite: { Args: { p_server: string }; Returns: string }
      remove_friend: { Args: { p_other: string }; Returns: undefined }
      send_friend_request: { Args: { p_username: string }; Returns: string }
      set_member_role: {
        Args: { p_member: string; p_role: Database['public']['Enums']['member_role'] }
        Returns: undefined
      }
      set_nickname: { Args: { p_nickname: string; p_server: string }; Returns: undefined }
      unban_member: { Args: { p_profile: string; p_server: string }; Returns: undefined }
      unblock_user: { Args: { p_other: string }; Returns: undefined }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      channel_type: 'text' | 'voice'
      friendship_status: 'pending' | 'accepted'
      member_role: 'admin' | 'moderator' | 'guest'
      user_status: 'online' | 'idle' | 'dnd' | 'invisible'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
