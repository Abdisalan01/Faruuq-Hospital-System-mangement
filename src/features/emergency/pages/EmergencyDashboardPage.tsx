import PageMetaData from '@/components/PageTitle'
import { Row, Col, Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import type { EmergencySeverity } from '@/shared/types'
import { emergencyCases, getPatientById } from '@/shared/services/hmsStore'

const SEVERITIES: EmergencySeverity[] = ['Critical', 'Urgent', 'Stable', 'Minor']

const EmergencyDashboardPage = () => {
  const activeCases = emergencyCases.filter((c) => c.status === 'Active')

  const countBySeverity = (severity: EmergencySeverity) =>
    activeCases.filter((c) => c.severity === severity).length

  return (
    <PermissionGuard permissions={['emergency_registration', 'triage', 'emergency_treatment']}>
      <PageMetaData title="Emergency Dashboard" />
      <PageHeader
        title="Emergency Dashboard"
        subtitle="Active emergency cases overview"
        actionLabel="Register Case"
        actionHref="/hms/emergency/cases/create"
        actionIcon="solar:ambulance-broken"
      />

      <Row>
        <StatCard
          title="Active Cases"
          value={activeCases.length}
          icon="solar:ambulance-broken"
          variant="danger"
          link="/hms/emergency/cases"
        />
        <StatCard title="Critical" value={countBySeverity('Critical')} icon="solar:danger-broken" variant="danger" />
        <StatCard title="Urgent" value={countBySeverity('Urgent')} icon="solar:bell-broken" variant="warning" />
        <StatCard title="Stable / Minor" value={countBySeverity('Stable') + countBySeverity('Minor')} icon="solar:heart-pulse-broken" variant="success" />
      </Row>

      <Row className="mt-3">
        {SEVERITIES.map((severity) => {
          const cases = activeCases.filter((c) => c.severity === severity)
          return (
            <Col key={severity} lg={6} className="mb-3">
              <Card>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">
                      <StatusBadge status={severity} /> Cases
                    </h5>
                    <span className="badge bg-light text-dark">{cases.length}</span>
                  </div>
                  {cases.length === 0 ? (
                    <p className="text-muted mb-0">No {severity.toLowerCase()} cases</p>
                  ) : (
                    <div className="table-responsive">
                      <Table size="sm" className="mb-0">
                        <thead>
                          <tr>
                            <th>EMG #</th>
                            <th>Patient</th>
                            <th>Arrival</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cases.map((c) => {
                            const patient = getPatientById(c.patientId)
                            return (
                              <tr key={c.id}>
                                <td>{c.emgNumber}</td>
                                <td>{patient?.fullName ?? 'Unknown'}</td>
                                <td>{new Date(c.arrivalTime).toLocaleString()}</td>
                                <td>
                                  <Link to={`/hms/emergency/cases/${c.id}`} className="btn btn-sm btn-soft-primary">
                                    View
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          )
        })}
      </Row>
    </PermissionGuard>
  )
}

export default EmergencyDashboardPage
