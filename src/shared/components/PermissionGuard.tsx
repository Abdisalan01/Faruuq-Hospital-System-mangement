import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, Col, Row } from 'react-bootstrap'

import { getRoleHomePath } from '@/shared/config/roleHomeRoutes'
import { usePermission } from '@/shared/hooks/usePermission'
import type { Permission } from '@/shared/types/roles'
import type { UserRole } from '@/shared/types/roles'

type PermissionGuardProps = {
  permissions?: Permission[]
  roles?: UserRole[]
  children: ReactNode
  fallback?: ReactNode
  /** When true (default), send user to their role dashboard instead of showing an error */
  redirectOnDeny?: boolean
}

export function PermissionGuard({
  permissions,
  roles,
  children,
  fallback,
  redirectOnDeny = true,
}: PermissionGuardProps) {
  const { hasAnyPermission, hasRole, role } = usePermission()

  const allowedByPermission = !permissions || permissions.length === 0 || hasAnyPermission(permissions)
  const allowedByRole = !roles || roles.length === 0 || hasRole(roles)

  if (allowedByPermission && allowedByRole) {
    return <>{children}</>
  }

  if (fallback) return <>{fallback}</>

  if (redirectOnDeny && role) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return (
    <Row>
      <Col>
        <Alert variant="danger" className="mt-3">
          You do not have permission to access this page.
        </Alert>
      </Col>
    </Row>
  )
}

type RoleGuardRouteProps = {
  permissions?: Permission[]
  roles?: UserRole[]
  children: ReactNode
}

export function RoleGuardRoute({ permissions, roles, children }: RoleGuardRouteProps) {
  const { hasAnyPermission, hasRole, role } = usePermission()

  const allowedByPermission = !permissions || permissions.length === 0 || hasAnyPermission(permissions)
  const allowedByRole = !roles || roles.length === 0 || hasRole(roles)

  if (!allowedByPermission || !allowedByRole) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return <>{children}</>
}
