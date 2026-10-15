import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, DoorOpen, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { inviteLink, parseInvite } from '@/lib/invite'
import { uploadFile } from '@/lib/upload'
import { colorFor, initials } from '@/lib/utils'
import type { Server } from '@/lib/types'
import { qk, useMyProfile } from '@/hooks/queries'
import { useMembership } from '@/hooks/useMembership'
import { useUserId } from '@/stores/auth'
import { useModal } from '@/stores/modal'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice'
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
import { ErrorBox, Field, Input, Overline } from '@/components/ui/input'
import ImagePicker from './ImagePicker'

type ModalProps = { onClose: () => void }

/** Sunucu simgesi ya da baş harfleri (kişi renkleri gibi sabit renk). */
function ServerIcon({ server, size }: { server: Server; size: number }): React.JSX.Element {
  return server.icon_url ? (
    <img src={server.icon_url} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold text-on-avatar"
      style={{ width: size, height: size, background: colorFor(server.id), fontSize: Math.round(size * 0.31) }}
    >
      {initials(server.name)}
    </span>
  )
}

// ---------------------------------------------------------------- sunucu ekle
// Üç adım: seçim → özelleştir / davetle katıl. Akış her zaman geri gidilebilir.
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

  function go(next: typeof view): void {
    setError(null)
    setView(next)
  }

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
      setError('Geçerli bir davet bağlantısı ya da kodu gir.')
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
      <DialogContent className="w-[420px]">
        {view === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>Sunucu Ekle</DialogTitle>
              <DialogDescription>
                Sunucun arkadaşlarınla takıldığın yerdir. Kendi sunucunu kur ya da bir davetle katıl.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ChoiceCard
                icon={
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
                    <Plus className="h-6 w-6" />
                  </span>
                }
                title="Kendi sunucumu oluştur"
                desc="Bir dakikada kur, arkadaşlarını davet et."
                onClick={() => go('create')}
              />
              <div className="h-px bg-border" />
              <div className="flex flex-col items-center gap-2">
                <span className="text-meta text-text-muted">Zaten bir davetin var mı?</span>
                <Button variant="secondary" className="w-full" onClick={() => go('join')}>
                  Bir Sunucuya Katıl
                </Button>
              </div>
            </DialogBody>
          </>
        )}

        {view === 'create' && (
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>Sunucunu özelleştir</DialogTitle>
              <DialogDescription>
                Yeni sunucuna bir ad ve simge vererek ona kişilik kazandır. Sonradan değiştirebilirsin.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="flex justify-center">
                <ImagePicker file={icon} onPick={setIcon} ariaLabel="Sunucu simgesi yükle" />
              </div>
              <Field label="Sunucu adı" error={error}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  aria-invalid={!!error}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => go('choose')}>
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
              <DialogDescription>Arkadaşından aldığın davet bağlantısını ya da kodu yapıştır.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field
                label="Davet bağlantısı ya da kodu"
                error={error}
                hint={
                  <>
                    Örnek: <span className="font-mono">{inviteLink('a1b2c3d4e5f6')}</span> ya da{' '}
                    <span className="font-mono">a1b2c3d4e5f6</span>
                  </>
                }
              >
                <Input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  required
                  autoFocus
                  aria-invalid={!!error}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => go('choose')}>
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
/** Kopyalandıktan sonra düğme 2 saniye online / "Kopyalandı" olur. */
function CopyRow({
  label,
  value,
  mono,
  copied,
  onCopy
}: {
  label: string
  value: string
  mono?: boolean
  copied: boolean
  onCopy: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <div
        role="textbox"
        aria-readonly
        aria-label={label}
        className={
          mono
            ? 'selectable min-w-0 flex-1 truncate rounded-md border border-border-strong bg-input px-4 py-3 font-mono text-[18px] font-medium leading-6 tracking-[0.08em] text-header'
            : 'selectable min-w-0 flex-1 truncate rounded-md border border-border-strong bg-input px-4 py-3 font-mono text-[14px] leading-6 text-header'
        }
      >
        {value}
      </div>
      <Button variant={copied ? 'success' : 'primary'} onClick={onCopy} className="w-[124px]">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Kopyalandı' : 'Kopyala'}
      </Button>
    </div>
  )
}

