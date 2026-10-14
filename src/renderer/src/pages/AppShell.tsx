import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { HEARTBEAT_MS } from '@/lib/presence'
import { startRealtime, stopRealtime, syncServerTopics } from '@/lib/realtime'
import { leaveVoice, room, setVoiceIdentity, useVoice } from '@/lib/voice'
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react'
import { useMyProfile, useServers } from '@/hooks/queries'
import { useUnread } from '@/hooks/useUnread'
import { useUserId } from '@/stores/auth'
import { useTyping } from '@/stores/typing'
import { FullScreenLoader } from '@/components/ui/spinner'
import ServerRail from '@/components/layout/ServerRail'
import ModalHost from '@/components/modals/ModalHost'

export default function AppShell(): React.JSX.Element {
  const me = useUserId()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const profile = useMyProfile()
  const servers = useServers()
  const { dmUnread } = useUnread()
  const deafened = useVoice((s) => s.deafened)

  // navigate her gezinmede yeni kimlik alır; bağlantıyı yeniden kurmasın diye ref'te tutulur.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Gerçek zamanlı bağlantı oturum boyunca açık kalır.
  useEffect(() => {
    startRealtime({ qc, me, navigate: (path) => navigateRef.current(path) })
    return () => stopRealtime()
  }, [qc, me])

  useEffect(() => {
    if (servers.data) syncServerTopics(servers.data.map((s) => s.id))
  }, [servers.data])

  // Çevrimiçi durumu: düzenli heartbeat.
  useEffect(() => {
    // PostgREST sorguları tembeldir: then() çağrılmadan istek gitmez.
    const beat = (): void => void supabase.rpc('heartbeat').then(({ error }) => {
      if (error) console.warn('[heartbeat]', error.message)
    })
    beat()
    const t = setInterval(beat, HEARTBEAT_MS)
    // Pencere kapanırken çevrimdışı olduğunu yay (en iyi çaba; istek bitmeyebilir).
    const bye = (): void => void supabase.rpc('go_offline').then(() => undefined)
    window.addEventListener('beforeunload', bye)
    return () => {
      clearInterval(t)
      window.removeEventListener('beforeunload', bye)
    }
  }, [])

  // Yazıyor göstergelerinin süresi dolanları temizlenir.
  useEffect(() => {
    const t = setInterval(() => useTyping.getState().prune(), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // Ses varlığında görünen ad/avatar profil değişince güncellenir.
  useEffect(() => {
    if (profile.data) setVoiceIdentity(profile.data)
  }, [profile.data])

  // Oturum kapanınca sesten de çıkılır.
  useEffect(() => () => void leaveVoice(false), [])

  // Görev çubuğu rozeti: okunmamış DM sayısı.
  useEffect(() => {
    window.oldric?.setBadge(dmUnread.size)
  }, [dmUnread.size])

  if (profile.isLoading || servers.isLoading) return <FullScreenLoader label="Bağlanılıyor…" />
  if (profile.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Profil yüklenemedi.</p>
        <button className="text-brand hover:underline" onClick={() => void supabase.auth.signOut()}>
          Çıkış yap
        </button>
      </div>
    )
  }

  return (
    <RoomContext.Provider value={room}>
      <div className="flex h-full">
        <ServerRail />
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-tl-lg">
          <Outlet />
        </div>
        <ModalHost />
      </div>
      <RoomAudioRenderer muted={deafened} />
    </RoomContext.Provider>
  )
}
