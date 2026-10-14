import { useMemo } from 'react'
import type { MemberRole } from '@/lib/types'
import { useMembers } from './queries'
import { useUserId } from '@/stores/auth'

/** Sunucudaki kendi rolüm ve yazar → rol/takma ad eşlemesi. */
export function useMembership(serverId: string | undefined) {
  const me = useUserId()
  const members = useMembers(serverId)
  return useMemo(() => {
    const list = members.data ?? []
    const mine = list.find((m) => m.profile_id === me)
    const roles = new Map<string, { role: MemberRole; nickname: string | null }>(
      list.map((m) => [m.profile_id, { role: m.role, nickname: m.nickname }])
    )
    const role = mine?.role
    return {
      members: list,
      isLoading: members.isLoading,
      mine,
      role,
      isAdmin: role === 'admin',
      isModerator: role === 'admin' || role === 'moderator',
      roles
    }
  }, [members.data, members.isLoading, me])
}
