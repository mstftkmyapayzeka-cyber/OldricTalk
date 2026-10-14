import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useChannels, useServer } from '@/hooks/queries'
import { Spinner } from '@/components/ui/spinner'
import ServerSidebar from '@/components/server/ServerSidebar'

export default function ServerLayout(): React.JSX.Element {
  const { serverId = '' } = useParams()
  const { data: server, isLoading } = useServer(serverId)

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-chat">
        <Spinner />
      </div>
    )
  }
  // Üye değilse (atıldı, sunucu silindi) RLS satırı döndürmez.
  if (!server) return <Navigate to="/channels/@me" replace />

  return (
    <>
      <ServerSidebar server={server} />
      <main className="flex min-w-0 flex-1 flex-col bg-chat">
        <Outlet />
      </main>
    </>
  )
}

/** /channels/:serverId → ilk metin kanalına yönlendir. */
export function ServerIndexRedirect(): React.JSX.Element {
  const { serverId = '' } = useParams()
  const { data: channels, isLoading } = useChannels(serverId)
  if (isLoading) return <div className="flex-1" />
  const first = channels?.find((c) => c.type === 'text') ?? channels?.[0]
  if (!first) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Bu sunucuda henüz kanal yok.
      </div>
    )
  }
  return <Navigate to={`/channels/${serverId}/${first.id}`} replace />
}
