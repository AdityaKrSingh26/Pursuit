import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, readCsrf } from '../lib/api'
import type { AuthUser } from '../lib/types'

interface AuthState {
  user: AuthUser | null
  csrfToken: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // Re-reads the csrf cookie after a refresh / page reload.
  syncCsrf: () => void
}

// The httpOnly accessToken cookie is the real source of auth; we persist only
// the lightweight user identity so the shell can render before the first fetch.
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      csrfToken: readCsrf(),

      async login(email, password) {
        const user = await api<AuthUser>('/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        set({ user, csrfToken: readCsrf() })
      },

      async register(email, password) {
        const user = await api<AuthUser>('/auth/register', {
          method: 'POST',
          body: { email, password },
        })
        set({ user, csrfToken: readCsrf() })
      },

      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' })
        } finally {
          set({ user: null, csrfToken: null })
        }
      },

      syncCsrf() {
        set({ csrfToken: readCsrf() })
      },
    }),
    { name: 'pursuit-auth', partialize: (s) => ({ user: s.user }) },
  ),
)
