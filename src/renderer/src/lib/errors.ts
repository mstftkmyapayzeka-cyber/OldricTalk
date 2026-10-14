// Supabase hatalarını kullanıcıya gösterilecek Türkçe metne çevirir.
// RPC'ler anlamlı mesajı `hint` alanında taşır.

const KNOWN: Record<string, string> = {
  rate_limited: 'Çok hızlı mesaj gönderiyorsunuz, biraz yavaşlayın.',
  forbidden: 'Bu işlem için yetkiniz yok.',
  not_found: 'Kayıt bulunamadı.',
  not_authenticated: 'Oturumunuz sona erdi, yeniden giriş yapın.',
  invalid_invite: 'Davet geçersiz ya da süresi dolmuş.',
  owner_cannot_leave: 'Sunucu sahibi ayrılamaz; sunucuyu silebilir.',
  cannot_change_owner: 'Sunucu sahibinin rolü değiştirilemez.',
  self: 'Bu işlemi kendinize uygulayamazsınız.',
  'Invalid login credentials': 'E-posta ya da şifre hatalı.',
  'Email not confirmed': 'E-posta adresinizi henüz doğrulamadınız.',
  'User already registered': 'Bu e-posta ile zaten bir hesap var.',
  'Token has expired or is invalid': 'Kod geçersiz ya da süresi dolmuş.',
  'Failed to fetch': 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'
}

type ErrorLike = { message?: string; hint?: string | null; code?: string; status?: number }

export function errorMessage(err: unknown): string {
  if (!err) return 'Bilinmeyen hata.'
  const e = err as ErrorLike
  if (e.hint) return e.hint
  const msg = e.message ?? String(err)
  if (KNOWN[msg]) return KNOWN[msg]
  if (/password should be at least/i.test(msg)) return 'Şifre en az 8 karakter olmalı.'
  if (/rate limit/i.test(msg)) return 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.'
  if (/duplicate key|unique/i.test(msg)) return 'Bu değer zaten kullanılıyor.'
  if (/violates check constraint/i.test(msg)) return 'Girilen değer kurallara uymuyor.'
  if (/row-level security/i.test(msg)) return 'Bu işlem için yetkiniz yok.'
  return msg
}
