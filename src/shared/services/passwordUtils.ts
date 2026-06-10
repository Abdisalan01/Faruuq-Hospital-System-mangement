const PASSWORD_HASH_PREFIX = 'sha256:'
const APP_SALT = 'fsh-hms-v1'

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function isHashedPassword(stored?: string): boolean {
  return Boolean(stored?.startsWith(PASSWORD_HASH_PREFIX))
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await sha256Hex(`${APP_SALT}:${password}`)
  return `${PASSWORD_HASH_PREFIX}${digest}`
}

export async function verifyPassword(plain: string, stored?: string): Promise<boolean> {
  if (!stored) return false
  if (isHashedPassword(stored)) {
    return (await hashPassword(plain)) === stored
  }
  return plain === stored
}

export function validatePasswordStrength(password: string): string | null {
  const trimmed = password.trim()
  if (trimmed.length < 8) return 'Password must be at least 8 characters.'
  if (!/[a-zA-Z]/.test(trimmed)) return 'Password must include at least one letter.'
  if (!/[0-9]/.test(trimmed)) return 'Password must include at least one number.'
  return null
}

export function staffEmailFromUsername(username: string): string {
  const trimmed = username.trim().toLowerCase()
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}@hms.com`
}

/** Fix legacy rows where email was wrongly saved as user@gmail.com@hms.com */
export function normalizeStaffUserEmail(staff: { username: string; email: string }): boolean {
  const correctEmail = staffEmailFromUsername(staff.username)
  if (staff.email !== correctEmail) {
    staff.email = correctEmail
    return true
  }
  return false
}

export function staffLoginMatches(
  staff: { username: string; email: string; isActive: boolean },
  loginId: string,
): boolean {
  if (!staff.isActive) return false

  const normalizedLogin = loginId.trim().toLowerCase()
  if (!normalizedLogin) return false

  const username = staff.username.trim().toLowerCase()
  const email = staff.email.trim().toLowerCase()
  const correctEmail = staffEmailFromUsername(staff.username)

  if (username === normalizedLogin) return true
  if (email === normalizedLogin) return true
  if (correctEmail === normalizedLogin) return true

  // Legacy: email was username@gmail.com@hms.com but user logs in with username@gmail.com
  const legacyWrongEmail = `${username}@hms.com`
  if (username.includes('@') && email === legacyWrongEmail) {
    return normalizedLogin === username || normalizedLogin === legacyWrongEmail
  }

  return false
}
