// Ses sunucusu tanısı: test1 ile giriş yapar, üyesi olduğu ilk ses kanalı için
// cf-sfu üzerinden SFU oturumu açmayı dener; ardından yabancı bir kanalın
// reddedildiğini doğrular. Gizli değer yazdırmaz.
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

async function call(body) {
  const { data, error } = await c.functions.invoke('cf-sfu', { body })
  if (error) return { status: error.context?.status, body: await error.context?.json?.().catch(() => null) }
  return data
}

const own = await call({ action: 'session', channel_id: ch.id })
console.log('kendi ses kanalı:', ch.name, JSON.stringify({
  ok: !!own.sessionId,
  turn: Array.isArray(own.iceServers) && own.iceServers.some((s) => String(s.urls).includes('turn')),
  error: own.body ?? null
}))
if (own.sessionId) await call({ action: 'end', session_id: own.sessionId })
console.log('yabancı kanal  :', JSON.stringify(await call({ action: 'session', channel_id: crypto.randomUUID() })))
process.exit(0)
