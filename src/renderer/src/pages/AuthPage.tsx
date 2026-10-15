import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { ErrorBox, Field, Input, PrefixedInput } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import AuthBackdrop, { AuthCard } from '@/components/layout/AuthBackdrop'
import { LogoMark, LogoText } from '@/components/layout/Logo'

type Mode = 'login' | 'register' | 'verify'

const USERNAME_RE = /^[a-z0-9_.]{2,32}$/

/** Şifre kutusu; göz simgesi her zaman görünür. */
function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Şifreyi gizle' : 'Şifreyi göster'
  return (
    <div className="relative flex items-center">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          onClick={() => setVisible(!visible)}
          className="absolute right-2 grid h-7 w-7 place-items-center rounded-sm text-text-muted transition-colors duration-fast hover:text-header"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </Tooltip>
    </div>
  )
}

function BusyLabel({ busy, children }: { busy: boolean; children: React.ReactNode }): React.JSX.Element {
  return busy ? <Spinner className="border-on-brand/40 border-t-on-brand" /> : <>{children}</>
}

export default function AuthPage(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>(
    'idle'
  )

  // Kullanıcı adı müsaitliğini yazarken denetle.
  useEffect(() => {
    if (mode !== 'register' || !username) {
      setUsernameState('idle')
      return
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameState('invalid')
      return
    }
    setUsernameState('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('username_available', { p_username: username })
      setUsernameState(data ? 'ok' : 'taken')
    }, 350)
    return () => clearTimeout(t)
  }, [username, mode])

  function switchMode(next: Mode): void {
    setMode(next)
    setError(null)
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        if (usernameState !== 'ok') throw new Error('Geçerli ve boş bir kullanıcı adı seç.')
        if (password.length < 8) throw new Error('Şifre en az 8 karakter olmalı.')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: displayName.trim() || username } }
        })
        if (error) throw error
        if (!data.session) setMode('verify')
      } else {
        const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' })
        if (error) throw error
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const usernameError =
    usernameState === 'taken' ? 'Bu kullanıcı adı alınmış' : usernameState === 'invalid' ? 'Geçersiz kullanıcı adı' : null

  return (
    <AuthBackdrop>
      <AuthCard className={mode === 'register' ? 'w-[468px]' : undefined}>
        <form onSubmit={submit}>
          {mode === 'login' && (
            <div className="mb-5 flex items-center justify-center gap-2">
              <LogoMark size={24} />
              <LogoText className="text-[18px] leading-6" />
            </div>
          )}

          {mode === 'verify' ? (
            <>
              <h1 className="text-center text-title-lg text-header">E-postanı doğrula</h1>
              <p className="mt-2 text-center text-[14px] leading-5 text-text-muted">
                <b className="font-semibold text-text">{email}</b> adresine bir doğrulama e-postası gönderdik.
                E-postadaki bağlantıya tıklayıp giriş yapabilir ya da e-postada bir kod varsa aşağıya girebilirsin.
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <Field label="Doğrulama kodu" error={error}>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={10}
                    className="font-mono tracking-[0.08em]"
                    aria-invalid={!!error}
                    autoFocus
                  />
                </Field>
                <Button type="submit" className="w-full" size="lg" disabled={busy || !code.trim()}>
                  <BusyLabel busy={busy}>Doğrula</BusyLabel>
                </Button>
                <div className="flex justify-center">
                  <Button type="button" variant="link" onClick={() => switchMode('login')}>
                    Bağlantıya tıkladım, giriş yap
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-center text-title-lg text-header">
                {mode === 'login' ? 'Tekrar hoş geldin!' : 'Hesap oluştur'}
              </h1>
              <p className="mt-2 text-center text-[14px] leading-5 text-text-muted">
                {mode === 'login'
                  ? 'Seni yeniden gördüğümüze sevindik.'
                  : 'Arkadaşlarınla konuşmaya bir adım kaldı.'}
              </p>

              <div className={mode === 'login' ? 'mt-6 flex flex-col gap-4' : 'mt-5 flex flex-col gap-3'}>
                <Field label="E-posta" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </Field>

                {mode === 'register' && (
                  <>
                    <Field label="Görünen ad" hint="Başkaları seni bu adla görür; istediğin zaman değiştirebilirsin.">
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
                    </Field>
                    <Field
                      label="Kullanıcı adı"
                      required
                      // Kural her zaman görünür; hata ya da "Müsait" onun altına eklenir.
                      hint={usernameState === 'checking' ? 'Denetleniyor…' : 'Küçük harf, rakam, _ ve . · 2–32 karakter'}
                      error={usernameError}
                      ok={usernameState === 'ok' ? 'Müsait' : null}
                    >
                      <PrefixedInput
                        prefix="@"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        required
                        maxLength={32}
                        autoComplete="username"
                        aria-invalid={!!usernameError}
                      />
                    </Field>
                  </>
                )}

                <Field
                  label="Şifre"
                  required
                  hint={mode === 'register' ? 'En az 8 karakter.' : undefined}
                  error={mode === 'login' ? error : null}
                >
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-invalid={mode === 'login' && !!error}
                  />
                </Field>

                {mode === 'register' && error && <ErrorBox>{error}</ErrorBox>}

                <Button type="submit" className="mt-1 w-full" size="lg" disabled={busy}>
                  <BusyLabel busy={busy}>{mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</BusyLabel>
                </Button>

                <div className="flex items-center justify-center gap-1">
                  <span className="text-meta text-text-muted">
                    {mode === 'login' ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  >
                    {mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </form>
      </AuthCard>
    </AuthBackdrop>
  )
}
