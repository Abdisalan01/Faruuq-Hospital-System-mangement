import { useMemo } from 'react'
import { Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { emergencyCases, getPatientById } from '@/shared/services/hmsStore'

const EmergencyQueuePage = () => {
  const activeCases = useMemo(
    () => emergencyCases.filter((e) => e.status === 'Active'),
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
  } = useTablePagination(activeCases)

  return (
    <PermissionGuard permissions={['triage', 'emergency_registration']}>
      <PageMetaData title="Emergency Queue" />
      <PageHeader title="Emergency Queue" breadcrumbs={[{ label: 'Emergency' }, { label: 'Queue' }]} />
      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>EMG #</th>
                  <th>Patient</th>
                  <th>Severity</th>
                  <th>Arrival</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No active emergency cases
                    </td>
                  </tr>
                ) : (
                  pageItems.map((c) => (
                    <tr key={c.id}>
                      <td>{c.emgNumber}</td>
                      <td>{getPatientById(c.patientId)?.fullName}</td>
                      <td>
                        <StatusBadge status={c.severity} />
                      </td>
                      <td>{new Date(c.arrivalTime).toLocaleString()}</td>
                      <td>
                        <Link to={`/hms/emergency/consultation/${c.id}`} className="btn btn-sm btn-soft-danger">
                          Treat
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          <div className="p-3 border-top">
            <TablePagination
              totalItems={totalItems}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              safePage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default EmergencyQueuePage
