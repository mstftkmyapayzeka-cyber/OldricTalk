import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type Mode = 'login' | 'register' | 'verify'

const USERNAME_RE = /^[a-z0-9_.]{2,32}$/

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

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        if (usernameState !== 'ok') throw new Error('Geçerli ve boş bir kullanıcı adı seçin.')
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
    usernameState === 'taken'
      ? 'bu ad alınmış'
      : usernameState === 'invalid'
        ? 'küçük harf, rakam, _ ve . (2–32)'
        : null

  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,hsl(255_45%_28%),hsl(var(--rail))_60%)] p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[480px] rounded-lg bg-chat p-8 shadow-2xl animate-fade-in"
      >
        {mode === 'verify' ? (
          <>
            <h1 className="text-center text-2xl font-bold text-header">E-postanı doğrula</h1>
            <p className="mt-2 text-center text-muted-foreground">
              <b className="text-foreground">{email}</b> adresine bir doğrulama e-postası gönderdik.
              E-postadaki bağlantıya tıklayıp ardından giriş yapabilir ya da e-postada bir kod
              varsa aşağıya girebilirsin.
            </p>
            <div className="mt-6 space-y-4">
              <Field label="Doğrulama kodu" error={error}>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  autoFocus
                />
              </Field>
              <Button type="submit" className="w-full" size="lg" disabled={busy || !code.trim()}>
                {busy ? <Spinner className="text-white" /> : 'Doğrula'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
              >
                Bağlantıya tıkladım, giriş yap
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold text-header">
              {mode === 'login' ? 'Tekrar hoş geldin!' : 'Hesap oluştur'}
            </h1>
            <p className="mt-2 text-center text-muted-foreground">
              {mode === 'login'
                ? 'Seni yeniden görmek çok güzel!'
                : 'OldricTalk’a katıl, sohbete başla.'}
            </p>

            <div className="mt-6 space-y-4">
              <Field label="E-posta" error={mode === 'login' ? error : null}>
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
                  <Field label="Görünen ad" hint="Başkalarının seni nasıl göreceği. İstediğin zaman değiştirebilirsin.">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={32}
                    />
                  </Field>
                  <Field
                    label="Kullanıcı adı"
                    error={usernameError}
                    hint={
                      usernameState === 'ok'
                        ? '✓ Bu kullanıcı adı müsait.'
                        : usernameState === 'checking'
                          ? 'Denetleniyor…'
                          : 'Arkadaşların seni bu adla ekler.'
                    }
                  >
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      required
                      maxLength={32}
                      autoComplete="username"
                    />
                  </Field>
                </>
              )}

              <Field label="Şifre" error={mode === 'register' ? null : null}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </Field>

              {mode === 'register' && error && <p className="text-sm text-dnd">{error}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? (
                  <Spinner className="text-white" />
                ) : mode === 'login' ? (
                  'Giriş Yap'
                ) : (
                  'Devam Et'
                )}
              </Button>

              <p className="text-sm text-muted-foreground">
                {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
                <button
                  type="button"
                  className="text-[hsl(200_100%_65%)] hover:underline"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login')
                    setError(null)
                  }}
                >
                  {mode === 'login' ? 'Kaydol' : 'Giriş yap'}
                </button>
              </p>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