export function InviteModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const { isModerator } = useMembership(server.id)
  const [code, setCode] = useState(server.invite_code)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function copy(what: 'link' | 'code'): void {
    void navigator.clipboard.writeText(what === 'link' ? inviteLink(code) : code)
    setCopied(what)
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000)
  }

  async function regenerate(): Promise<void> {
    const { data, error } = await supabase.rpc('regenerate_invite', { p_server: server.id })
    if (error) {
      setError(errorMessage(error))
      return
    }
    setCode(data)
    setCopied(null)
    void qc.invalidateQueries({ queryKey: qk.server(server.id) })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arkadaşlarını Davet Et</DialogTitle>
          <DialogDescription>{server.name} sunucusuna katılmaları için bu kodu paylaş.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <CopyRow label="Davet kodu" value={code} mono copied={copied === 'code'} onCopy={() => copy('code')} />
          <CopyRow
            label="Davet bağlantısı"
            value={inviteLink(code)}
            copied={copied === 'link'}
            onCopy={() => copy('link')}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
        </DialogBody>
        <DialogFooter>
          {isModerator && (
            <Button variant="ghost" onClick={() => void regenerate()} title="Eski kod geçersiz olur">
              <RotateCcw className="h-4 w-4" /> Yeni kod oluştur
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Bitti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- sunucu ayarları
export function EditServerModal({ server, onClose }: ModalProps & { server: Server }): React.JSX.Element {
  const qc = useQueryClient()
  const me = useUserId()
  const open = useModal((s) => s.open)
  const isOwner = server.owner_id === me
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
      <DialogContent className="w-modal-lg">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Sunucu Ayarları</DialogTitle>
            <DialogDescription>{server.name}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                <ImagePicker
                  file={icon}
                  currentUrl={server.icon_url}
                  onPick={setIcon}
                  shape="rounded"
                  ariaLabel="Simgeyi değiştir"
                  fallback={<ServerIcon server={server} size={96} />}
                />
                <span className="text-meta text-text-muted">Değiştirmek için tıkla</span>
              </div>
              <div className="min-w-0 flex-1">
                <Field label="Sunucu adı" error={error}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    aria-invalid={!!error}
                  />
                </Field>
              </div>
            </div>
            <div className="h-px bg-border" />
            {/* Tehlikeli alan: düğmeler asla birincil gibi görünmez; ikisi de onay penceresi açar. */}
            <div className="flex flex-col gap-2">
              <Overline>Tehlikeli alan</Overline>
              <div className="flex gap-2">
                {isOwner ? (
                  <Button type="button" variant="danger" onClick={() => open({ type: 'deleteServer', server })}>
                    <Trash2 className="h-4 w-4" /> Sunucuyu Sil
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => open({ type: 'leaveServer', server })}>
                    <DoorOpen className="h-4 w-4" /> Sunucudan Ayrıl
                  </Button>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
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
      title="Sunucuyu Sil"
      confirmLabel="Sunucuyu Sil"
      // En yıkıcı işlem: düğme sunucu adı yazılana kadar devre dışı.
      confirmDisabled={typed.trim() !== server.name}
      onConfirm={async () => {
        const { error } = await supabase.rpc('delete_server', { p_server: server.id })
        if (error) throw error
        navigate('/channels/@me')
        await qc.invalidateQueries({ queryKey: qk.servers })
      }}
    >
      <ErrorBox>
        <b className="font-semibold text-header">{server.name}</b> sunucusunu silmek üzeresin. Tüm kanallar ve
        mesajlar kalıcı olarak silinir; bu işlem geri alınamaz.
      </ErrorBox>
      <Field label="Onaylamak için sunucu adını yaz">
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={server.name} autoFocus />
      </Field>
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
      title="Sunucudan Ayrıl"
      confirmLabel="Ayrıl"
      onConfirm={async () => {
        const { error } = await supabase.rpc('leave_server', { p_server: server.id })
        if (error) throw error
        navigate('/channels/@me')
        await qc.invalidateQueries({ queryKey: qk.servers })
      }}
    >
      <div className="flex items-start gap-3 text-body text-text">
        <ServerIcon server={server} size={48} />
        <span>
          <b className="font-semibold text-header">{server.name}</b> sunucusundan ayrılmak istediğinden emin misin?
          Yeniden katılmak için davet gerekir.
        </span>
      </div>
    </ConfirmDialog>
  )
}
