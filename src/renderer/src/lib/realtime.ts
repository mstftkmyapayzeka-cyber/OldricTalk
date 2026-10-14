// Gerçek zamanlı bağlantı yöneticisi. Konular (özel broadcast kanalları):
//   user:<ben>     → DM mesajları, arkadaşlık, üyelik, yeni konuşma
//   server:<id>    → kanal mesajları, yapı değişiklikleri, yazıyor göstergesi
//   dm:<id>        → DM yazıyor göstergesi (yalnızca konuşma açıkken)
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { markRead } from './actions'
import { markReadLocal, upsertMessage } from './cache'
import { mentions } from './markdown'
import { notify, previewText } from './notify'
import type { Channel, ChatMessage, Conversation, Profile } from './types'
import { qk } from '@/hooks/queries'
import { useActiveTarget } from '@/stores/active'
import { useTyping } from '@/stores/typing'

type Ctx = {
  qc: QueryClient
  me: string
  navigate: (path: string) => void
}

type TypingPayload = { target_id: string; user_id: string; name: string; stop?: boolean }
type StructurePayload = { table: string; op: string; id: string; server_id: string }
type FriendshipPayload = { op: string; requester_id: string; addressee_id: string; status: string }

let ctx: Ctx | null = null
const channels = new Map<string, RealtimeChannel>()
// Özel kanallara katılmadan önce oturum anahtarı realtime istemcisine verilmiş olmalı.
let authReady: Promise<void> = Promise.resolve()
// Son istenen sunucu listesi; bağlantı yeniden başlarsa tekrar uygulanır.
let wantedServers: string[] = []

function myProfile(): Profile | undefined {
  return ctx ? ctx.qc.getQueryData<Profile>(qk.profile(ctx.me)) : undefined
}

function isViewing(targetId: string): boolean {
  return useActiveTarget.getState().targetId === targetId && document.hasFocus()
}

function canNotify(): boolean {
  return myProfile()?.status !== 'dnd'
}

function touchChannel(qc: QueryClient, msg: ChatMessage): void {
  const patch = <T extends Pick<Channel, 'id' | 'last_message_at'>>(list?: T[]): T[] | undefined =>
    list?.map((c) => (c.id === msg.channel_id ? { ...c, last_message_at: msg.created_at } : c))
  qc.setQueryData(['channels', 'all'], patch)
  qc.setQueryData(qk.channels(serverOf(qc, msg.channel_id!) ?? ''), patch)
}

function serverOf(qc: QueryClient, channelId: string): string | undefined {
  const all = qc.getQueryData<Pick<Channel, 'id' | 'server_id'>[]>(['channels', 'all'])
  return all?.find((c) => c.id === channelId)?.server_id
}

