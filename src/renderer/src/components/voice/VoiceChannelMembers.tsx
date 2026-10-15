import { HeadphoneOff, MicOff } from 'lucide-react'
import { useVoice } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { useChannelVoiceMembers } from '@/stores/voiceRoster'
import { Avatar } from '@/components/ui/avatar'

/** Kenar çubuğunda ses kanalının altındaki kişi listesi: 20px avatar, konuşan online halka. */
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
    <div className="flex flex-col gap-px pb-1 pl-6" role="list" aria-label="Ses kanalındakiler">
      {members.map((m) => {
        const talking = !!speaking?.includes(m.user_id) && !m.muted
        return (
          <div
            key={m.user_id}
            role="listitem"
            className="flex h-7 items-center gap-2 rounded-sm px-2 text-label font-normal text-text-muted transition-colors duration-fast hover:bg-hover hover:text-text"
          >
            <Avatar src={m.avatar_url} name={m.name} seed={m.user_id} size={20} speaking={talking} />
            <span className={cn('min-w-0 flex-1 truncate', talking && 'text-header')}>{m.name}</span>
            {m.deafened ? (
              <HeadphoneOff className="h-3.5 w-3.5 shrink-0 text-dnd" aria-label="Sağırlaştırılmış" />
            ) : (
              m.muted && <MicOff className="h-3.5 w-3.5 shrink-0 text-dnd" aria-label="Sessizde" />
            )}
          </div>
        )
      })}
    </div>
  )
}
