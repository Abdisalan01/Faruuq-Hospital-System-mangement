import type { UserType } from '@/types/auth'
import { persistHmsStoreNowAsync, staffUsers } from '@/shared/services/hmsStore'
import type { StaffUser } from '@/shared/types'

import {
  hashPassword,
  isHashedPassword,
  staffLoginMatches,
  verifyPassword,
} from './passwordUtils'

function staffToAuthUser(staff: StaffUser): UserType {
  return {
    id: staff.id,
    email: staff.email,
    username: staff.username,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    departmentId: staff.departmentId,
    token: crypto.randomUUID(),
  }
}

function findStaffForLogin(loginId: string): StaffUser | undefined {
  return staffUsers.find((user) => staffLoginMatches(user, loginId))
}

export async function authenticateStaff(
  loginId: string,
  password: string,
): Promise<UserType | null> {
  const staff = findStaffForLogin(loginId)
  if (!staff) return null

  const passwordMatch = await verifyPassword(password, staff.password)
  if (!passwordMatch) return null

  let shouldPersist = false

  if (staff.password && !isHashedPassword(staff.password)) {
    staff.password = await hashPassword(password)
    shouldPersist = true
  }

  if (shouldPersist) {
    void persistHmsStoreNowAsync().catch((error) => {
      console.warn('[HMS] Failed to persist password upgrade after login', error)
    })
  }

  return staffToAuthUser(staff)
}
