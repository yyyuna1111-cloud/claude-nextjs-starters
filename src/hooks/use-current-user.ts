'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useCurrentUser() {
  const [user, setUser] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setUser(data?.username ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  return { user, loaded, logout }
}
