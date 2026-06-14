import { useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Modal, Table } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { persistStaffUsersNowAsync, removeStaffUser, staffUsers } from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'
import type { StaffUser } from '@/shared/types'

const UsersListPage = () => {
  const { dataVersion } = useHmsStoreContext()
  const location = useLocation()

  const [message, setMessage] = useState(
    (location.state as { message?: string } | null)?.message ?? '',
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [userToDelete, setUserToDelete] = useState<StaffUser | null>(null)

  const visibleUsers = useMemo(
    () => staffUsers.filter((user) => user.role !== 'emergency'),
    [dataVersion, staffUsers.length],
  )

  const {
    pageItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useTablePagination(visibleUsers, 10, [visibleUsers.length, dataVersion])

  const handleDelete = async () => {
    if (!userToDelete) return
    setError('')
    setMessage('')
    setDeleting(true)
    try {
      const result = removeStaffUser(userToDelete.id)
      if (!result.ok) {
        setError(result.error ?? 'Could not delete user.')
        return
      }
      await persistStaffUsersNowAsync()
      setMessage(`User "${userToDelete.username}" deleted.`)
      setUserToDelete(null)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save deletion to database: ${detail}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PermissionGuard permissions={['user_management']}>
      <PageMetaData title="Staff Users" />
      <PageHeader
        title="Staff Users"
        subtitle="Manage hospital staff accounts"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Users' },
        ]}
        actionLabel="Add User"
        actionHref="/hms/administration/users/create"
      />

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2">
          {error}
        </Alert>
      )}

      <Card>
        <CardBody>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No users found. Click Add User to create staff accounts.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((user) => (
                    <tr key={user.id}>
                      <td className="fw-medium">{user.username}</td>
                      <td>
                        {user.firstName} {user.lastName}
                      </td>
                      <td>{user.email}</td>
                      <td>{ROLE_LABELS[user.role]}</td>
                      <td>
                        <StatusBadge status={user.isActive ? 'Active' : 'Cancelled'} />
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link
                            to={`/hms/administration/users/${user.id}/edit`}
                            className="btn btn-sm btn-soft-success"
                          >
                            <IconifyIcon icon="solar:pen-broken" />
                          </Link>
                          {user.id !== 'staff-001' && (
                            <Button
                              size="sm"
                              variant="soft-danger"
                              className="btn-soft-danger"
                              onClick={() => setUserToDelete(user)}
                            >
                              <IconifyIcon icon="solar:trash-bin-trash-broken" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            safePage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardBody>
      </Card>

      <Modal show={Boolean(userToDelete)} onHide={() => setUserToDelete(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete <strong>{userToDelete?.username}</strong> ({userToDelete?.firstName}{' '}
          {userToDelete?.lastName})? This cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setUserToDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete User'}
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default UsersListPage
