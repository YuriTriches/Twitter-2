'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getCurrentSession = async () => {
      const { data } = await supabase.auth.getSession()
      const s = data?.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    }

    getCurrentSession()


    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
    })

    return () => {
     
      authListener.subscription.unsubscribe()
    }
  }, [])

  return { session, user, loading }
}