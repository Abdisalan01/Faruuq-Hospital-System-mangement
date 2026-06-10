import PageMetaData from '@/components/PageTitle'
import { Row, Col, Card, CardBody, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  admissions,
  beds,
  doctorOrders,
  getPatientById,
  wards,
  rooms,
} from '@/shared/services/hmsStore'

const NurseDashboardPage = () => {
  const activeAdmissions = admissions.filter((a) => a.status === 'Active')
  const occupiedBeds = beds.filter((b) => b.isOccupied).length
  const totalBeds = beds.length
  const medicationsDue = doctorOrders.filter(
    (o) => o.status === 'Pending' || o.status === 'Pharmacy Approved' || o.status === 'Delivered',
  ).length

  return (
    <PermissionGuard permissions={['manage_admitted_patients', 'view_rooms_beds']}>
      <PageMetaData title="Nursing Dashboard" />
      <PageHeader title="Nursing Dashboard" subtitle="Overview of admitted patients and ward status" />

      <Row>
        <StatCard
          title="Admitted Patients"
          value={activeAdmissions.length}
          icon="solar:bed-broken"
          variant="primary"
          link="/hms/inpatient/all"
        />
        <StatCard
          title="Bed Occupancy"
          value={`${occupiedBeds}/${totalBeds}`}
          icon="solar:home-2-broken"
          variant="info"
          link="/hms/inpatient/all"
        />
        <StatCard
          title="Medications Due"
          value={medicationsDue}
          icon="solar:pill-broken"
          variant="warning"
          link="/hms/inpatient/all"
        />
        <StatCard
          title="Available Beds"
          value={totalBeds - occupiedBeds}
          icon="solar:check-circle-broken"
          variant="success"
          link="/hms/inpatient/all"
        />
      </Row>

      <Row className="mt-3">
        <Col lg={8}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Currently Admitted Patients</h5>
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Patient</th>
                      <th>Ward / Room</th>
                      <th>Bed</th>
                      <th>Admitted</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAdmissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No active admissions
                        </td>
                      </tr>
                    ) : (
                      activeAdmissions.map((adm) => {
                        const patient = getPatientById(adm.patientId)
                        const ward = wards.find((w) => w.id === adm.wardId)
                        const room = rooms.find((r) => r.id === adm.roomId)
                        const bed = beds.find((b) => b.id === adm.bedId)
                        return (
                          <tr key={adm.id}>
                            <td>{patient?.fullName ?? 'Unknown'}</td>
                            <td>
                              {ward?.name} / {room?.name}
                            </td>
                            <td>{bed?.bedNumber ?? '—'}</td>
                            <td>{adm.admittedAt}</td>
                            <td>
                              <StatusBadge status={adm.status} />
                            </td>
                            <td>
                              <Link to="/hms/inpatient/all" className="btn btn-sm btn-soft-primary">
                                View
                              </Link>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col lg={4}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Ward Occupancy</h5>
              {wards.map((ward) => {
                const wardBeds = beds.filter((b) => b.wardId === ward.id)
                const occupied = wardBeds.filter((b) => b.isOccupied).length
                const pct = wardBeds.length ? Math.round((occupied / wardBeds.length) * 100) : 0
                return (
                  <div key={ward.id} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>{ward.name}</span>
                      <span className="text-muted">
                        {occupied}/{wardBeds.length}
                      </span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </PermissionGuard>
  )
}

export default NurseDashboardPage
