import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  completeSurgeryRequest,
  getActiveAdmissionForVisit,
  getDoctorSurgeryStatusLabel,
  getPatientById,
  getSurgeriesForDoctor,
  getSurgeryById,
  getSurgeryRequestFee,
  isSurgeryFeePaid,
  persistSurgeryFeePaymentNowAsync,
  surgeryRequests,
} from '@/shared/services/hmsStore'
import type { SurgeryRequest } from '@/shared/types'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

const PAGE_SIZE = 10

type SurgeryFilter = 'waiting_payment' | 'scheduled' | 'completed'

const matchesDoctorSurgeryFilter = (req: SurgeryRequest, filter: SurgeryFilter): boolean => {
  if (filter === 'completed') return req.status === 'Completed'
  if (filter === 'scheduled') return req.status === 'Scheduled'
  return req.status !== 'Scheduled' && req.status !== 'Completed'
}

const statusBadgeVariant = (label: string): string => {
  if (label === 'Completed') return 'success'
  if (label === 'Scheduled') return 'primary'
  if (label === 'Paid — Awaiting Schedule') return 'info'
  if (label === 'Credit Book — Awaiting Schedule') return 'info'
  if (label === 'Credit Book — Pending') return 'warning'
  if (label === 'Inpatient Cash — Awaiting Payment') return 'warning'
  if (label === 'Awaiting Book Entry') return 'warning'
  if (label === 'Awaiting Payment') return 'danger'
  return 'secondary'
}

const DoctorSurgeryPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const doctorId = user?.id ?? 'staff-003'

  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SurgeryFilter>('waiting_payment')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')

  const mySurgeries = useMemo(
    () =>
      getSurgeriesForDoctor(doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [doctorId, surgeryRequests.length, tick, dataVersion],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return mySurgeries.filter((req) => {
      if (!matchesDoctorSurgeryFilter(req, statusFilter)) return false

      if (!q) return true
      const label = getDoctorSurgeryStatusLabel(req)
      const patient = getPatientById(req.patientId)
      const adm = getActiveAdmissionForVisit(req.visitId)
      const onCreditBook = adm?.billingMode === 'credit_book' && adm.bookOpen
      const hay = [
        req.requestNumber,
        req.surgeryName,
        patient?.fullName,
        patient?.id,
        label,
        onCreditBook ? 'credit book' : '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [mySurgeries, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  const handleMarkCompleted = async (requestId: string) => {
    setActionError('')
    try {
      completeSurgeryRequest(requestId, doctorId)
      const req = surgeryRequests.find((r) => r.id === requestId)
      if (req) refreshVisitWorkflow(req.visitId)
      if (isSupabase) await persistSurgeryFeePaymentNowAsync()
      refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark surgery completed')
    }
  }

  return (
    <PermissionGuard permissions={['surgery_requests']}>
      <PageMetaData title="Surgery" />
      <PageHeader
        title="Surgery"
        subtitle="Your surgery requests — payment at reception, then scheduling"
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'Surgery' },
        ]}
      />

      <Card className="mb-3 border-0 bg-light">
        <CardBody className="py-3">
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search patient, request #, surgery..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['waiting_payment', 'Waiting Payment'],
                    ['scheduled', 'Scheduled'],
                    ['completed', 'Completed'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {actionError && (
        <Alert variant="danger" dismissible onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody className="small text-muted">
          <strong>Workflow:</strong> Submit from consultation → reception collects fee (or charges
          inpatient account) &amp; schedules → after procedure, you mark <strong>Completed</strong> →
          then order in-patient or release the patient from consultation.
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Request #</th>
                  <th>Patient</th>
                  <th>Surgery</th>
                  <th>Category</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No surgery requests match your filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    const label = getDoctorSurgeryStatusLabel(req)
                    const adm = getActiveAdmissionForVisit(req.visitId)
                    const fee = getSurgeryRequestFee(req)
                    const catalog = getSurgeryById(req.surgeryCatalogId)

                    return (
                      <tr key={req.id}>
                        <td className="fw-medium">{req.requestNumber}</td>
                        <td>
                          {patient?.fullName ?? '—'}
                          <br />
                          <small className="text-muted">{patient?.id}</small>
                          {adm && (
                            <>
                              <br />
                              <Badge bg="info-subtle" text="info" className="mt-1">
                                Inpatient
                                {adm.billingMode === 'credit_book' ? ' · Book' : ' · Cash'}
                              </Badge>
                            </>
                          )}
                        </td>
                        <td>
                          {req.surgeryName}
                          {req.notes && (
                            <div className="small text-muted mt-1">{req.notes}</div>
                          )}
                        </td>
                        <td className="small">
                          {catalog?.category ?? '—'}
                          {catalog?.riskLevel && (
                            <div className="text-muted">{catalog.riskLevel} risk</div>
                          )}
                        </td>
                        <td>
                          {currency}
                          {fee}
                        </td>
                        <td>
                          <Badge bg={`${statusBadgeVariant(label)}-subtle`} text={statusBadgeVariant(label)}>
                            {label}
                          </Badge>
                          {req.status !== 'Pending' && req.status !== label && (
                            <div className="mt-1">
                              <StatusBadge status={req.status} />
                            </div>
                          )}
                        </td>
                        <td className="small">{req.scheduledDate ?? '—'}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {req.status === 'Scheduled' && (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => void handleMarkCompleted(req.id)}
                              >
                                Mark Completed
                              </Button>
                            )}
                            <Link
                              to={`/hms/doctor/consultation/${req.visitId}?tab=surgery`}
                              className="btn btn-sm btn-soft-primary"
                            >
                              {isSurgeryFeePaid(req) && req.status !== 'Pending' ? 'View' : 'Open Consultation'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
            <p className="text-muted small mb-0">
              {filtered.length === 0
                ? 'Showing 0 records'
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <IconifyIcon icon="solar:alt-arrow-left-broken" className="me-1" />
                Prev
              </Button>
              <span className="align-self-center small text-muted">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <IconifyIcon icon="solar:alt-arrow-right-broken" className="ms-1" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="text-end">
        <Link to="/hms/doctor/patients" className="btn btn-primary">
          <IconifyIcon icon="solar:users-group-rounded-broken" className="me-1" />
          All Patients — start consultation
        </Link>
      </div>
    </PermissionGuard>
  )
}

export default DoctorSurgeryPage
