import { NavLink, useMatch, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  Copy,
  DoorOpen,
  Hash,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
  Volume2
} from 'lucide-react'
import { markRead } from '@/lib/actions'
import { joinVoice } from '@/lib/voice'
import VoiceChannelMembers from '@/components/voice/VoiceChannelMembers'
import type { Channel, Server } from '@/lib/types'
import { useChannels } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useUnread } from '@/hooks/useUnread'
import { useUserId } from '@/stores/auth'
import { useModal } from '@/stores/modal'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import UserPanel from '@/components/layout/UserPanel'
import { Category, rowClass, Sidebar, SidebarHead, UnreadBar } from '@/components/layout/parts'

function ChannelRow({
  channel,
  serverName,
  unread,
  canManage
}: {
  channel: Channel
  serverName: string
  unread: boolean
  canManage: boolean
}): React.JSX.Element {
  const open = useModal((s) => s.open)
  const qc = useQueryClient()
  const me = useUserId()
  const Icon = channel.type === 'text' ? Hash : Volume2
  const to = `/channels/${channel.server_id}/${channel.id}`
  // ContextMenuTrigger (Radix Slot) className'i metin olarak birleştirir;
  // NavLink'in fonksiyon className'i orada bozulur, bu yüzden etkinliği burada hesaplıyoruz.
  const isActive = useMatch(to) !== null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <NavLink
          to={to}
          // Ses kanalına tıklamak doğrudan bağlanır (Discord davranışı).
          onClick={() => {
            if (channel.type === 'voice') void joinVoice(channel, serverName)
          }}
          className={rowClass({ active: isActive, unread, className: 'h-row' })}
        >
          {unread && <UnreadBar />}
          <Icon
            className={
              isActive || unread ? 'h-[17px] w-[17px] shrink-0 text-text' : 'h-[17px] w-[17px] shrink-0 text-text-muted'
            }
          />
          <span className="min-w-0 flex-1 truncate">{channel.name}</span>
          {canManage && (
            <Tooltip label="Kanalı Düzenle">
              <span
                role="button"
                aria-label="Kanalı Düzenle"
                onClick={(e) => {
                  e.preventDefault()
                  open({ type: 'editChannel', channel })
                }}
                className="hidden shrink-0 text-text-muted hover:text-header group-hover:block"
              >
                <Settings className="h-3.5 w-3.5" />
              </span>
            </Tooltip>
          )}
        </NavLink>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {channel.type === 'text' && (
          <ContextMenuItem onSelect={() => void markRead(qc, me, channel.id)}>
            <Check /> Okundu olarak işaretle
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(channel.id)}>
          <Copy /> Kanal kimliğini kopyala
        </ContextMenuItem>
        {canManage && (
          <>
            <ContextMenuItem onSelect={() => open({ type: 'editChannel', channel })}>
              <Pencil /> Kanalı düzenle
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem danger onSelect={() => open({ type: 'deleteChannel', channel })}>
              <Trash2 /> Kanalı sil
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default function ServerSidebar({ server }: { server: Server }): React.JSX.Element {
  const { channelId } = useParams()
  const { data: channels = [] } = useChannels(server.id)
  const { isAdmin, isModerator } = useMembership(server.id)
  const { channelUnread } = useUnread()
  const open = useModal((s) => s.open)
  const me = useUserId()
  const isOwner = server.owner_id === me

  const text = channels.filter((c) => c.type === 'text')
  const voice = channels.filter((c) => c.type === 'voice')

  return (
    <Sidebar>
      <SidebarHead>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full min-w-0 items-center gap-1 rounded-sm p-1 text-left text-[15px] font-bold leading-5 text-header transition-colors duration-fast hover:bg-hover data-[state=open]:bg-hover">
              <span className="min-w-0 flex-1 truncate">{server.name}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[236px]" align="start" sideOffset={8}>
            <DropdownMenuItem onSelect={() => open({ type: 'invite', server })}>
              <UserPlus /> İnsanları Davet Et
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => open({ type: 'editServer', server })}>
                <Settings /> Sunucu Ayarları
              </DropdownMenuItem>
            )}
            {isModerator && (
              <DropdownMenuItem onSelect={() => open({ type: 'createChannel', server })}>
                <Plus /> Kanal Oluştur
              </DropdownMenuItem>
            )}
            {isModerator && (
              <DropdownMenuItem onSelect={() => open({ type: 'members', server })}>
                <Users /> Üyeleri Yönet
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isOwner ? (
              <DropdownMenuItem danger onSelect={() => open({ type: 'deleteServer', server })}>
                <Trash2 /> Sunucuyu Sil
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem danger onSelect={() => open({ type: 'leaveServer', server })}>
                <DoorOpen /> Sunucudan Ayrıl
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHead>

      <nav aria-label="Kanallar" className="thin-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
        <Category
          label="Metin Kanalları"
          addLabel={isModerator ? 'Kanal Oluştur' : undefined}
          onAdd={() => open({ type: 'createChannel', server, channelType: 'text' })}
        />
        {text.map((c) => (
          <ChannelRow
            key={c.id}
            channel={c}
            serverName={server.name}
            unread={channelUnread.has(c.id) && c.id !== channelId}
            canManage={isModerator}
          />
        ))}
        <Category
          label="Ses Kanalları"
          addLabel={isModerator ? 'Kanal Oluştur' : undefined}
          onAdd={() => open({ type: 'createChannel', server, channelType: 'voice' })}
        />
        {voice.map((c) => (
          <div key={c.id}>
            <ChannelRow channel={c} serverName={server.name} unread={false} canManage={isModerator} />
            <VoiceChannelMembers serverId={server.id} channelId={c.id} />
          </div>
        ))}
      </nav>
      <UserPanel />
    </Sidebar>
  )
}
