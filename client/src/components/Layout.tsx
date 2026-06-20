import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { usePendingReminders } from '../lib/queries'

const NAV = [
  { to: '/', label: 'Pipeline', code: '01', end: true },
  { to: '/applications/list', label: 'Ledger', code: '02' },
  { to: '/dashboard', label: 'Funnel', code: '03' },
  { to: '/resume', label: 'Resume', code: '04' },
  { to: '/intelligence', label: 'Intel', code: '05' },
  { to: '/reminders', label: 'Follow-ups', code: '06' },
  { to: '/jobs', label: 'Discover', code: '07' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: reminders } = usePendingReminders()
  const pendingCount = reminders?.length || 0

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r-[1.5px] border-line bg-paper-2">
        <div className="border-b-[1.5px] border-line px-5 py-5">
          <div className="flex items-baseline gap-2">
            <span className="h-3 w-3 bg-signal" />
            <h1 className="font-display text-2xl font-black tracking-tight">Pursuit</h1>
          </div>
          <p className="label mt-1.5 block">Job-Hunt Command</p>
        </div>

        <nav className="flex-1 px-3 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group mb-1 flex items-center gap-3 border-[1.5px] px-3 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-all ${
                  isActive
                    ? 'border-line bg-ink text-paper-3 shadow-hard-sm'
                    : 'border-transparent text-ink-soft hover:border-line hover:bg-paper-3'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-signal' : 'text-ink-faint'}>
                    {item.code}
                  </span>
                  {item.label}
                  {item.to === '/reminders' && pendingCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-sm bg-signal px-1 font-mono text-[9px] font-bold text-paper-3">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t-[1.5px] border-line px-4 py-4">
          <p className="truncate font-mono text-[11px] text-ink-soft" title={user?.email}>
            {user?.email}
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint underline-offset-2 hover:text-signal hover:underline"
          >
            ↳ Sign out
          </button>
        </div>
      </aside>

      <main className="h-full flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
