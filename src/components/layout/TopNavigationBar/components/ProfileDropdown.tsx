import { Link } from 'react-router-dom'
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem, DropdownMenu, DropdownToggle } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { ROLE_LABELS } from '@/shared/types/roles'
import type { UserRole } from '@/shared/types/roles'

const ProfileDropdown = () => {
  const { user, removeSession } = useAuthContext()
  const roleLabel = user?.role ? ROLE_LABELS[user.role as UserRole] : 'Staff'
  const initial = (user?.firstName?.charAt(0) || user?.lastName?.charAt(0) || 'U').toUpperCase()

  return (
    <Dropdown className="topbar-item" align={'end'}>
      <DropdownToggle
        as="button"
        type="button"
        className="topbar-button content-none"
        id="page-header-user-dropdown"
        data-bs-toggle="dropdown"
        aria-haspopup="true"
        aria-expanded="false">
        <span className="d-flex align-items-center">
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center bg-primary text-white fw-semibold"
            style={{ width: 32, height: 32, fontSize: 14 }}>
            {initial}
          </span>
        </span>
      </DropdownToggle>
      <DropdownMenu>
        <DropdownHeader as="h6">
          {user?.firstName} {user?.lastName}
          <div className="text-muted fs-12 fw-normal">{roleLabel}</div>
        </DropdownHeader>
        <DropdownDivider className="dropdown-divider my-1" />
        <DropdownItem as={Link} onClick={removeSession} className="text-danger" to="/auth/sign-in">
          <IconifyIcon icon="bx:log-out" className="fs-18 align-middle me-1" />
          <span className="align-middle">Logout</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

export default ProfileDropdown
