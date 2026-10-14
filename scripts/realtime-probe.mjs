// Gerçek zamanlı tanı: test1 kendi user:<id> ve ilk sunucusunun konusuna abone olur,
// test2 aynı sunucuya yazıyor sinyali gönderir; gelen olaylar yazdırılır.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.test', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('='))
)
const URL = 'https://nandcazkmsfnceneguux.supabase.co'
const KEY = 'sb_publishable_NM_pxHTn0-6OmyTN1zLWqw_8uFBFw2A'

async function client(email, password) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  await c.realtime.setAuth(data.session.access_token)
  return { c, id: data.user.id }
}

const a = await client(env.OLDRIC_TEST1_EMAIL, env.OLDRIC_TEST1_PASSWORD)
const b = await client(env.OLDRIC_TEST2_EMAIL, env.OLDRIC_TEST2_PASSWORD)
const { data: servers } = await a.c.from('servers').select('id,name').order('created_at', { ascending: false }).limit(1)
const sid = servers[0].id
console.log('sunucu:', servers[0].name)

function sub(cl, topic, label) {
  return new Promise((resolve) => {
    const ch = cl.channel(topic, { config: { private: true } })
    ch.on('broadcast', { event: '*' }, (m) => console.log(`[${label}] olay ${m.event}`, JSON.stringify(m.payload).slice(0, 120)))
    ch.subscribe((status, err) => {
      console.log(`[${label}] ${topic} → ${status}`, err?.message ?? '')
      if (status !== 'CLOSED') resolve(ch)
    })
  })
}

await sub(a.c, `user:${a.id}`, 'A')
await sub(a.c, `server:${sid}`, 'A')
const bch = await sub(b.c, `server:${sid}`, 'B')
await new Promise((r) => setTimeout(r, 1000))

const res = await bch.send({ type: 'broadcast', event: 'typing', payload: { target_id: 'x', user_id: b.id, name: 'B' } })
console.log('B gönderim sonucu:', res)

const { data: ch } = await b.c.from('channels').select('id').eq('server_id', sid).eq('type', 'text').limit(1)
const ins = await b.c.from('messages').insert({ channel_id: ch[0].id, author_id: b.id, content: 'probe ' + Date.now() })
console.log('B mesaj ekleme:', ins.error?.message ?? 'ok')

await new Promise((r) => setTimeout(r, 4000))
process.exit(0)
