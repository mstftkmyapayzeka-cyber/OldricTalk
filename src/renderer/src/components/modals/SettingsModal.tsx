import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/session'
import { errorMessage } from '@/lib/errors'
import { uploadFile } from '@/lib/upload'
import type { Profile } from '@/lib/types'
import { qk, useMyProfile } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import ImagePicker from './ImagePicker'

const USERNAME_RE = /^[a-z0-9_.]{2,32}$/

export default function SettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const qc = useQueryClient()
  const { data: me } = useMyProfile()
  const [displayName, setDisplayName] = useState(me?.display_name ?? '')
  const [username, setUsername] = useState(me?.username ?? '')
  const [customStatus, setCustomStatus] = useState(me?.custom_status ?? '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.oldric?.version().then(setVersion)
  }, [])

  useEffect(() => {
    if (!me || username === me.username) {
      setUsernameOk(null)
      return
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameOk(false)
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('username_available', { p_username: username })
      setUsernameOk(!!data)
    }, 350)
    return () => clearTimeout(t)
  }, [username, me])

  if (!me) return null

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (usernameOk === false) return
    setBusy(true)
    setError(null)
    try {
      const patch: Pick<Profile, 'display_name' | 'username' | 'custom_status'> & {
        avatar_url?: string
      } = {
        display_name: displayName.trim() || me!.username,
        username,
        custom_status: customStatus.trim() || null
      }
      if (avatar) patch.avatar_url = (await uploadFile('avatars', avatar, me!.id)).url
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', me!.id)
        .select('*')
        .single()
      if (error) throw error
      qc.setQueryData(qk.profile(me!.id), data)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[500px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Profilim</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <ImagePicker file={avatar} currentUrl={me.avatar_url} onPick={setAvatar} className="h-24 w-24" />
            <Field label="Görünen ad">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
            </Field>
            <Field
              label="Kullanıcı adı"
              error={usernameOk === false ? 'geçersiz ya da alınmış' : null}
              hint={usernameOk ? '✓ Müsait' : 'küçük harf, rakam, _ ve . (2–32)'}
            >
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={32} />
            </Field>
            <Field label="Özel durum" hint="Adının altında görünür.">
              <Input
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                maxLength={128}
                placeholder="Ne yapıyorsun?"
              />
            </Field>
            {error && <p className="text-sm text-dnd">{error}</p>}
          </DialogBody>
          <DialogFooter className="justify-between">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" className="text-dnd" onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" /> Çıkış yap
              </Button>
              {version && <span className="text-xs text-muted-foreground">v{version}</span>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="link" className="text-foreground" onClick={onClose}>
                İptal
              </Button>
              <Button type="submit" disabled={busy || usernameOk === false}>
                Kaydet
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
