import { getCookie } from 'cookies-next'

const authSessionKey = '_Rasket_AUTH_KEY_'

export function getLoggedInStaffId(fallback = 'staff-003'): string {
  const fetchedCookie = getCookie(authSessionKey)?.toString()
  if (!fetchedCookie) return fallback
  try {
    const user = JSON.parse(fetchedCookie) as { id?: string }
    return user.id ?? fallback
  } catch {
    return fallback
  }
}

export const todayIso = () => new Date().toISOString().split('T')[0]
