import { HeadphoneOff, MicOff } from 'lucide-react'
import { useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { useChannelVoiceMembers } from '@/stores/voiceRoster'
import { Avatar } from '@/components/ui/avatar'

/** Kenar çubuğunda ses kanalının altındaki kişi listesi. */
export default function VoiceChannelMembers({
  serverId,
  channelId
}: {
  serverId: string
  channelId: string
}): React.JSX.Element | null {
  const members = useChannelVoiceMembers(serverId, channelId)
  const speaking = useVoice((s) => (s.channelId === channelId ? s.speaking : null))
  if (members.length === 0) return null

  return (
    <div className="space-y-0.5 pb-1 pl-8">
      {members.map((m) => {
        const talking = !!speaking?.includes(m.user_id) && !m.muted
        return (
          <div
            key={m.user_id}
            className="flex h-7 items-center gap-2 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            <span className={cn('rounded-full ring-2', talking ? 'ring-online' : 'ring-transparent')}>
              <Avatar src={m.avatar_url} name={m.name} seed={m.user_id} size={22} />
            </span>
            <span className={cn('flex-1 truncate', talking && 'text-header')}>{m.name}</span>
            {m.deafened ? (
              <HeadphoneOff className="h-3.5 w-3.5 text-dnd" />
            ) : (
              m.muted && <MicOff className="h-3.5 w-3.5 text-dnd" />
            )}
          </div>
        )
      })}
    </div>
  )
}
