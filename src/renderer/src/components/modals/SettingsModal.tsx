import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/session'
import { errorMessage } from '@/lib/errors'
import { uploadFile } from '@/lib/upload'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { qk, useMyProfile } from '@/hooks/queries'
import { setTheme, useTheme, type ThemeChoice } from '@/stores/theme'
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
import { ErrorBox, Field, Input, Overline, PrefixedInput } from '@/components/ui/input'
import ImagePicker from './ImagePicker'

const USERNAME_RE = /^[a-z0-9_.]{2,32}$/

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Krem' },
  { id: 'dark', label: 'Koyu' },
  { id: 'system', label: 'Windows ile Aynı' }
]

/** Krem ana tema; koyu tema isteğe bağlı. Bu bilgisayara özel, anında uygulanır. */
function ThemePicker(): React.JSX.Element {
  const choice = useTheme((s) => s.choice)
  return (
    <div className="flex flex-col gap-1.5">
      <Overline>Tema</Overline>
      <div role="radiogroup" aria-label="Tema" className="flex items-center gap-1">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={choice === t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'inline-flex h-7 items-center rounded-sm px-3 text-label font-semibold transition-colors duration-fast',
              choice === t.id ? 'bg-selected text-header' : 'text-text-muted hover:bg-hover hover:text-text'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <span className="text-meta text-text-muted">Bu ayar yalnızca bu bilgisayar için geçerlidir.</span>
    </div>
  )
}

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

  // Kaydet, değişiklik yoksa devre dışıdır.
  const changed =
    !!avatar ||
    displayName.trim() !== me.display_name ||
    username !== me.username ||
    (customStatus.trim() || null) !== (me.custom_status || null)

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
      <DialogContent className="w-modal-lg">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Profilim</DialogTitle>
            <DialogDescription>Seni sunucularda ve özel mesajlarda böyle görürler.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                <ImagePicker file={avatar} currentUrl={me.avatar_url} onPick={setAvatar} ariaLabel="Avatar yükle" />
                <span className="text-meta text-text-muted">En az 128×128 px</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Field label="Görünen ad">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
                </Field>
                <Field
                  label="Kullanıcı adı"
                  hint="Küçük harf, rakam, _ ve . (2–32 karakter)."
                  error={usernameOk === false ? 'Geçersiz ya da alınmış' : null}
                  ok={usernameOk ? 'Müsait' : null}
                >
                  <PrefixedInput
                    prefix="@"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    maxLength={32}
                    aria-invalid={usernameOk === false}
                  />
                </Field>
                <Field label="Özel durum" hint="Adının altında görünür.">
                  <Input
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    maxLength={128}
                    placeholder="Ne yapıyorsun?"
                  />
                </Field>
              </div>
            </div>
            <div className="h-px bg-border" />
            <ThemePicker />
            {error && <ErrorBox>{error}</ErrorBox>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="dangerGhost" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> Çıkış yap
            </Button>
            {version && <span className="ml-2 text-meta text-text-muted">v{version}</span>}
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={busy || !changed || usernameOk === false}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
