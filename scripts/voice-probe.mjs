// Ses token tanısı: test1 ile giriş yapar, üyesi olduğu ilk ses kanalı için
// livekit-token fonksiyonunu çağırır ve sonucu (token'ı göstermeden) yazdırır.
// Ayrıca üyesi olmadığı rastgele bir kanal kimliğiyle reddedildiğini doğrular.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.test', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const c = createClient(
  'https://nandcazkmsfnceneguux.supabase.co',
  'sb_publishable_NM_pxHTn0-6OmyTN1zLWqw_8uFBFw2A',
  { auth: { persistSession: false } }
)
const { error: loginError } = await c.auth.signInWithPassword({
  email: env.OLDRIC_TEST1_EMAIL,
  password: env.OLDRIC_TEST1_PASSWORD
})
if (loginError) throw loginError

const { data: ch } = await c.from('channels').select('id, name').eq('type', 'voice').limit(1).single()

async function call(id) {
  const { data, error } = await c.functions.invoke('livekit-token', { body: { channel_id: id } })
  if (error) {
    const body = await error.context?.json?.().catch(() => null)
    return { status: error.context?.status, body }
  }
  const [, payload] = data.token.split('.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  return { ok: true, url: data.url, room: claims.video?.room, identity: claims.sub, name: claims.name }
}

console.log('kendi ses kanalı:', ch.name, JSON.stringify(await call(ch.id)))
console.log('yabancı kanal  :', JSON.stringify(await call(crypto.randomUUID())))
process.exit(0)
