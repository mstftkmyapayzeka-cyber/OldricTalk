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
import { useVoiceRoster, type VoiceMember } from '@/stores/voiceRoster'

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
    case 'presence_changed':
      onPresenceChanged((payload as { user_id: string }).user_id, serverId)
      return
  }
}

/** Biri çevrimiçi/çevrimdışı oldu ya da profilini değiştirdi. */
function onPresenceChanged(userId: string, serverId?: string): void {
  if (!ctx) return
  const { qc } = ctx
  void qc.invalidateQueries({ queryKey: qk.profile(userId) })
  if (serverId) {
    void qc.invalidateQueries({ queryKey: qk.members(serverId) })
  } else {
    void qc.invalidateQueries({ queryKey: qk.friendships })
    void qc.invalidateQueries({ queryKey: qk.conversations })
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
    case 'presence_changed':
      onPresenceChanged((payload as { user_id: string }).user_id)
      return
  }
}

function onTyping(p: TypingPayload): void {
  if (!ctx || p.user_id === ctx.me) return
  if (p.stop) useTyping.getState().remove(p.target_id, p.user_id)
  else useTyping.getState().add(p.target_id, p.user_id, p.name)
}

// ---------------------------------------------------------------- ses varlığı (presence)
// Ses kanalındaki kişiler sunucu konusunda presence ile yayılır: bağlanmamış üyeler de
// kanalda kimlerin olduğunu görür; uygulama kapanınca kayıt kendiliğinden düşer.
let voicePresence: { serverId: string; meta: VoiceMember } | null = null

function syncRoster(serverId: string, ch: RealtimeChannel): void {
  const state = ch.presenceState<VoiceMember>()
  const members = Object.values(state)
    .map((metas) => metas[metas.length - 1])
    .filter((m): m is VoiceMember & { presence_ref: string } => !!m?.channel_id)
  useVoiceRoster.getState().setServer(serverId, members)
}

export function setVoicePresence(serverId: string | null, meta: VoiceMember | null): void {
  const prev = voicePresence
  voicePresence = serverId && meta ? { serverId, meta } : null
  if (prev && prev.serverId !== serverId) {
    const old = channels.get(`server:${prev.serverId}`)
    if (old?.state === 'joined') void old.untrack()
  }
  if (voicePresence) {
    const ch = channels.get(`server:${voicePresence.serverId}`)
    if (ch?.state === 'joined') void ch.track(voicePresence.meta)
  }
}

function subscribe(topic: string, handler: (event: string, payload: unknown) => void): void {
  if (channels.has(topic)) return
  const serverId = topic.startsWith('server:') ? topic.slice('server:'.length) : null
  const ch = supabase.channel(topic, {
    config: { private: true, broadcast: { self: false }, presence: { key: ctx?.me ?? '' } }
  })
  ch.on('broadcast', { event: '*' }, (msg) => handler(msg.event, msg.payload))
  if (serverId) ch.on('presence', { event: 'sync' }, () => syncRoster(serverId, ch))
  ch.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[realtime] ${topic}: ${status}`, err?.message ?? '')
    } else {
      console.debug(`[realtime] ${topic}: ${status}`)
    }
    // Yeniden bağlanınca ses varlığı tekrar yayınlanır.
    if (status === 'SUBSCRIBED' && serverId && voicePresence?.serverId === serverId) {
      void ch.track(voicePresence.meta)
    }
  })
  channels.set(topic, ch)
}

function unsubscribe(topic: string): void {
  const ch = channels.get(topic)
  if (!ch) return
  channels.delete(topic)
  if (topic.startsWith('server:')) useVoiceRoster.getState().clearServer(topic.slice('server:'.length))
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
