import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../stores/auth'
import { ApiError } from '../../lib/api'
import { Button } from '../../components/ui'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const isRegister = mode === 'register'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isRegister && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      if (isRegister) await register(email, password)
      else await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      {/* Oversized typographic backdrop — the "field manual" cover. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="absolute -left-10 top-1/2 -translate-y-1/2 select-none font-display text-[28vw] font-black leading-none text-ink/[0.04]">
          PURSUIT
        </span>
      </div>

      <div className="relative w-full max-w-sm animate-rise-in border-[1.5px] border-line bg-paper-2 shadow-hard-lg">
        <div className="border-b-[1.5px] border-line bg-paper px-7 py-6">
          <div className="flex items-baseline gap-2">
            <span className="h-3 w-3 bg-signal" />
            <h1 className="font-display text-3xl font-black">Pursuit</h1>
          </div>
          <p className="label mt-2 block">
            {isRegister ? 'Open a new case file' : 'Resume the hunt'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 p-7">
          <div>
            <label className="label mb-1.5 block">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label mb-1.5 block">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="········"
            />
          </div>
          {isRegister && (
            <div>
              <label className="label mb-1.5 block">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field"
                placeholder="········"
              />
            </div>
          )}

          {error && (
            <p className="border-l-2 border-missing bg-missing/10 px-3 py-2 font-mono text-[11px] text-missing">
              {error}
            </p>
          )}

          <Button type="submit" variant="signal" disabled={busy} className="w-full">
            {busy ? 'Working…' : isRegister ? 'Create account →' : 'Sign in →'}
          </Button>

          <p className="pt-1 text-center font-mono text-[11px] text-ink-soft">
            {isRegister ? 'Already tracking? ' : 'New here? '}
            <Link
              to={isRegister ? '/login' : '/register'}
              className="text-signal underline-offset-2 hover:underline"
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
