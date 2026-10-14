import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Copy, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { inviteLink, parseInvite } from '@/lib/invite'
import { uploadFile } from '@/lib/upload'
import type { Server } from '@/lib/types'
import { qk, useMyProfile } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useUserId } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm'
import { Field, Input } from '@/components/ui/input'
import ImagePicker from './ImagePicker'

type ModalProps = { onClose: () => void }

// ---------------------------------------------------------------- sunucu ekle
export function AddServerModal({ onClose }: ModalProps): React.JSX.Element {
  const [view, setView] = useState<'choose' | 'create' | 'join'>('choose')
  const { data: me } = useMyProfile()
  const meId = useUserId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState(me ? `${me.display_name} sunucusu` : '')
  const [icon, setIcon] = useState<File | null>(null)
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const iconUrl = icon ? (await uploadFile('avatars', icon, meId)).url : undefined
      const { data, error } = await supabase.rpc('create_server', {
        p_name: name.trim(),
        p_icon_url: iconUrl
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: qk.servers })
      await qc.invalidateQueries({ queryKey: ['channels', 'all'] })
      onClose()
      navigate(`/channels/${data}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function join(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const code = parseInvite(invite)
    if (!code) {
      setError('Geçerli bir davet bağlantısı ya da kodu girin.')
      return
    }
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_server', { p_code: code })
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: qk.servers })
    await qc.invalidateQueries({ queryKey: ['channels', 'all'] })
    onClose()
    navigate(`/channels/${data}`)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {view === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>Sunucunu oluştur</DialogTitle>
              <DialogDescription>
                Sunucun, sen ve arkadaşlarının takıldığı yerdir. Kendi sunucunu oluştur ve
                konuşmaya başla.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <button
                onClick={() => setView('create')}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left font-semibold text-header hover:bg-hover"
              >
                <span className="text-2xl">🏰</span>
                <span className="flex-1">Kendi sunucumu oluştur</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </DialogBody>
            <DialogFooter className="flex-col items-stretch gap-2 text-center">
              <p className="text-lg font-semibold text-header">Zaten bir davetin var mı?</p>
              <Button variant="secondary" onClick={() => setView('join')}>
                Bir Sunucuya Katıl
              </Button>
            </DialogFooter>
          </>
        )}

        {view === 'create' && (
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>Sunucunu özelleştir</DialogTitle>
              <DialogDescription>
                Yeni sunucuna bir ad ve simge vererek ona kişilik kazandır. Bunları daha sonra
                değiştirebilirsin.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ImagePicker file={icon} onPick={setIcon} />
              <Field label="Sunucu adı" error={error}>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
              </Field>
            </DialogBody>
            <DialogFooter className="justify-between">
              <Button type="button" variant="link" className="text-foreground" onClick={() => setView('choose')}>
                Geri
              </Button>
              <Button type="submit" disabled={busy || name.trim().length < 2}>
                Oluştur
              </Button>
            </DialogFooter>
          </form>
        )}

        {view === 'join' && (
          <form onSubmit={join}>
            <DialogHeader>
              <DialogTitle>Bir Sunucuya Katıl</DialogTitle>
              <DialogDescription>Mevcut bir sunucuya katılmak için davetini gir.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field
                label="Davet bağlantısı ya da kodu"
                error={error}
                hint={
                  <>
                    Örnek: <code>{inviteLink('a1b2c3d4e5f6')}</code> ya da <code>a1b2c3d4e5f6</code>
                  </>
                }
              >
                <Input value={invite} onChange={(e) => setInvite(e.target.value)} required autoFocus />
              </Field>
            </DialogBody>
            <DialogFooter className="justify-between">
              <Button type="button" variant="link" className="text-foreground" onClick={() => setView('choose')}>
                Geri
              </Button>
              <Button type="submit" disabled={busy || !invite.trim()}>
                Sunucuya Katıl
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- davet
export function InviteModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const { isModerator } = useMembership(server.id)
  const [code, setCode] = useState(server.invite_code)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function copy(what: 'link' | 'code'): void {
    void navigator.clipboard.writeText(what === 'link' ? inviteLink(code) : code)
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }

  async function regenerate(): Promise<void> {
    const { data, error } = await supabase.rpc('regenerate_invite', { p_server: server.id })
    if (error) {
      setError(errorMessage(error))
      return
    }
    setCode(data)
    void qc.invalidateQueries({ queryKey: qk.server(server.id) })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-base">Arkadaşlarını {server.name} sunucusuna davet et</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field label="Davet bağlantısı">
            <div className="flex items-center rounded-sm bg-floating p-1 pl-3">
              <span className="flex-1 truncate text-sm text-header">{inviteLink(code)}</span>
              <Button size="sm" variant={copied === 'link' ? 'success' : 'primary'} onClick={() => copy('link')}>
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'link' ? 'Kopyalandı' : 'Kopyala'}
              </Button>
            </div>
          </Field>
          <Field label="Davet kodu">
            <div className="flex items-center rounded-sm bg-floating p-1 pl-3">
              <span className="flex-1 font-mono text-header">{code}</span>
              <Button size="sm" variant="secondary" onClick={() => copy('code')}>
                {copied === 'code' ? 'Kopyalandı' : 'Kopyala'}
              </Button>
            </div>
          </Field>
          {isModerator && (
            <button
              onClick={() => void regenerate()}
              className="flex items-center gap-1 text-xs text-[hsl(200_100%_65%)] hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Yeni bağlantı oluştur (eskisi geçersiz olur)
            </button>
          )}
          {error && <p className="text-sm text-dnd">{error}</p>}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- sunucu ayarları
export function EditServerModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const me = useUserId()
  const [name, setName] = useState(server.name)
  const [icon, setIcon] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const patch: { name: string; icon_url?: string } = { name: name.trim() }
      if (icon) patch.icon_url = (await uploadFile('avatars', icon, me)).url
      const { error } = await supabase.from('servers').update(patch).eq('id', server.id)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: qk.servers })
      await qc.invalidateQueries({ queryKey: qk.server(server.id) })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Sunucu Ayarları</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <ImagePicker file={icon} currentUrl={server.icon_url} onPick={setIcon} />
            <Field label="Sunucu adı" error={error}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="link" className="text-foreground" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={busy || name.trim().length < 2}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- sil / ayrıl
export function DeleteServerModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`'${server.name}' sunucusunu sil`}
      description="Bu işlem geri alınamaz. Tüm kanallar ve mesajlar kalıcı olarak silinir."
      confirmLabel="Sunucuyu Sil"
      onConfirm={async () => {
        if (typed.trim() !== server.name) throw new Error('Sunucu adını doğru yazmadın.')
        const { error } = await supabase.rpc('delete_server', { p_server: server.id })
        if (error) throw error
        navigate('/channels/@me')
        await qc.invalidateQueries({ queryKey: qk.servers })
      }}
    >
      <div className="mt-4">
        <Field label="Onaylamak için sunucu adını yaz">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Field>
      </div>
    </ConfirmDialog>
  )
}

export function LeaveServerModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`'${server.name}' sunucusundan ayrıl`}
      description={
        <>
          <b className="text-foreground">{server.name}</b> sunucusundan ayrılmak istediğine emin misin?
          Yeniden davet edilmedikçe katılamazsın.
        </>
      }
      confirmLabel="Sunucudan Ayrıl"
      onConfirm={async () => {
        const { error } = await supabase.rpc('leave_server', { p_server: server.id })
        if (error) throw error
        navigate('/channels/@me')
        await qc.invalidateQueries({ queryKey: qk.servers })
      }}
    />
  )
}
