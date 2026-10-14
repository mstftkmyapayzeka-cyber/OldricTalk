import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { qk } from '@/hooks/queries'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export default function InvitePage(): React.JSX.Element {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preview = useQuery({
    queryKey: ['invite', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invite_preview', { p_code: code })
      if (error) throw error
      return data[0] ?? null
    }
  })

  if (preview.isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-chat">
        <Spinner />
      </div>
    )
  }
  const s = preview.data
  if (s?.is_member) return <Navigate to={`/channels/${s.server_id}`} replace />

  async function join(): Promise<void> {
    setBusy(true)
    const { data, error } = await supabase.rpc('join_server', { p_code: code })
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: qk.servers })
    await qc.invalidateQueries({ queryKey: ['channels', 'all'] })
    navigate(`/channels/${data}`)
  }

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-chat">
      <div className="w-[420px] rounded-lg bg-sidebar p-8 text-center shadow-xl">
        {s ? (
          <>
            <Avatar src={s.icon_url} name={s.name} seed={s.server_id} size={72} className="mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Bir sunucuya katılmaya davet edildin</p>
            <h1 className="mt-1 text-2xl font-bold text-header">{s.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{s.member_count} üye</p>
            {error && <p className="mt-3 text-sm text-dnd">{error}</p>}
            <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={() => void join()}>
              Daveti Kabul Et
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-header">Davet geçersiz</h1>
            <p className="mt-2 text-muted-foreground">Bu davetin süresi dolmuş ya da hiç var olmamış olabilir.</p>
          </>
        )}
        <Button variant="link" className="mt-3" onClick={() => navigate('/channels/@me')}>
          Ana sayfaya dön
        </Button>
      </div>
    </div>
  )
}
