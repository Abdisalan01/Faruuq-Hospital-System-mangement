import type { UserRole } from '@/shared/types/roles'

/** First page each role sees after login */
const ROLE_HOME_PATHS: Partial<Record<UserRole, string>> = {
  admin: '/hms/dashboard',
  reception_cashier: '/hms/reception/dashboard',
  doctor: '/hms/doctor/dashboard',
  nurse: '/hms/inpatient/dashboard',
  laboratory: '/hms/laboratory/dashboard',
  pharmacy: '/hms/pharmacy/dashboard',
  emergency: '/hms/doctor/dashboard',
}

export function getRoleHomePath(role?: UserRole): string {
  if (!role) return '/hms/dashboard'
  return ROLE_HOME_PATHS[role] ?? '/hms/dashboard'
}