function onServerEvent(serverId: string, event: string, payload: unknown): void {
  if (!ctx) return
  const { qc, me } = ctx
  switch (event) {
    case 'message_created':
    case 'message_updated': {
      const msg = payload as ChatMessage
      const target = msg.channel_id!
      upsertMessage(qc, target, msg)
      if (event === 'message_updated') return
      useTyping.getState().remove(target, msg.author_id)
      touchChannel(qc, msg)
      if (msg.author_id === me) {
        markReadLocal(qc, target, msg.created_at)
      } else if (isViewing(target)) {
        void markRead(qc, me, target)
      } else {
        const username = myProfile()?.username
        if (username && mentions(msg.content, username) && canNotify()) {
          const ch = qc
            .getQueryData<Channel[]>(qk.channels(serverId))
            ?.find((c) => c.id === target)
          notify({
            title: `${msg.author?.display_name ?? 'Biri'}${ch ? ` (#${ch.name})` : ''}`,
            body: previewText(msg.content, msg.file_name),
            icon: msg.author?.avatar_url,
            onClick: () => ctx?.navigate(`/channels/${serverId}/${target}`)
          })
        }
      }
      return
    }
    case 'structure_changed': {
      const p = payload as StructurePayload
      if (p.table === 'servers') {
        void qc.invalidateQueries({ queryKey: qk.servers })
        void qc.invalidateQueries({ queryKey: qk.server(p.server_id) })
      } else if (p.table === 'channels') {
        void qc.invalidateQueries({ queryKey: qk.channels(p.server_id) })
        void qc.invalidateQueries({ queryKey: ['channels', 'all'] })
      } else if (p.table === 'members') {
        void qc.invalidateQueries({ queryKey: qk.members(p.server_id) })
      }
      return
    }
    case 'typing':
      onTyping(payload as TypingPayload)
      return
  }
}

function onUserEvent(event: string, payload: unknown): void {
  if (!ctx) return
  const { qc, me } = ctx
  switch (event) {
    case 'dm_message_created':
    case 'dm_message_updated': {
      const msg = payload as ChatMessage
      const target = msg.conversation_id!
      upsertMessage(qc, target, msg)
      if (event === 'dm_message_updated') return
      useTyping.getState().remove(target, msg.author_id)
      const known = qc
        .getQueryData<Conversation[]>(qk.conversations)
        ?.some((c) => c.id === target)
      if (known) {
        qc.setQueryData<Conversation[]>(qk.conversations, (list) =>
          list
            ?.map((c) => (c.id === target ? { ...c, last_message_at: msg.created_at } : c))
            .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
        )
      } else {
        void qc.invalidateQueries({ queryKey: qk.conversations })
      }
      if (msg.author_id === me) {
        markReadLocal(qc, target, msg.created_at)
      } else if (isViewing(target)) {
        void markRead(qc, me, target)
      } else if (canNotify()) {
        notify({
          title: msg.author?.display_name ?? 'Yeni mesaj',
          body: previewText(msg.content, msg.file_name),
          icon: msg.author?.avatar_url,
          onClick: () => ctx?.navigate(`/channels/@me/${target}`)
        })
      }
      return
    }
    case 'friendship_changed': {
      const p = payload as FriendshipPayload
      void qc.invalidateQueries({ queryKey: qk.friendships })
      if (p.op === 'INSERT' && p.addressee_id === me && canNotify()) {
        notify({
          title: 'Yeni arkadaşlık isteği',
          body: 'Bekleyen isteklerinize göz atın.',
          onClick: () => ctx?.navigate('/channels/@me?tab=pending')
        })
      }
      return
    }
    case 'membership_changed':
      void qc.invalidateQueries({ queryKey: qk.servers })
      void qc.invalidateQueries({ queryKey: ['channels', 'all'] })
      return
    case 'conversation_added':
      void qc.invalidateQueries({ queryKey: qk.conversations })
      return
  }
}

function onTyping(p: TypingPayload): void {
  if (!ctx || p.user_id === ctx.me) return
  if (p.stop) useTyping.getState().remove(p.target_id, p.user_id)
  else useTyping.getState().add(p.target_id, p.user_id, p.name)
}

function subscribe(topic: string, handler: (event: string, payload: unknown) => void): void {
  if (channels.has(topic)) return
  const ch = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } })
  ch.on('broadcast', { event: '*' }, (msg) => handler(msg.event, msg.payload))
  ch.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[realtime] ${topic}: ${status}`, err?.message ?? '')
    } else {
      console.debug(`[realtime] ${topic}: ${status}`)
    }
  })
  channels.set(topic, ch)
}

function unsubscribe(topic: string): void {
  const ch = channels.get(topic)
  if (!ch) return
  channels.delete(topic)
  void supabase.removeChannel(ch)
}

export function startRealtime(next: Ctx): void {
  ctx = next
  authReady = supabase.auth.getSession().then(async ({ data }) => {
    await supabase.realtime.setAuth(data.session?.access_token ?? null)
  })
  void authReady.then(() => {
    if (ctx !== next) return
    subscribe(`user:${next.me}`, onUserEvent)
    applyServerTopics(wantedServers)
  })
}

export function stopRealtime(): void {
  for (const topic of [...channels.keys()]) unsubscribe(topic)
  ctx = null
}

/** Üye olunan sunucuların konularına abone olur, ayrılınanlardan çıkar. */
export function syncServerTopics(serverIds: string[]): void {
  wantedServers = serverIds
  void authReady.then(() => {
    if (ctx) applyServerTopics(serverIds)
  })
}

function applyServerTopics(serverIds: string[]): void {
  const wanted = new Set(serverIds.map((id) => `server:${id}`))
  for (const topic of channels.keys()) {
    if (topic.startsWith('server:') && !wanted.has(topic)) unsubscribe(topic)
  }
  for (const topic of wanted) {
    const serverId = topic.slice('server:'.length)
    subscribe(topic, (event, payload) => onServerEvent(serverId, event, payload))
  }
}

/** Açık DM için yazıyor göstergesi konusuna abone olur; dönüş aboneliği kapatır. */
export function watchDm(conversationId: string): () => void {
  const topic = `dm:${conversationId}`
  let active = true
  void authReady.then(() => {
    if (!active) return
    subscribe(topic, (event, payload) => {
      if (event === 'typing') onTyping(payload as TypingPayload)
    })
  })
  return () => {
    active = false
    unsubscribe(topic)
  }
}

export function sendTyping(topic: string, payload: TypingPayload): void {
  // Katılım tamamlanmadıysa gösterge önemsiz; REST'e düşürmeden atla.
  const ch = channels.get(topic)
  if (ch?.state === 'joined') void ch.send({ type: 'broadcast', event: 'typing', payload })
}
