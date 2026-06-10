import { useMemo } from 'react'

import { useAuthContext } from '@/context/useAuthContext'
import type { Permission } from '@/shared/types/roles'
import { roleHasAnyPermission, roleHasPermission } from '@/shared/types/roles'
import type { UserRole } from '@/shared/types/roles'

export function usePermission() {
  const { user } = useAuthContext()
  const role = user?.role as UserRole | undefined

  return useMemo(
    () => ({
      role,
      hasPermission: (permission: Permission) => (role ? roleHasPermission(role, permission) : false),
      hasAnyPermission: (permissions: Permission[]) => (role ? roleHasAnyPermission(role, permissions) : false),
      hasRole: (roles: UserRole | UserRole[]) => {
        if (!role) return false
        const list = Array.isArray(roles) ? roles : [roles]
        return list.includes(role)
      },
    }),
    [role],
  )
}
