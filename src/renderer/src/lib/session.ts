import { supabase } from './supabase'
import { leaveVoice } from './voice'

/** Çıkış: önce sesten ayrılır ve çevrimdışı olduğunu yayar, sonra oturumu kapatır. */
export async function signOut(): Promise<void> {
  await leaveVoice(false)
  await supabase.rpc('go_offline').then(
    () => undefined,
    () => undefined
  )
  await supabase.auth.signOut()
}
