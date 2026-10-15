import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Hash, Trash2, Volume2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Channel, ChannelType, Server } from '@/lib/types'
import { qk, useChannels } from '@/hooks/queries'
import { useModal } from '@/stores/modal'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice'
import { ConfirmDialog } from '@/components/ui/confirm'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, Input, Overline } from '@/components/ui/input'

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

  // Yalnızca ses: ses kanalında kamera ve ekran paylaşımı yoktur.
  const types: { id: ChannelType; label: string; desc: string; Icon: typeof Hash }[] = [
    { id: 'text', label: 'Metin', desc: 'Mesaj, resim, emoji gönder', Icon: Hash },
    { id: 'voice', label: 'Ses', desc: 'Sesli konuş', Icon: Volume2 }
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[420px]">
        <form onSubmit={create}>
          <DialogHeader>
            <DialogTitle>Kanal Oluştur</DialogTitle>
            <DialogDescription>{server.name} · yeni kanal</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div role="radiogroup" aria-label="Kanal türü" className="flex flex-col gap-2">
              <Overline>Kanal türü</Overline>
              {types.map(({ id, label, desc, Icon }) => (
                <ChoiceCard
                  key={id}
                  selected={type === id}
                  onClick={() => {
                    setType(id)
                    setName((n) => normalizeChannelName(n, id))
                  }}
                  title={label}
                  desc={desc}
                  icon={
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-md',
                        type === id ? 'bg-brand-soft text-brand' : 'bg-selected text-text'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  }
                />
              ))}
            </div>
            <Field
              label="Kanal adı"
              error={error}
              hint={type === 'text' ? 'Küçük harf ve tire kullan; boşluklar tireye dönüşür.' : undefined}
            >
              <ChannelNameInput
                type={type}
                value={name}
                onChange={(v) => setName(normalizeChannelName(v, type))}
                placeholder={type === 'text' ? 'yeni-kanal' : 'Yeni Kanal'}
                invalid={!!error}
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
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

/** Kanal adı kutusu; içinde # (metin) ya da hoparlör (ses) ön eki. */
function ChannelNameInput({
  type,
  value,
  onChange,
  placeholder,
  invalid,
  autoFocus
}: {
  type: ChannelType
  value: string
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
  autoFocus?: boolean
}): React.JSX.Element {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[14px] leading-5 text-text-muted">
        {type === 'text' ? '#' : <Volume2 className="h-4 w-4" />}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={type === 'text' ? 'pl-[30px]' : 'pl-9'}
        maxLength={100}
        required
        aria-invalid={invalid}
        autoFocus={autoFocus}
      />
    </div>
  )
}

export function EditChannelModal({ channel, onClose }: ModalProps & { channel: Channel }): React.JSX.Element {
  const qc = useQueryClient()
  const open = useModal((s) => s.open)
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
      <DialogContent className="w-[420px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Kanalı Düzenle</DialogTitle>
            <DialogDescription>
              {channel.type === 'text' ? '# ' : ''}
              {channel.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Kanal adı" error={error}>
              <ChannelNameInput
                type={channel.type}
                value={name}
                onChange={(v) => setName(normalizeChannelName(v, channel.type))}
                invalid={!!error}
              />
            </Field>
            {channel.type === 'text' && (
              <Field label="Konu" hint="Kanalın başlığında görünür.">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={1024}
                  placeholder="Bu kanal ne hakkında?"
                />
              </Field>
            )}
            <div className="h-px bg-border" />
            <div>
              <Button
                type="button"
                variant="dangerGhost"
                onClick={() => open({ type: 'deleteChannel', channel })}
              >
                <Trash2 className="h-4 w-4" /> Kanalı Sil
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
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
          <b>
            {channel.type === 'text' ? '#' : ''}
            {channel.name}
          </b>{' '}
          kanalını silmek istediğinden emin misin? Kanaldaki tüm mesajlar silinir; bu işlem geri alınamaz.
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
