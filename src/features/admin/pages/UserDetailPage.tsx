import { Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { currency } from '@/context/constants'
import { getStaffById } from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const user = id ? getStaffById(id) : undefined

  if (!user || user.role === 'emergency') {
    return (
      <PermissionGuard permissions={['user_management']}>
        <PageMetaData title="User Not Found" />
        <div className="alert alert-warning">User not found.</div>
        <Link to="/hms/administration/users">Back to Users</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['user_management']}>
      <PageMetaData title={`User: ${user.username}`} />
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        subtitle={user.email}
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Users', href: '/hms/administration/users' },
          { label: user.username },
        ]}
        actionLabel="Edit User"
        actionHref={`/hms/administration/users/${user.id}/edit`}
      />
      <Card>
        <CardBody>
          <Row>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Username</p>
              <p className="fw-medium mb-0">{user.username}</p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Email</p>
              <p className="fw-medium mb-0">{user.email}</p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Role</p>
              <p className="fw-medium mb-0">{ROLE_LABELS[user.role]}</p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Phone</p>
              <p className="fw-medium mb-0">{user.phone ?? '—'}</p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">
                {user.role === 'doctor' ? 'Consultation Fee' : user.role === 'reception_cashier' ? 'Registration Fee' : 'Service Fee'}
              </p>
              <p className="fw-medium mb-0">
                {user.serviceFee != null ? `${currency}${user.serviceFee.toLocaleString()}` : '—'}
              </p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Status</p>
              <StatusBadge status={user.isActive ? 'Active' : 'Cancelled'} />
            </Col>
            <Col md={6} className="mb-3">
              <p className="text-muted mb-1">Created</p>
              <p className="fw-medium mb-0">{user.createdAt}</p>
            </Col>
          </Row>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default UserDetailPage
