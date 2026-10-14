// Davet bağlantısı biçimi: oldrictalk://invite/<kod>. Kullanıcı kodu tek başına da
// yapıştırabilir; ikisi de aynı koda çözülür.

export const INVITE_SCHEME = 'oldrictalk://invite/'

export function inviteLink(code: string): string {
  return INVITE_SCHEME + code
}

export function parseInvite(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const m = /(?:invite|davet)\/([a-f0-9]{6,32})\/?$/i.exec(s) ?? /^([a-f0-9]{6,32})$/i.exec(s)
  return m ? m[1].toLowerCase() : null
}
