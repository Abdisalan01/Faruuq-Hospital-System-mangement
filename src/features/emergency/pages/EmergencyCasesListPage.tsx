import { useMemo } from 'react'
import PageMetaData from '@/components/PageTitle'
import { Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { emergencyCases, getPatientById } from '@/shared/services/hmsStore'

const EmergencyCasesListPage = () => {
  const sortedCases = useMemo(
    () =>
      [...emergencyCases].sort(
        (a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime(),
      ),
    [emergencyCases.length],
  )

  const {
    pageItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useTablePagination(sortedCases)

  return (
    <PermissionGuard permissions={['emergency_registration', 'triage']}>
      <PageMetaData title="Emergency Cases" />
      <PageHeader
        title="Emergency Cases"
        subtitle="All registered emergency cases"
        breadcrumbs={[
          { label: 'Emergency', href: '/hms/emergency/dashboard' },
          { label: 'Cases' },
        ]}
        actionLabel="Register Case"
        actionHref="/hms/emergency/cases/create"
        actionIcon="solar:ambulance-broken"
      />

      <Card>
        <CardBody>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>EMG Number</th>
                  <th>Patient</th>
                  <th>Severity</th>
                  <th>Arrival Time</th>
                  <th>Diagnosis</th>
                  <th>Outcome</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No emergency cases registered
                    </td>
                  </tr>
                ) : (
                  pageItems.map((c) => {
                    const patient = getPatientById(c.patientId)
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/hms/emergency/cases/${c.id}`} className="fw-medium">
                            {c.emgNumber}
                          </Link>
                        </td>
                        <td>{patient?.fullName ?? 'Unknown'}</td>
                        <td>
                          <StatusBadge status={c.severity} />
                        </td>
                        <td>{new Date(c.arrivalTime).toLocaleString()}</td>
                        <td>{c.diagnosis ?? '—'}</td>
                        <td>{c.outcome ?? '—'}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td>
                          <Link to={`/hms/emergency/cases/${c.id}`} className="btn btn-sm btn-soft-primary me-1">
                            View
                          </Link>
                          <Link to={`/hms/emergency/cases/${c.id}/edit`} className="btn btn-sm btn-soft-secondary">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })
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
    </PermissionGuard>
  )
}

export default EmergencyCasesListPage
