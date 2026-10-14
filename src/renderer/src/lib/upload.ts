import { supabase } from './supabase'
import { LIMITS } from './config'
import { formatBytes } from './utils'

export type UploadedFile = { url: string; name: string; type: string }

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function safeName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-100)
  return cleaned || 'dosya'
}

/**
 * Dosyayı kullanıcının kendi klasörüne yükler (storage RLS bunu şart koşar)
 * ve herkese açık URL'yi döndürür.
 */
export async function uploadFile(
  bucket: 'avatars' | 'attachments',
  file: File,
  userId: string
): Promise<UploadedFile> {
  const limit = bucket === 'avatars' ? LIMITS.avatarBytes : LIMITS.attachmentBytes
  if (file.size > limit) {
    throw new Error(`Dosya çok büyük (en fazla ${formatBytes(limit)}).`)
  }
  if (bucket === 'avatars' && !IMAGE_TYPES.includes(file.type)) {
    throw new Error('Yalnızca PNG, JPEG, GIF ya da WEBP resim yüklenebilir.')
  }
  const path = `${userId}/${crypto.randomUUID()}/${safeName(file.name)}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, name: file.name.slice(0, 255), type: file.type }
}

export function isImage(type: string | null | undefined): boolean {
  return !!type && IMAGE_TYPES.includes(type)
}
