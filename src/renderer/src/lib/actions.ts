// Yazma işlemleri: mesaj gönderme/düzenleme/silme, okundu işareti.
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { ChatMessage, ChatTarget, ProfileLite } from './types'
import { markReadLocal, removePendingMessage, settleMessage, upsertMessage } from './cache'
import { qk } from '@/hooks/queries'
import type { UploadedFile } from './upload'

export async function sendMessage(
  qc: QueryClient,
  target: ChatTarget,
  me: ProfileLite,
  content: string,
  file?: UploadedFile
): Promise<void> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const base = {
    id,
    author_id: me.id,
    content,
    file_url: file?.url ?? null,
    file_name: file?.name ?? null,
    file_type: file?.type ?? null
  }
  // İyimser ekleme; gerçek zamanlı yankı aynı id ile gelip kaydı günceller.
  const optimistic: ChatMessage = {
    ...base,
    edited_at: null,
    deleted: false,
    created_at: now,
    author: me,
    pending: true,
    ...(target.kind === 'channel' ? { channel_id: target.id } : { conversation_id: target.id })
  }
  upsertMessage(qc, target.id, optimistic)
  const res =
    target.kind === 'channel'
      ? await supabase.from('messages').insert({ ...base, channel_id: target.id })
      : await supabase.from('direct_messages').insert({ ...base, conversation_id: target.id })
  if (res.error) {
    removePendingMessage(qc, target.id, id)
    throw res.error
  }
  settleMessage(qc, target.id, id)
  void markRead(qc, me.id, target.id)
}

export async function editMessage(
  target: ChatTarget,
  messageId: string,
  content: string
): Promise<void> {
  const res =
    target.kind === 'channel'
      ? await supabase.from('messages').update({ content }).eq('id', messageId)
      : await supabase.from('direct_messages').update({ content }).eq('id', messageId)
  if (res.error) throw res.error
}

export async function deleteMessage(target: ChatTarget, messageId: string): Promise<void> {
  const res =
    target.kind === 'channel'
      ? await supabase.rpc('delete_message', { p_message: messageId })
      : await supabase.rpc('delete_direct_message', { p_message: messageId })
  if (res.error) throw res.error
}

/** Hedefi şimdi okunmuş say. Yerel önbellek hemen, sunucu arka planda güncellenir. */
export async function markRead(qc: QueryClient, me: string, targetId: string): Promise<void> {
  const at = new Date().toISOString()
  markReadLocal(qc, targetId, at)
  await supabase
    .from('read_states')
    .upsert({ profile_id: me, target_id: targetId, last_read_at: at })
}

export async function rpc<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function invalidateServerData(qc: QueryClient, serverId: string): void {
  void qc.invalidateQueries({ queryKey: qk.server(serverId) })
  void qc.invalidateQueries({ queryKey: qk.channels(serverId) })
  void qc.invalidateQueries({ queryKey: qk.members(serverId) })
}
