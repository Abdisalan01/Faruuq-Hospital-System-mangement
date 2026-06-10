import { Card, CardBody, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { ROLE_LABELS, ROLE_PERMISSIONS, USER_ROLES } from '@/shared/types/roles'

export const RolesPage = () => (
  <PermissionGuard permissions={['user_management']}>
    <PageMetaData title="Roles" />
    <PageHeader title="System Roles" breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]} />
    <Card>
      <CardBody className="p-0">
        <div className="table-responsive">
          <Table className="mb-0">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th>Role ID</th>
                <th>Role Name</th>
                <th>Permissions Count</th>
              </tr>
            </thead>
            <tbody>
              {USER_ROLES.map((role) => (
                <tr key={role}>
                  <td>
                    <code>{role}</code>
                  </td>
                  <td>{ROLE_LABELS[role]}</td>
                  <td>{ROLE_PERMISSIONS[role].length}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardBody>
    </Card>
  </PermissionGuard>
)

export const PermissionsPage = () => (
  <PermissionGuard permissions={['user_management']}>
    <PageMetaData title="Permissions" />
    <PageHeader title="Role Permissions" breadcrumbs={[{ label: 'Administration' }, { label: 'Permissions' }]} />
    <Card>
      <CardBody className="p-0">
        <div className="table-responsive">
          <Table className="mb-0">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th>Role</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {USER_ROLES.map((role) => (
                <tr key={role}>
                  <td className="fw-medium">{ROLE_LABELS[role]}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {ROLE_PERMISSIONS[role].map((p) => (
                        <span key={p} className="badge badge-soft-primary">
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))}
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
