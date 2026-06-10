import { Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { emergencyCases, getPatientById } from '@/shared/services/hmsStore'

const EmergencyQueuePage = () => {
  const activeCases = emergencyCases.filter((e) => e.status === 'Active')

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
                {activeCases.map((c) => (
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
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default EmergencyQueuePage
