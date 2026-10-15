import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../stores/auth'

export default function ProtectedRoute() {
  const user = useAuth((s) => s.user)
  const hydrate = useAuth((s) => s.hydrate)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    hydrate().finally(() => {
      if (!cancelled) setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [hydrate])

  if (!checked) return null
  return user ? <Outlet /> : <Navigate to="/welcome" replace />
}
