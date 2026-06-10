import { Card, CardBody, Col, Row } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { getDepartmentById, staffUsers } from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

const DepartmentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const dept = id ? getDepartmentById(id) : undefined
  const deptStaff = dept ? staffUsers.filter((s) => s.departmentId === dept.id) : []

  if (!dept) {
    return (
      <PermissionGuard permissions={['department_management']}>
        <PageMetaData title="Department Not Found" />
        <div className="alert alert-warning">Department not found.</div>
        <Link to="/hms/administration/departments">Back to Departments</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['department_management']}>
      <PageMetaData title={`Department: ${dept.name}`} />
      <PageHeader
        title={dept.name}
        subtitle={dept.description}
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Departments', href: '/hms/administration/departments' },
          { label: dept.name },
        ]}
        actionLabel="Edit Department"
        actionHref={`/hms/administration/departments/${dept.id}/edit`}
      />
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <CardBody>
              <Row>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Status</p>
                  <StatusBadge status={dept.isActive ? 'Active' : 'Cancelled'} />
                </Col>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Created</p>
                  <p className="fw-medium mb-0">{dept.createdAt}</p>
                </Col>
                <Col md={12}>
                  <p className="text-muted mb-1">Description</p>
                  <p className="mb-0">{dept.description}</p>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Assigned Staff ({deptStaff.length})</h5>
              {deptStaff.length === 0 ? (
                <p className="text-muted mb-0">No staff assigned to this department.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {deptStaff.map((s) => (
                    <li key={s.id} className="mb-2">
                      <Link to={`/hms/administration/users/${s.id}`} className="fw-medium">
                        {s.firstName} {s.lastName}
                      </Link>
                      <span className="text-muted ms-2">({ROLE_LABELS[s.role]})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </PermissionGuard>
  )
}

export default DepartmentDetailPage
