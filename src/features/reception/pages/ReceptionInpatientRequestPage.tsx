import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  Modal,
  Row,
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  admissionRequests as storeRequests,
  assignAdmissionRequest,
  beds,
  ensureAdmissionForAssignedRequest,
  getAdmissionForRequest,
  getAvailableBedCountInRoom,
  getPatientById,
  admissionRequests as allRequests,
  getRoomById,
  getStaffById,
  getVisitById,
  rooms,
  updateInpatientRoomBedByAdmission,
  persistAdmissionAssignmentNowAsync,
} from '@/shared/services/hmsStore'
import type { AdmissionRequest } from '@/shared/types'
import InpatientChargesSection from '@/features/reception/components/InpatientChargesSection'
import InpatientRoomBedFields from '@/features/reception/components/InpatientRoomBedFields'
import { isReceptionAdmissionVisible, refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

type ReqFilter = 'all' | 'pending' | 'assigned'

const PAGE_SIZE = 10

const ReceptionInpatientRequestPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const receptionId = user?.id ?? 'staff-002'
  const userRole = user?.role ?? 'reception_cashier'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ReqFilter>('pending')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdmissionRequest | null>(null)
  const [roomId, setRoomId] = useState('')
  const [bedId, setBedId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isEditMode = selected?.status === 'Assigned'

  const admissionSyncKey = useMemo(
    () =>
      storeRequests
        .map((r) => {
          const visit = getVisitById(r.visitId)
          return `${r.id}:${r.status}:${r.lastModifiedAt ?? ''}:${visit?.status ?? ''}`
        })
        .join('|'),
    [dataVersion, storeRequests.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const source = allRequests.filter((req) => {
      if (!isReceptionAdmissionVisible(req)) return false
      if (filter === 'pending') return req.status === 'Pending'
      if (filter === 'assigned') return req.status === 'Assigned'
      return req.status === 'Pending' || req.status === 'Assigned'
    })
    return source.filter((req) => {
      const patient = getPatientById(req.patientId)
      const doctor = getStaffById(req.doctorId)
      if (!q) return true
      const hay = [
        req.patientId,
        patient?.fullName,
        patient?.phone,
        doctor ? `dr ${doctor.firstName} ${doctor.lastName}` : '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [search, filter, admissionSyncKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, filter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  const patient = selected ? getPatientById(selected.patientId) : undefined
  const doctor = selected ? getStaffById(selected.doctorId) : undefined
  const activeAdmission = selected ? getAdmissionForRequest(selected) : undefined
  const excludeAdmissionId = activeAdmission?.id
  const currentBedId = selected?.bedId ?? activeAdmission?.bedId

  const openRequest = (req: AdmissionRequest) => {
    setSelected(req)
    setError('')
    if (req.status === 'Assigned' && req.roomId && req.bedId) {
      setRoomId(req.roomId)
      setBedId(req.bedId)
    } else {
      const firstWithBeds = rooms.find((r) => getAvailableBedCountInRoom(r.id) > 0)
      setRoomId(firstWithBeds?.id ?? '')
      setBedId('')
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !roomId || !bedId) {
      setError('Select room and bed.')
      return
    }

    if (isEditMode) {
      const adm =
        ensureAdmissionForAssignedRequest(selected) ?? getAdmissionForRequest(selected)
      if (!adm) {
        setError('Active admission not found for this patient.')
        return
      }
      const result = updateInpatientRoomBedByAdmission(adm.id, roomId, bedId)
      if (!result.ok) {
        setError(result.error ?? 'Could not update assignment.')
        return
      }
      if (result.admission) refreshVisitWorkflow(result.admission.visitId)
      try {
        if (isSupabase) await persistAdmissionAssignmentNowAsync()
        setSuccess(`${patient?.fullName} — room/bed updated. Saved to database.`)
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Updated locally but database save failed.')
      }
      setSelected(null)
      return
    }

    try {
      const admission = assignAdmissionRequest(selected.id, roomId, bedId, receptionId)
      refreshVisitWorkflow(admission.visitId)
      if (isSupabase) await persistAdmissionAssignmentNowAsync()
      setFilter('assigned')
      setSuccess(
        `${patient?.fullName} — status Assigned. Room & bed saved. See All Inpatients.`,
      )
      setSelected(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const getStatusBadge = (status: AdmissionRequest['status']) => {
    if (status === 'Assigned') {
      return <Badge bg="success-subtle" text="success">Assigned</Badge>
    }
    if (status === 'Pending') {
      return <Badge bg="warning-subtle" text="warning">Pending</Badge>
    }
    return <Badge bg="secondary-subtle" text="secondary">{status}</Badge>
  }

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title="In Patient Request" />
      <PageHeader
        title="In Patient Request"
        subtitle="Assign room and bed — edit patients already admitted"
        breadcrumbs={[
          { label: 'Reception', href: '/hms/dashboard' },
          { label: 'In Patient Request' },
        ]}
      />

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search patient ID, name, phone, doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['assigned', 'Assigned'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setFilter(key)}
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
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Phone</th>
                  <th>Dr</th>
                  <th>Room / Bed</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No requests match your search
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const p = getPatientById(req.patientId)
                    const d = getStaffById(req.doctorId)
                    const room = req.roomId ? getRoomById(req.roomId) : undefined
                    const bed = req.bedId ? beds.find((b) => b.id === req.bedId) : undefined
                    return (
                      <tr key={req.id}>
                        <td className="fw-medium">{req.patientId}</td>
                        <td>{p?.fullName ?? '—'}</td>
                        <td>{p?.phone ?? '—'}</td>
                        <td>{d ? `Dr. ${d.firstName} ${d.lastName}` : '—'}</td>
                        <td>
                          {req.status === 'Assigned' && room && bed ? (
                            <span>
                              {room.name} · {bed.bedNumber}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{getStatusBadge(req.status)}</td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant={req.status === 'Assigned' ? 'outline-primary' : 'primary'}
                            onClick={() => openRequest(req)}
                          >
                            {req.status === 'Assigned' ? 'Edit Room & Bed' : 'Assign Room & Bed'}
                          </Button>
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

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditMode ? 'Edit Room & Bed' : 'Assign Room & Bed'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAssign}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            {isEditMode && (
              <Alert variant="info" className="py-2 small">
                This patient is already admitted. You can change room or bed below.
              </Alert>
            )}

            {patient && (
              <Card className="mb-3 bg-light border-0">
                <CardBody className="py-3">
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-muted">Patient ID</span>
                      <p className="fw-semibold mb-0">{patient.id}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Name</span>
                      <p className="fw-semibold mb-0">{patient.fullName}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Phone</span>
                      <p className="mb-0">{patient.phone}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Doctor</span>
                      <p className="mb-0">
                        {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'}
                      </p>
                    </Col>
                    <Col xs={12}>
                      <span className="text-muted">Reason</span>
                      <p className="mb-0">{selected?.reason}</p>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            )}

            <InpatientRoomBedFields
              roomId={roomId}
              bedId={bedId}
              onRoomChange={setRoomId}
              onBedChange={setBedId}
              isEditMode={isEditMode}
              excludeAdmissionId={excludeAdmissionId}
              currentBedId={currentBedId}
            />

            {isEditMode && activeAdmission && (
              <InpatientChargesSection
                admissionId={activeAdmission.id}
                receptionId={receptionId}
                userRole={userRole}
                isSupabase={isSupabase}
                dataVersion={dataVersion}
                onRefresh={() => {}}
                compact
                showDiscount={false}
              />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={!roomId || !bedId}>
              <IconifyIcon icon="solar:bed-broken" className="me-1" />
              {isEditMode ? 'Save changes' : 'Save — Assign'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </PermissionGuard>
  )
}

export default ReceptionInpatientRequestPage
