import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { colorFor, initials } from '@/lib/utils'
import { qk } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import AuthBackdrop, { AuthCard } from '@/components/layout/AuthBackdrop'

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
        <Spinner size="md" />
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

  // Geçersiz davette kart aynı yerde kalır; yalnızca içerik değişir.
  return (
    <AuthBackdrop className="flex-1">
      <AuthCard className="w-[420px] text-center">
        {s ? (
          <div className="flex flex-col items-center gap-4">
            {s.icon_url ? (
              <img src={s.icon_url} alt="" className="h-[72px] w-[72px] rounded-xl object-cover" />
            ) : (
              <span
                className="grid h-[72px] w-[72px] place-items-center rounded-xl text-[24px] font-bold text-on-avatar"
                style={{ background: colorFor(s.server_id) }}
              >
                {initials(s.name)}
              </span>
            )}
            <div className="flex flex-col items-center gap-1">
              <span className="text-meta text-text-muted">Bir sunucuya katılmaya davet edildin</span>
              <h1 className="text-title-lg text-header">{s.name}</h1>
              <span className="mt-1 text-meta text-text-muted">{s.member_count} üye</span>
            </div>
            {error && <ErrorBox className="w-full text-left">{error}</ErrorBox>}
            <Button className="mt-2 w-full" size="lg" variant="success" disabled={busy} onClick={() => void join()}>
              Daveti Kabul Et
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-dnd-soft text-dnd">
              <TriangleAlert className="h-8 w-8" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-title-lg text-header">Davet geçersiz</h1>
              <p className="max-w-[360px] text-label font-normal text-text-muted">
                Bu davetin süresi dolmuş ya da kaldırılmış olabilir. Sunucudaki bir arkadaşından yeni bir davet iste.
              </p>
            </div>
            {/* Tehlike düğmesi kullanılmaz: kullanıcı bir hata yapmadı. */}
            <Button className="mt-2 w-full" size="lg" variant="secondary" onClick={() => navigate('/channels/@me')}>
              Ana Sayfaya Dön
            </Button>
          </div>
        )}
      </AuthCard>
    </AuthBackdrop>
  )
}
