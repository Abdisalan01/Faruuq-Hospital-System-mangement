import { Navigate } from 'react-router-dom'

import { useAuthContext } from '@/context/useAuthContext'
import { getRoleHomePath } from '@/shared/config/roleHomeRoutes'

const RoleHomeRedirect = () => {
  const { user } = useAuthContext()
  return <Navigate to={getRoleHomePath(user?.role)} replace />
}

export default RoleHomeRedirect
