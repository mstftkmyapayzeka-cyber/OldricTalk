import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'oldrictalk-auth'
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})
