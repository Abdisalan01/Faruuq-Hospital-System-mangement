import { Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { departments } from '@/shared/services/hmsStore'

const DepartmentsListPage = () => {
  return (
    <PermissionGuard permissions={['department_management']}>
      <PageMetaData title="Departments" />
      <PageHeader
        title="Departments"
        subtitle="Hospital departments and units"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Departments' },
        ]}
        actionLabel="Add Department"
        actionHref="/hms/administration/departments/create"
      />
      <Card>
        <CardBody>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <Link to={`/hms/administration/departments/${dept.id}`} className="fw-medium">
                        {dept.name}
                      </Link>
                    </td>
                    <td>{dept.description}</td>
                    <td>
                      <StatusBadge status={dept.isActive ? 'Active' : 'Cancelled'} />
                    </td>
                    <td>{dept.createdAt}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <Link to={`/hms/administration/departments/${dept.id}`} className="btn btn-sm btn-soft-primary">
                          <IconifyIcon icon="solar:eye-broken" />
                        </Link>
                        <Link to={`/hms/administration/departments/${dept.id}/edit`} className="btn btn-sm btn-soft-success">
                          <IconifyIcon icon="solar:pen-broken" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default DepartmentsListPage
