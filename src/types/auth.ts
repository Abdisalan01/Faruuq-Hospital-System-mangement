import type { UserRole } from '@/shared/types/roles'

export type UserType = {
  id: string
  username: string
  email: string
  password?: string
  firstName: string
  lastName: string
  role: UserRole
  token: string
  departmentId?: string
}
