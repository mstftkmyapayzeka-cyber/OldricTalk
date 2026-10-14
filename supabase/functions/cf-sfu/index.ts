// Cloudflare Realtime SFU vekili. Uygulama Secret'ı yalnızca burada durur.
// Kurallar:
//  - Oturum yalnızca kullanıcının üyesi olduğu sunucunun ses kanalı için açılır (RLS).
//  - Kullanıcı yalnızca kendi SFU oturumunu yönetebilir.
//  - Uzak akış yalnızca AYNI ses kanalındaki bir oturumdan çekilebilir.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CF_API = 'https://rtc.live.cloudflare.com/v1'
const LOCAL_TRACKS = /^(mic|camera|screen|screen-audio)$/

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

type Sdp = { type: 'offer' | 'answer'; sdp: string }
type TrackIn = { location?: string; mid?: string; trackName?: string; sessionId?: string; kind?: string }

function cleanSdp(s: unknown): Sdp | undefined {
  const d = s as Sdp | undefined
  if (!d) return undefined
  if ((d.type !== 'offer' && d.type !== 'answer') || typeof d.sdp !== 'string' || d.sdp.length > 200_000) {
    throw new Error('bad_sdp')
  }
  return { type: d.type, sdp: d.sdp }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const appId = Deno.env.get('CF_SFU_APP_ID')
  const appSecret = Deno.env.get('CF_SFU_APP_SECRET')
  if (!appId || !appSecret) {
    return json({ error: 'not_configured', hint: 'Ses sunucusu henüz yapılandırılmadı.' }, 503)
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'not_authenticated' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false }
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  })

  const { data: userData } = await asUser.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return json({ error: 'not_authenticated' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const cf = async (method: string, path: string, payload?: unknown): Promise<Response> => {
    const res = await fetch(`${CF_API}/apps/${appId}${path}`, {
      method,
      headers: { Authorization: `Bearer ${appSecret}`, 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    })
    return new Response(await res.text(), {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  try {
    // ------------------------------------------------------------ yeni oturum
    if (body.action === 'session') {
      const channelId = String(body.channel_id ?? '')
      const { data: channel } = await asUser
        .from('channels')
        .select('id, type')
        .eq('id', channelId)
        .maybeSingle()
      if (!channel || channel.type !== 'voice') {
        return json({ error: 'forbidden', hint: 'Bu ses kanalına erişimin yok.' }, 403)
      }

      const res = await fetch(`${CF_API}/apps/${appId}/sessions/new`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${appSecret}` }
      })
      const created = await res.json()
      if (!res.ok || !created.sessionId) {
        return json({ error: 'sfu_error', hint: 'Ses sunucusunda oturum açılamadı.' }, 502)
      }
      // Kişi başına tek etkin oturum.
      await admin.from('voice_sessions').delete().eq('profile_id', user.id)
      const { error: insertError } = await admin.from('voice_sessions').insert({
        session_id: created.sessionId,
        profile_id: user.id,
        channel_id: channel.id
      })
      if (insertError) throw insertError

      let iceServers: unknown = [{ urls: 'stun:stun.cloudflare.com:3478' }]
      const turnKey = Deno.env.get('CF_TURN_KEY_ID')
      const turnToken = Deno.env.get('CF_TURN_KEY_TOKEN')
      if (turnKey && turnToken) {
        const turn = await fetch(
          `${CF_API}/turn/keys/${turnKey}/credentials/generate-ice-servers`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${turnToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 86400 })
          }
        )
        if (turn.ok) iceServers = (await turn.json()).iceServers ?? iceServers
      }
      return json({ sessionId: created.sessionId, iceServers })
    }

    // ------------------------------------------------------------ oturum işlemleri
    const sessionId = String(body.session_id ?? '')
    const { data: own } = await admin
      .from('voice_sessions')
      .select('session_id, channel_id')
      .eq('session_id', sessionId)
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!own) return json({ error: 'forbidden' }, 403)

    if (body.action === 'tracks') {
      const tracks = (Array.isArray(body.tracks) ? body.tracks : []) as TrackIn[]
      if (tracks.length === 0 || tracks.length > 16) return json({ error: 'bad_request' }, 400)
      const remote = tracks[0].location === 'remote'
      if (tracks.some((t) => (t.location === 'remote') !== remote)) {
        return json({ error: 'bad_request' }, 400)
      }
      if (remote) {
        const ids = [...new Set(tracks.map((t) => String(t.sessionId ?? '')))]
        const { data: peers } = await admin
          .from('voice_sessions')
          .select('session_id')
          .in('session_id', ids)
          .eq('channel_id', own.channel_id)
        if ((peers?.length ?? 0) !== ids.length) return json({ error: 'forbidden' }, 403)
      } else if (tracks.some((t) => !LOCAL_TRACKS.test(String(t.trackName)) || !t.mid)) {
        return json({ error: 'bad_request' }, 400)
      }
      return cf('POST', `/sessions/${sessionId}/tracks/new`, {
        sessionDescription: cleanSdp(body.sessionDescription),
        tracks: tracks.map((t) =>
          remote
            ? { location: 'remote', sessionId: String(t.sessionId), trackName: String(t.trackName) }
            : { location: 'local', mid: String(t.mid), trackName: String(t.trackName) }
        )
      })
    }

    if (body.action === 'renegotiate') {
      return cf('PUT', `/sessions/${sessionId}/renegotiate`, {
        sessionDescription: cleanSdp(body.sessionDescription)
      })
    }

    if (body.action === 'close') {
      const mids = (Array.isArray(body.mids) ? body.mids : []).map(String).filter(Boolean)
      if (mids.length === 0) return json({ error: 'bad_request' }, 400)
      const sdp = cleanSdp(body.sessionDescription)
      return cf('PUT', `/sessions/${sessionId}/tracks/close`, {
        tracks: mids.map((mid: string) => ({ mid })),
        sessionDescription: sdp,
        force: !sdp
      })
    }

    if (body.action === 'end') {
      await admin.from('voice_sessions').delete().eq('session_id', sessionId)
      return json({ ok: true })
    }

    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    return json({ error: 'bad_request', detail: String((e as Error).message ?? e) }, 400)
  }
})
