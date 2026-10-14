import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { qk } from './queries'

/** Kişiyle DM açar (yoksa oluşturur) ve konuşmaya gider. */
export function useOpenDm(): (otherId: string) => Promise<void> {
  const navigate = useNavigate()
  const qc = useQueryClient()
  return useCallback(
    async (otherId: string) => {
      const { data, error } = await supabase.rpc('open_dm', { p_other: otherId })
      if (error) {
        alert(errorMessage(error))
        return
      }
      await qc.invalidateQueries({ queryKey: qk.conversations })
      navigate(`/channels/@me/${data}`)
    },
    [navigate, qc]
  )
}
