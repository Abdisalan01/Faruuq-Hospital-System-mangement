import { useEffect, useState } from 'react'
import { Button, Card, CardBody, Col, Form, InputGroup, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { getStaffById, persistStaffUsersNowAsync } from '@/shared/services/hmsStore'
import { hashPassword, validatePasswordStrength } from '@/shared/services/passwordUtils'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/shared/types/roles'

const MANAGED_ROLES = USER_ROLES.filter((r) => r !== 'emergency')

const UserEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dataVersion } = useHmsStoreContext()
  const user = id ? getStaffById(id) : undefined

  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('reception_cashier')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || user.role === 'emergency') return
    setFullName(`${user.firstName} ${user.lastName === '—' ? '' : user.lastName}`.trim())
    setRole(user.role)
    setIsActive(user.isActive)
    setPassword('')
  }, [user, dataVersion])

  if (!user || user.role === 'emergency') {
    return (
      <PermissionGuard permissions={['user_management']}>
        <PageMetaData title="User Not Found" />
        <div className="alert alert-warning">User not found.</div>
        <Link to="/hms/administration/users">Back to Users</Link>
      </PermissionGuard>
    )
  }

  const isBootstrapAdmin = user.id === 'staff-001'
  const roleOptions = isBootstrapAdmin ? MANAGED_ROLES : MANAGED_ROLES.filter((r) => r !== 'admin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

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
      user.lastModifiedAt = new Date().toISOString()

      await persistStaffUsersNowAsync()
      navigate('/hms/administration/users', {
        state: { message: `User "${user.username}" updated successfully.` },
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save user: ${detail}`)
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
          { label: user.username },
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
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password or leave blank to keep current"
                      autoComplete="new-password"
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <IconifyIcon icon={showPassword ? 'solar:eye-closed-broken' : 'solar:eye-broken'} />
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Min 8 characters with at least one letter and one number.
                  </Form.Text>
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
              <Link to="/hms/administration/users" className="btn btn-light">
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
