// Supabase proje adresi ve yayınlanabilir anahtar. Bu anahtar istemcide bulunmak
// üzere tasarlanmıştır; erişimi RLS kuralları belirler.
export const SUPABASE_URL = 'https://nandcazkmsfnceneguux.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NM_pxHTn0-6OmyTN1zLWqw_8uFBFw2A'

export const STORAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`

export const LIMITS = {
  messageLength: 4000,
  attachmentBytes: 10 * 1024 * 1024,
  avatarBytes: 2 * 1024 * 1024,
  pageSize: 50
} as const
