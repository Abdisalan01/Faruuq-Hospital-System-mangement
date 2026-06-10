import { useState } from 'react'
import { Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  generateId,
  isStaffCredentialTaken,
  persistStaffUsersNowAsync,
  staffUsers,
} from '@/shared/services/hmsStore'
import {
  hashPassword,
  staffEmailFromUsername,
  validatePasswordStrength,
} from '@/shared/services/passwordUtils'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/shared/types/roles'

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

const UserCreatePage = () => {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('reception_cashier')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedUsername = username.trim().toLowerCase()
    const email = staffEmailFromUsername(trimmedUsername)
    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (isStaffCredentialTaken(trimmedUsername, email)) {
      setError('Username or email already exists. Choose a different username.')
      return
    }

    setSaving(true)
    try {
      const { firstName, lastName } = splitFullName(fullName)
      const newUser = {
        id: generateId('staff'),
        username: trimmedUsername,
        email,
        firstName,
        lastName,
        role,
        password: await hashPassword(password),
        isActive,
        createdAt: new Date().toISOString().split('T')[0],
      }
      staffUsers.push(newUser)
      try {
        await persistStaffUsersNowAsync()
      } catch (saveError) {
        const idx = staffUsers.findIndex((u) => u.id === newUser.id)
        if (idx >= 0) staffUsers.splice(idx, 1)
        const detail = saveError instanceof Error ? saveError.message : 'Unknown error'
        setError(`User could not be saved to the database: ${detail}`)
        return
      }
      navigate(`/hms/administration/users/${newUser.id}`)
    } catch {
      setError('Could not create user. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['user_management']}>
      <PageMetaData title="Add User" />
      <PageHeader
        title="Add User"
        subtitle="Full name, role, username, and secure password"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'User Management', href: '/hms/administration/users' },
          { label: 'Add User' },
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
                    placeholder="e.g. Ahmed Hassan"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    {USER_ROLES.filter((r) => r !== 'admin').map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="login username or email"
                    required
                  />
                  <Form.Text className="text-muted">
                    Email for login: {username.trim() ? staffEmailFromUsername(username) : '—'}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, letter + number"
                    required
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
                {saving ? 'Creating…' : 'Create User'}
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

export default UserCreatePage
