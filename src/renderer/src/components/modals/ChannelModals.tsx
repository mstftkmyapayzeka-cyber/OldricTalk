import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Hash, Volume2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Channel, ChannelType, Server } from '@/lib/types'
import { qk, useChannels } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'

type ModalProps = { onClose: () => void }

/** Metin kanalı adları Discord'daki gibi küçük harf ve tireli olur. */
export function normalizeChannelName(name: string, type: ChannelType): string {
  if (type === 'voice') return name.replace(/[#@]/g, '').slice(0, 100)
  return name
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, '-')
    .replace(/[#@]/g, '')
    .slice(0, 100)
}

export function CreateChannelModal({
  server,
  channelType = 'text',
  onClose
}: ModalProps & { server: Server; channelType?: ChannelType }): React.JSX.Element {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: channels = [] } = useChannels(server.id)
  const [type, setType] = useState<ChannelType>(channelType)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const clean = normalizeChannelName(name, type).replace(/^-+|-+$/g, '').trim()
    if (!clean) return
    setBusy(true)
    const position = Math.max(0, ...channels.map((c) => c.position)) + 1
    const { data, error } = await supabase
      .from('channels')
      .insert({ server_id: server.id, name: clean, type, position })
      .select('id')
      .single()
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: qk.channels(server.id) })
    void qc.invalidateQueries({ queryKey: ['channels', 'all'] })
    onClose()
    navigate(`/channels/${server.id}/${data.id}`)
  }

  const types: { id: ChannelType; label: string; desc: string; Icon: typeof Hash }[] = [
    { id: 'text', label: 'Metin', desc: 'Mesaj, resim, GIF, emoji ve fikir paylaş', Icon: Hash },
    { id: 'voice', label: 'Ses', desc: 'Sesli, görüntülü ve ekran paylaşımıyla takılın', Icon: Volume2 }
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={create}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Kanal Oluştur</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase text-muted-foreground">Kanal türü</span>
              {types.map(({ id, label, desc, Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setType(id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left',
                    type === id ? 'bg-selected' : 'bg-sidebar hover:bg-hover'
                  )}
                >
                  <Icon className="h-6 w-6 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block font-medium text-header">{label}</span>
                    <span className="block text-sm text-muted-foreground">{desc}</span>
                  </span>
                  <span
                    className={cn(
                      'h-5 w-5 rounded-full border-2',
                      type === id ? 'border-header bg-header ring-4 ring-inset ring-brand' : 'border-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            <Field label="Kanal adı" error={error}>
              <div className="relative">
                {type === 'text' ? (
                  <Hash className="absolute left-2 top-2.5 h-5 w-5 text-muted-foreground" />
                ) : (
                  <Volume2 className="absolute left-2 top-2.5 h-5 w-5 text-muted-foreground" />
                )}
                <Input
                  value={name}
                  onChange={(e) => setName(normalizeChannelName(e.target.value, type))}
                  placeholder={type === 'text' ? 'yeni-kanal' : 'Yeni Kanal'}
                  className="pl-9"
                  maxLength={100}
                  autoFocus
                />
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="link" className="text-foreground" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Kanal Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditChannelModal({ channel, onClose }: ModalProps & { channel: Channel }): React.JSX.Element {
  const qc = useQueryClient()
  const [name, setName] = useState(channel.name)
  const [topic, setTopic] = useState(channel.topic ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase
      .from('channels')
      .update({
        name: normalizeChannelName(name, channel.type).replace(/^-+|-+$/g, '').trim(),
        topic: topic.trim() || null
      })
      .eq('id', channel.id)
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: qk.channels(channel.server_id) })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Kanalı Düzenle</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field label="Kanal adı" error={error}>
              <Input
                value={name}
                onChange={(e) => setName(normalizeChannelName(e.target.value, channel.type))}
                maxLength={100}
                required
              />
            </Field>
            {channel.type === 'text' && (
              <Field label="Kanal konusu" hint="Kanalın başlığında görünür.">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1024} />
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="link" className="text-foreground" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteChannelModal({ channel, onClose }: ModalProps & { channel: Channel }): React.JSX.Element {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Kanalı Sil"
      description={
        <>
          <b className="text-foreground">#{channel.name}</b> kanalını silmek istediğine emin misin? Bu
          işlem geri alınamaz.
        </>
      }
      confirmLabel="Kanalı Sil"
      onConfirm={async () => {
        const { error } = await supabase.from('channels').delete().eq('id', channel.id)
        if (error) throw error
        navigate(`/channels/${channel.server_id}`)
        await qc.invalidateQueries({ queryKey: qk.channels(channel.server_id) })
      }}
    />
  )
}
