import { useMemo } from 'react'
import { Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { getPatientCareDisplayStatusFromPatient } from '@/shared/utils/visitConsultation'
import {
  getDepartmentById,
  getPatientAccount,
  getPatientById,
  getStaffById,
  visits,
} from '@/shared/services/hmsStore'

const PatientDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const patient = id ? getPatientById(id) : undefined
  const account = patient ? getPatientAccount(patient.id) : undefined
  const patientVisits = useMemo(
    () => (patient ? visits.filter((v) => v.patientId === patient.id) : []),
    [patient?.id, visits.length],
  )

  const {
    pageItems: visitPageItems,
    setPage: setVisitPage,
    safePage: visitPage,
    totalPages: visitTotalPages,
    rangeStart: visitRangeStart,
    rangeEnd: visitRangeEnd,
    totalItems: visitTotalItems,
  } = useTablePagination(patientVisits, 10, [patientVisits.length, patient?.id])

  if (!patient) {
    return (
      <PermissionGuard permissions={['register_patients']}>
        <PageMetaData title="Patient Not Found" />
        <div className="alert alert-warning">Patient not found.</div>
        <Link to="/hms/patients">Back to Patients</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title={`Patient: ${patient.fullName}`} />
      <PageHeader
        title={patient.fullName}
        subtitle={`Registered ${patient.createdAt}`}
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: 'All Patients', href: '/hms/patients' },
          { label: patient.fullName },
        ]}
        actionLabel="Edit Patient"
        actionHref={`/hms/patients/${patient.id}/edit`}>
        <Link to={`/hms/patients/${patient.id}/history`} className="btn btn-soft-info">
          Patient History
        </Link>
      </PageHeader>
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Patient Information</h5>
              <Row>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Gender</p>
                  <p className="fw-medium mb-0">{patient.gender}</p>
                </Col>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Age</p>
                  <p className="fw-medium mb-0">{patient.age}</p>
                </Col>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Phone</p>
                  <p className="fw-medium mb-0">{patient.phone}</p>
                </Col>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Patient Status</p>
                  <StatusBadge status={getPatientCareDisplayStatusFromPatient(patient)} />
                </Col>
                <Col md={6} className="mb-3">
                  <p className="text-muted mb-1">Payment Type</p>
                  <StatusBadge status={patient.paymentType} />
                </Col>
                <Col md={12} className="mb-0">
                  <p className="text-muted mb-1">Address</p>
                  <p className="mb-0">{patient.address}</p>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
        {patient.paymentType === 'credit' && account && (
          <Col md={6}>
            <Card className="mb-3">
              <CardBody>
                <h5 className="mb-3">Credit Account</h5>
                <p className="text-muted mb-1">Outstanding Balance</p>
                <h4 className="text-warning mb-0">{currency}{account.outstandingBalance.toFixed(2)}</h4>
                <Link to="/hms/reception/credit-accounts" className="btn btn-sm btn-soft-warning mt-3">
                  Manage Credit
                </Link>
              </CardBody>
            </Card>
          </Col>
        )}
      </Row>
      <Card>
        <CardBody>
          <h5 className="mb-3">Registration History ({patientVisits.length})</h5>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Date</th>
                  <th>Patient #</th>
                  <th>Doctor</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {patientVisits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      No registrations recorded
                    </td>
                  </tr>
                ) : (
                  visitPageItems.map((visit) => {
                    const doctor = getStaffById(visit.assignedDoctorId)
                    const dept = getDepartmentById(visit.departmentId)
                    const doctorLabel = visit.isEmergency
                      ? 'Emergency'
                      : doctor
                        ? `Dr. ${doctor.firstName} ${doctor.lastName}`
                        : '—'
                    return (
                      <tr key={visit.id}>
                        <td>{visit.visitDate}</td>
                        <td className="fw-medium">#{visit.patientNumber ?? visit.queueNumber}</td>
                        <td>{doctorLabel}</td>
                        <td>{dept?.name ?? '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={visitTotalItems}
            rangeStart={visitRangeStart}
            rangeEnd={visitRangeEnd}
            safePage={visitPage}
            totalPages={visitTotalPages}
            onPageChange={setVisitPage}
          />
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default PatientDetailPage
