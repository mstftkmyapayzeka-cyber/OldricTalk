// Ses kanalı için LiveKit erişim anahtarı üretir.
// Kimlik Supabase oturumuyla doğrulanır; kanal, kullanıcının kendi yetkisiyle (RLS)
// sorgulanır — yani yalnızca üyesi olduğu sunucunun ses kanallarına anahtar alır.
// LIVEKIT_API_SECRET istemciye asla gönderilmez.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignJWT } from 'npm:jose@6'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

const TOKEN_TTL_SECONDS = 6 * 60 * 60

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const livekitUrl = Deno.env.get('LIVEKIT_URL')
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
  if (!livekitUrl || !apiKey || !apiSecret) {
    return json({ error: 'not_configured', hint: 'Ses sunucusu henüz yapılandırılmadı.' }, 503)
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'not_authenticated' }, 401)

  let channelId: unknown
  try {
    channelId = (await req.json())?.channel_id
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (typeof channelId !== 'string' || !/^[0-9a-f-]{36}$/i.test(channelId)) {
    return json({ error: 'bad_request' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user) return json({ error: 'not_authenticated' }, 401)

  // RLS: üye değilse kanal satırı dönmez.
  const { data: channel } = await supabase
    .from('channels')
    .select('id, server_id, type')
    .eq('id', channelId)
    .maybeSingle()
  if (!channel || channel.type !== 'voice') {
    return json({ error: 'forbidden', hint: 'Bu ses kanalına erişimin yok.' }, 403)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single()

  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({
    name: profile?.display_name ?? 'Kullanıcı',
    metadata: JSON.stringify({
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      server_id: channel.server_id
    }),
    video: {
      room: channel.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(apiKey)
    .setSubject(user.id)
    .setJti(`${user.id}:${now}`)
    .setNotBefore(now - 10)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(apiSecret))

  return json({ token, url: livekitUrl })
})
