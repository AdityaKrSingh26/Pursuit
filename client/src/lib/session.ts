import type { AuthUser } from './types'

export function sessionAfterMeFailure(): { user: null; csrfToken: null } {
  return { user: null, csrfToken: null }
}

export function sessionFromMe(user: AuthUser, csrfToken: string | null): {
  user: AuthUser
  csrfToken: string | null
} {
  return { user, csrfToken }
}
