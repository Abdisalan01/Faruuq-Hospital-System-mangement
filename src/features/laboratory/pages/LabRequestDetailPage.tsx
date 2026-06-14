import { useMemo, useState } from 'react'
import { Button, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import A4PrintModal from '@/features/doctor/components/a4/A4PrintModal'
import LabResultReportA4 from '@/features/laboratory/components/LabResultReportA4'
import { buildLabResultReportData } from '@/features/laboratory/utils/labResultReport'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { getPatientById, getStaffById, getVisitById, labRequests } from '@/shared/services/hmsStore'
import type { LabResultReportData } from '@/features/laboratory/components/LabResultReportA4'

const LabRequestDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { dataVersion } = useHmsStoreContext()

  const request = useMemo(
    () => (id ? labRequests.find((l) => l.id === id) : undefined),
    [id, dataVersion, labRequests.length],
  )
  const patient = request ? getPatientById(request.patientId) : undefined
  const doctor = request ? getStaffById(request.doctorId) : undefined
  const visit = request ? getVisitById(request.visitId) : undefined

  const [printData, setPrintData] = useState<LabResultReportData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const openPrint = () => {
    if (!request) return
    const data = buildLabResultReportData(request)
    if (!data) return
    setPrintData(data)
    setShowPrintModal(true)
  }

  if (!request) {
    return (
      <PermissionGuard permissions={['view_lab_requests']}>
        <PageMetaData title="Lab Request" />
        <p className="text-danger">Lab request not found.</p>
        <Link to="/hms/laboratory/all">Back to list</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['view_lab_requests']}>
      <PageMetaData title={`Lab Request ${request.requestNumber}`} />
      <PageHeader
        title={`Lab Request ${request.requestNumber}`}
        subtitle={`Created ${new Date(request.createdAt).toLocaleString()}`}
        breadcrumbs={[
          { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
          { label: 'All Labs', href: '/hms/laboratory/all' },
          { label: request.requestNumber },
        ]}
      >
        {request.status === 'Completed' && (
          <Button variant="primary" onClick={openPrint}>
            <IconifyIcon icon="solar:printer-broken" className="me-1" />
            Print A4 Report
          </Button>
        )}
        {request.status !== 'Completed' && request.status !== 'Awaiting Payment' && (
          <Link to={`/hms/laboratory/requests/${request.id}/edit`} className="btn btn-primary">
            <IconifyIcon icon="solar:pen-broken" className="me-1" />
            Enter Results
          </Link>
        )}
      </PageHeader>

      <Row className="mb-3">
        <Col md={3}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Status</p>
              <StatusBadge status={request.status} />
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Patient</p>
              <h6 className="mb-0">{patient?.fullName ?? '—'}</h6>
              <small className="text-muted">
                {patient?.id} · {patient?.age} yrs · {patient?.gender}
              </small>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Requesting Doctor</p>
              <h6 className="mb-0">
                {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'}
              </h6>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Visit</p>
              <h6 className="mb-0">{visit?.visitNumber ?? '—'}</h6>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <h5 className="mb-3">Requested Tests</h5>
          <div className="table-responsive">
            <Table className="table-bordered mb-0">
              <thead className="table-light">
                <tr>
                  <th>Test Name</th>
                  <th>Result</th>
                  <th>Reference Value</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {request.tests.map((test, idx) => (
                  <tr key={idx}>
                    <td>{test.testName}</td>
                    <td className="fw-semibold">{test.result ?? '—'}</td>
                    <td>{test.referenceValue ?? '—'}</td>
                    <td>{test.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {request.completedAt && (
            <p className="text-muted mt-3 mb-0">
              Completed: {new Date(request.completedAt).toLocaleString()}
            </p>
          )}
        </CardBody>
      </Card>

      <A4PrintModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Laboratory Result — A4 / PDF"
      >
        {printData && <LabResultReportA4 data={printData} />}
      </A4PrintModal>
    </PermissionGuard>
  )
}

export default LabRequestDetailPage
