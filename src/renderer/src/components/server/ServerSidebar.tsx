import { NavLink, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  Hash,
  LogOut,
  Pencil,
  Plus,
  PlusCircle,
  Settings,
  Trash2,
  UserPlus,
  Users,
  Volume2
} from 'lucide-react'
import { markRead } from '@/lib/actions'
import { cn } from '@/lib/utils'
import type { Channel, ChannelType, Server } from '@/lib/types'
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

function ChannelRow({
  channel,
  unread,
  canManage
}: {
  channel: Channel
  unread: boolean
  canManage: boolean
}): React.JSX.Element {
  const open = useModal((s) => s.open)
  const qc = useQueryClient()
  const me = useUserId()
  const Icon = channel.type === 'text' ? Hash : Volume2

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <NavLink
          to={`/channels/${channel.server_id}/${channel.id}`}
          className={({ isActive }) =>
            cn(
              'group relative flex h-8 items-center gap-1.5 rounded-md px-2',
              isActive
                ? 'bg-selected text-header'
                : unread
                  ? 'text-header hover:bg-hover'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
            )
          }
        >
          {unread && <span className="absolute -left-2 h-2 w-1 rounded-r-full bg-header" />}
          <Icon className="h-5 w-5 shrink-0 opacity-70" />
          <span className={cn('flex-1 truncate', unread && 'font-semibold')}>{channel.name}</span>
          {canManage && (
            <Tooltip label="Kanalı Düzenle">
              <span
                role="button"
                onClick={(e) => {
                  e.preventDefault()
                  open({ type: 'editChannel', channel })
                }}
                className="hidden text-muted-foreground hover:text-header group-hover:block"
              >
                <Settings className="h-4 w-4" />
              </span>
            </Tooltip>
          )}
        </NavLink>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {channel.type === 'text' && (
          <ContextMenuItem onSelect={() => void markRead(qc, me, channel.id)}>
            Okundu olarak işaretle
          </ContextMenuItem>
        )}
        {canManage && (
          <>
            <ContextMenuItem onSelect={() => open({ type: 'editChannel', channel })}>
              <Pencil className="h-4 w-4" /> Kanalı düzenle
            </ContextMenuItem>
            <ContextMenuItem danger onSelect={() => open({ type: 'deleteChannel', channel })}>
              <Trash2 className="h-4 w-4" /> Kanalı sil
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(channel.id)}>
          Kanal kimliğini kopyala
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Section({
  label,
  type,
  server,
  canManage,
  children
}: {
  label: string
  type: ChannelType
  server: Server
  canManage: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const open = useModal((s) => s.open)
  return (
    <div className="pt-4">
      <div className="group flex items-center px-0.5 pb-1">
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground">
          {label}
        </span>
        {canManage && (
          <Tooltip label="Kanal Oluştur">
            <button
              onClick={() => open({ type: 'createChannel', server, channelType: type })}
              className="text-muted-foreground hover:text-header"
            >
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
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
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-12 shrink-0 items-center border-b border-black/30 px-4 font-semibold text-header shadow-sm transition hover:bg-hover focus:outline-none">
            <span className="flex-1 truncate text-left">{server.name}</span>
            <ChevronDown className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[220px]" align="center">
          <DropdownMenuItem
            className="text-[hsl(255_100%_80%)]"
            onSelect={() => open({ type: 'invite', server })}
          >
            <UserPlus className="h-4 w-4" /> İnsanları Davet Et
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onSelect={() => open({ type: 'editServer', server })}>
              <Settings className="h-4 w-4" /> Sunucu Ayarları
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuItem onSelect={() => open({ type: 'members', server })}>
              <Users className="h-4 w-4" /> Üyeleri Yönet
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuItem onSelect={() => open({ type: 'createChannel', server })}>
              <PlusCircle className="h-4 w-4" /> Kanal Oluştur
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isOwner ? (
            <DropdownMenuItem danger onSelect={() => open({ type: 'deleteServer', server })}>
              <Trash2 className="h-4 w-4" /> Sunucuyu Sil
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem danger onSelect={() => open({ type: 'leaveServer', server })}>
              <LogOut className="h-4 w-4" /> Sunucudan Ayrıl
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-4">
        <Section label="Metin Kanalları" type="text" server={server} canManage={isModerator}>
          {text.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              unread={channelUnread.has(c.id) && c.id !== channelId}
              canManage={isModerator}
            />
          ))}
        </Section>
        <Section label="Ses Kanalları" type="voice" server={server} canManage={isModerator}>
          {voice.map((c) => (
            <ChannelRow key={c.id} channel={c} unread={false} canManage={isModerator} />
          ))}
        </Section>
      </div>
      <UserPanel />
    </aside>
  )
}
