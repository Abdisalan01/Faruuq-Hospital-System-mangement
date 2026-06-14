import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { getLoggedInStaffId } from '@/features/doctor/utils/doctorContext'
import {
  getDoctorPatientQueue,
  getPatientById,
  getStaffById,
  persistReleasePatientNowAsync,
} from '@/shared/services/hmsStore'
import {
  canDoctorReleasePatient,
  confirmDoctorPatientRelease,
  getDoctorQueuePatientStatus,
  isDoctorQueuePatientActive,
} from '@/shared/utils/visitConsultation'

const PAGE_SIZE = 10

type PatientStatusFilter = 'all' | 'in_care' | 'inactive' | 'waiting'

const STATUS_FILTERS: { key: PatientStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_care', label: 'Active (waiting + in care)' },
  { key: 'inactive', label: 'Inactive (released)' },
  { key: 'waiting', label: 'Waiting only' },
]

const DoctorAllPatientsPage = () => {
  const { user } = useAuthContext()
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const doctorId = user?.id ?? getLoggedInStaffId()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const doctorQueue = useMemo(
    () => (doctorId ? getDoctorPatientQueue(doctorId) : []),
    [doctorId, dataVersion, tick],
  )

  const doctorName = useMemo(() => {
    const staff = getStaffById(doctorId)
    if (!staff) return 'your account'
    return staff.role === 'emergency' ? 'Emergency' : `Dr. ${staff.firstName} ${staff.lastName}`
  }, [doctorId, dataVersion])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    return doctorQueue.filter((visit) => {
      const patient = getPatientById(visit.patientId)

      if (q) {
        const hay = `${patient?.fullName ?? ''} ${patient?.phone ?? ''} ${patient?.id ?? ''} ${visit.visitNumber}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      const careStatus = getDoctorQueuePatientStatus(visit, getPatientById(visit.patientId))
      if (statusFilter === 'in_care') {
        return isDoctorQueuePatientActive(visit, getPatientById(visit.patientId))
      }
      if (statusFilter === 'inactive') return careStatus === 'Inactive'
      if (statusFilter === 'waiting') return careStatus === 'Waiting'
      return true
    })
  }, [doctorQueue, search, statusFilter, tick])

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

  const handleRelease = async (visitId: string) => {
    const result = confirmDoctorPatientRelease(visitId)
    if (!result.ok) {
      setMessage(result.error ?? 'Could not release patient')
      return
    }
    try {
      if (isSupabase) {
        await persistReleasePatientNowAsync(visitId)
      }
      setMessage(
        isSupabase
          ? 'Patient released — visit Completed, status Inactive. Saved to database.'
          : 'Patient released — visit Completed, status Inactive.',
      )
      refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Released locally but database save failed')
      refresh()
    }
    setTimeout(() => setMessage(''), 4000)
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['view_assigned_patients']}>
      <PageMetaData title="All Patients" />
      <PageHeader
        title="All Patients"
        subtitle={`Today's patients and open visits assigned to ${doctorName}`}
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'All Patients' },
        ]}
      />

      {!doctorId && (
        <Alert variant="warning" className="py-2">
          Please sign in again to load your assigned patients.
        </Alert>
      )}

      {doctorId && doctorQueue.length === 0 && !search && statusFilter === 'all' && (
        <Alert variant="info" className="py-2">
          No patients in your queue yet. Reception must <strong>Register Patient</strong> and select{' '}
          <strong>{doctorName}</strong> as the referred doctor — then the patient appears here.
        </Alert>
      )}

      {message && (
        <Alert variant="info" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search name, phone, patient ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {STATUS_FILTERS.map(({ key, label }) => (
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

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient #</th>
                  <th>Patient ID</th>
                  <th>Patient</th>
                  <th>Patient Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No patients match your filters
                    </td>
                  </tr>
                ) : (
                  pageItems.map((visit) => {
                    const patient = getPatientById(visit.patientId)
                    const careStatus = getDoctorQueuePatientStatus(visit, patient)
                    const isInactive = careStatus === 'Inactive'
                    const canRelease =
                      !['Completed', 'Cancelled', 'Waiting'].includes(visit.status) &&
                      canDoctorReleasePatient(visit.id).ok

                    return (
                      <tr key={visit.id}>
                        <td className="fw-bold">{visit.patientNumber ?? visit.queueNumber}</td>
                        <td>{patient?.id ?? '—'}</td>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td>
                          <StatusBadge status={careStatus} />
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            <Link to={`/hms/doctor/consultation/${visit.id}`}>
                              <Button
                                size="sm"
                                variant={isInactive ? 'outline-primary' : 'primary'}
                                title={
                                  isInactive
                                    ? 'View consultation history (patient released)'
                                    : 'Open consultation'
                                }
                              >
                                <IconifyIcon icon="solar:stethoscope-broken" className="me-1" />
                                Consult
                              </Button>
                            </Link>
                            {canRelease && (
                              <Button size="sm" variant="success" onClick={() => handleRelease(visit.id)}>
                                <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                                Release
                              </Button>
                            )}
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
                ? 'Showing 0 patients'
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
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
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default DoctorAllPatientsPage
