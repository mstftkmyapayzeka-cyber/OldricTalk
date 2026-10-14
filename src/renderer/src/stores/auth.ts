import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  ready: boolean
}

export const useAuth = create<AuthState>(() => ({ session: null, ready: false }))

/** Oturum durumunu izlemeye başlar; uygulama açılışında bir kez çağrılır. */
export function initAuth(): void {
  void supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, ready: true })
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, ready: true })
  })
}

export function useUserId(): string {
  const id = useAuth((s) => s.session?.user.id)
  if (!id) throw new Error('useUserId oturum dışında çağrıldı')
  return id
}
