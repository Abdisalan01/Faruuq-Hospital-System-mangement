import { useState } from 'react'
import { Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { getStaffById, persistStaffUsersNowAsync } from '@/shared/services/hmsStore'
import { hashPassword, validatePasswordStrength } from '@/shared/services/passwordUtils'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/shared/types/roles'

const UserEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = id ? getStaffById(id) : undefined

  const [fullName, setFullName] = useState(
    user ? `${user.firstName} ${user.lastName === '—' ? '' : user.lastName}`.trim() : '',
  )
  const [role, setRole] = useState<UserRole>(user?.role ?? 'reception_cashier')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user) {
    return (
      <PermissionGuard permissions={['user_management']}>
        <PageMetaData title="User Not Found" />
        <div className="alert alert-warning">User not found.</div>
        <Link to="/hms/administration/users">Back to Users</Link>
      </PermissionGuard>
    )
  }

  const isBootstrapAdmin = user.id === 'staff-001'
  const roleOptions = isBootstrapAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => r !== 'admin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.trim()) {
      const passwordError = validatePasswordStrength(password)
      if (passwordError) {
        setError(passwordError)
        return
      }
    }

    setSaving(true)
    try {
      if (password.trim()) {
        user.password = await hashPassword(password)
      }
      const parts = fullName.trim().split(/\s+/)
      user.firstName = parts[0] ?? user.firstName
      user.lastName = parts.length > 1 ? parts.slice(1).join(' ') : '—'
      if (!isBootstrapAdmin) user.role = role
      user.isActive = isActive

      await persistStaffUsersNowAsync()
      navigate(`/hms/administration/users/${user.id}`)
    } catch {
      setError('Failed to save user. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['user_management']}>
      <PageMetaData title={`Edit User: ${user.username}`} />
      <PageHeader
        title="Edit User"
        subtitle="Update name, role, password, or status"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'User Management', href: '/hms/administration/users' },
          { label: user.username, href: `/hms/administration/users/${user.id}` },
          { label: 'Edit' },
        ]}
      />
      <Card>
        <CardBody>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <Form onSubmit={(e) => void handleSubmit(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control value={user.username} disabled />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={isBootstrapAdmin}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current (min 8, letter + number)"
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Check
                  type="switch"
                  label="Active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mb-3"
                />
              </Col>
            </Row>
            <div className="d-flex gap-2">
              <Button type="submit" variant="success" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Link to={`/hms/administration/users/${user.id}`} className="btn btn-light">
                Cancel
              </Link>
            </div>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default UserEditPage
