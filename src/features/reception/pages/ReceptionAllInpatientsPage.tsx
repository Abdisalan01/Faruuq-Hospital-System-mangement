import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import InpatientChargesSection from '@/features/reception/components/InpatientChargesSection'
import InpatientRoomBedFields from '@/features/reception/components/InpatientRoomBedFields'
import InpatientUnpaidAlertCards from '@/features/reception/components/InpatientUnpaidAlertCards'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import type {
  Admission,
  InpatientUnpaidAlert,
} from '@/shared/types'
import {
  admissions,
  beds,
  getAdmissionById,
  getAllInpatientAdmissions,
  getPatientById,
  getReceptionInpatientUnpaidAlerts,
  getRoomById,
  getStaffById,
  getVisitById,
  persistAdmissionAssignmentNowAsync,
  rooms,
  updateInpatientRoomBedByAdmission,
} from '@/shared/services/hmsStore'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

type StatusFilter = 'all' | 'active' | 'inactive'

const ReceptionAllInpatientsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const userRole = user?.role ?? 'reception_cashier'
  const receptionId = user?.id ?? 'staff-002'
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null)
  const [showEditRoomBed, setShowEditRoomBed] = useState(false)
  const [editRoomId, setEditRoomId] = useState('')
  const [editBedId, setEditBedId] = useState('')
  const [editErr, setEditErr] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  const filteredAdmissions = useMemo(() => {
    let list = getAllInpatientAdmissions()
    if (statusFilter === 'active') list = list.filter((a) => a.status === 'Active')
    if (statusFilter === 'inactive') list = list.filter((a) => a.status === 'Discharged')
    if (roomFilter !== 'all') list = list.filter((a) => a.roomId === roomFilter)

    const q = search.toLowerCase().trim()
    if (!q) return list

    return list.filter((adm) => {
      const patient = getPatientById(adm.patientId)
      const visit = getVisitById(adm.visitId)
      const doctor = visit?.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
      const room = getRoomById(adm.roomId)
      const bed = beds.find((b) => b.id === adm.bedId)
      const hay = [
        patient?.id,
        patient?.fullName,
        room?.name,
        bed?.bedNumber,
        doctor ? `${doctor.firstName} ${doctor.lastName}` : '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [search, statusFilter, roomFilter, tick, dataVersion, admissions.length])

  const admissionsPagination = useTablePagination(filteredAdmissions, 10, [
    filteredAdmissions.length,
    search,
    statusFilter,
    roomFilter,
    tick,
    dataVersion,
  ])

  const unpaidAlerts = useMemo(
    () => getReceptionInpatientUnpaidAlerts(),
    [tick, dataVersion, admissions.length],
  )
  const unpaidAdmissionIds = useMemo(
    () => new Set(unpaidAlerts.map((a) => a.admissionId)),
    [unpaidAlerts],
  )

  const modalBed = selectedBedId ? beds.find((b) => b.id === selectedBedId) : undefined
  const modalRoom = modalBed ? getRoomById(modalBed.roomId) : undefined
  const modalAdm = selectedAdmissionId ? getAdmissionById(selectedAdmissionId) : undefined
  const modalPatient = modalAdm ? getPatientById(modalAdm.patientId) : undefined
  const modalVisit = modalAdm ? getVisitById(modalAdm.visitId) : undefined
  const modalDoctor = modalVisit?.assignedDoctorId
    ? getStaffById(modalVisit.assignedDoctorId)
    : undefined

  const resetBillingForm = () => {
    setEditMsg('')
  }

  const openAdmission = (adm: Admission) => {
    setSelectedAdmissionId(adm.id)
    setSelectedBedId(adm.bedId ?? null)
    resetBillingForm()
  }

  const openUnpaidAlert = (alert: InpatientUnpaidAlert) => {
    if (alert.bedId) setSelectedBedId(alert.bedId)
    setSelectedAdmissionId(alert.admissionId)
    resetBillingForm()
  }

  const closeBillingModal = () => {
    setSelectedBedId(null)
    setSelectedAdmissionId(null)
    setShowEditRoomBed(false)
    resetBillingForm()
  }

  const openEditRoomBed = () => {
    if (!modalAdm) return
    setEditRoomId(modalAdm.roomId)
    setEditBedId(modalAdm.bedId)
    setEditErr('')
    setShowEditRoomBed(true)
  }

  const closeEditRoomBed = () => {
    setShowEditRoomBed(false)
    setEditErr('')
  }

  const handleSaveRoomBed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalAdm || !editRoomId || !editBedId) {
      setEditErr('Select room and bed.')
      return
    }
    setEditSaving(true)
    setEditErr('')
    try {
      const result = updateInpatientRoomBedByAdmission(modalAdm.id, editRoomId, editBedId)
      if (!result.ok) {
        setEditErr(result.error ?? 'Could not update room/bed.')
        return
      }
      if (result.admission) refreshVisitWorkflow(result.admission.visitId)
      if (isSupabase) await persistAdmissionAssignmentNowAsync()
      setSelectedBedId(editBedId)
      setShowEditRoomBed(false)
      setEditMsg(`Room & bed updated.${isSupabase ? ' Saved to database.' : ''}`)
      refresh()
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : 'Database save failed.')
      refresh()
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title="All Inpatients" />
      <PageHeader
        title="All Inpatients"
        subtitle="All assigned inpatients — click a card for charges and billing"
        breadcrumbs={[
          { label: 'Reception', href: '/hms/dashboard' },
          { label: 'All Inpatients' },
        ]}
      />

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={4}>
              <Form.Control
                type="search"
                placeholder="Search patient, bed, doctor, room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={8}>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {(
                  [
                    ['all', 'All'],
                    ['active', 'Active'],
                    ['inactive', 'Inactive'],
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
              <div className="d-flex flex-wrap gap-1 inpatient-room-filter">
                <Button
                  size="sm"
                  variant={roomFilter === 'all' ? 'primary' : 'outline-secondary'}
                  onClick={() => setRoomFilter('all')}
                >
                  All Rooms
                </Button>
                {rooms.map((room) => (
                  <Button
                    key={room.id}
                    size="sm"
                    variant={roomFilter === room.id ? 'primary' : 'outline-secondary'}
                    onClick={() => setRoomFilter(room.id)}
                  >
                    {room.name}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
          <div className="d-flex flex-wrap gap-3 mt-2 small text-muted">
            <span>
              <Badge bg="success-subtle" text="success" className="me-1">
                Active
              </Badge>
              Currently admitted
            </span>
            <span>
              <Badge bg="secondary-subtle" text="secondary" className="me-1">
                Inactive
              </Badge>
              Discharged / released
            </span>
            <span>
              <span className="bed-status-dot bed-status-dot--unpaid me-1" />
              Payment due (red border)
            </span>
          </div>
        </CardBody>
      </Card>

      <InpatientUnpaidAlertCards alerts={unpaidAlerts} onSelectAlert={openUnpaidAlert} />

      {filteredAdmissions.length === 0 ? (
        <Card>
          <CardBody className="text-center text-muted py-5">
            No assigned inpatients match your filters. Assign from{' '}
            <Link to="/hms/reception/inpatient-request">In Patient Request</Link>.
          </CardBody>
        </Card>
      ) : (
        <>
          <Row>
            {admissionsPagination.pageItems.map((adm) => {
            const room = getRoomById(adm.roomId)
            const bed = beds.find((b) => b.id === adm.bedId)
            const patient = getPatientById(adm.patientId)
            const visit = getVisitById(adm.visitId)
            const doctor = visit?.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
            const isActiveInpatient = adm.status === 'Active'
            const hasUnpaidAlert = unpaidAdmissionIds.has(adm.id)

            return (
              <Col key={adm.id} xs={12} sm={6} lg={4} xl={3} className="mb-3">
                <Card
                  role="button"
                  tabIndex={0}
                  className={`inpatient-bed-card inpatient-bed-card--clickable h-100 ${
                    hasUnpaidAlert
                      ? 'inpatient-bed-card--unpaid'
                      : isActiveInpatient
                        ? 'inpatient-bed-card--occupied'
                        : 'inpatient-bed-card--vacant'
                  }`}
                  onClick={() => openAdmission(adm)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openAdmission(adm)
                    }
                  }}
                >
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-0">{patient?.fullName ?? '—'}</h6>
                        <small className="text-muted">{patient?.id}</small>
                      </div>
                      <Badge
                        bg={isActiveInpatient ? 'success-subtle' : 'secondary-subtle'}
                        text={isActiveInpatient ? 'success' : 'secondary'}
                      >
                        {isActiveInpatient ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {hasUnpaidAlert && (
                      <Alert variant="danger" className="py-2 px-2 mb-2 small">
                        <IconifyIcon icon="solar:danger-triangle-broken" className="me-1" />
                        Payment not collected — doctor released patient
                      </Alert>
                    )}

                    <ul className="list-unstyled small mb-2">
                      <li>
                        <span className="text-muted">Dr</span>
                        <div>
                          {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'}
                        </div>
                      </li>
                      <li className="mt-2">
                        <span className="text-muted">Room / Bed</span>
                        <div>
                          {room?.name ?? '—'} · {bed?.bedNumber ?? '—'}
                        </div>
                      </li>
                      <li className="mt-2">
                        <span className="text-muted">Admitted</span>
                        <div>{adm.admittedAt}</div>
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </Col>
            )
            })}
          </Row>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={admissionsPagination.totalItems}
            rangeStart={admissionsPagination.rangeStart}
            rangeEnd={admissionsPagination.rangeEnd}
            safePage={admissionsPagination.safePage}
            totalPages={admissionsPagination.totalPages}
            onPageChange={admissionsPagination.setPage}
          />
        </>
      )}

      <Modal
        show={!!selectedAdmissionId || !!selectedBedId}
        onHide={closeBillingModal}
        size="lg"
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {modalAdm
              ? `Inpatient billing — ${currency}${modalBed?.dailyRate ?? 0}/night`
              : 'Vacant Bed'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editMsg && (
            <Alert variant="success" dismissible onClose={() => setEditMsg('')}>
              {editMsg}
            </Alert>
          )}

          <Card className="mb-3 bg-light border-0">
            <CardBody className="py-3">
              <Row className="g-3">
                <Col sm={6}>
                  <span className="text-muted small">Room</span>
                  <p className="fw-semibold mb-0">{modalRoom?.name ?? '—'}</p>
                </Col>
                <Col sm={6}>
                  <span className="text-muted small">Bed</span>
                  <p className="fw-semibold mb-0">{modalBed?.bedNumber ?? '—'}</p>
                </Col>
                <Col sm={6}>
                  <span className="text-muted small">Rate</span>
                  <p className="fw-semibold mb-0">
                    {currency}
                    {modalBed?.dailyRate ?? 0}/night
                  </p>
                </Col>
                <Col sm={6}>
                  <span className="text-muted small">Status</span>
                  <p className="mb-0">
                    {modalAdm?.status === 'Discharged' ? (
                      <Badge bg="secondary-subtle" text="secondary">
                        Inactive
                      </Badge>
                    ) : modalBed?.isOccupied ? (
                      <Badge bg="success-subtle" text="success">
                        Occupied
                      </Badge>
                    ) : (
                      <Badge bg="warning-subtle" text="warning">
                        Vacant
                      </Badge>
                    )}
                  </p>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {modalAdm && modalPatient ? (
            <>
              {unpaidAdmissionIds.has(modalAdm.id) && (
                <Alert variant="danger" className="mb-3">
                  <IconifyIcon icon="solar:danger-triangle-broken" className="me-1" />
                  This patient still has unpaid charges. Collect payment before they leave.
                </Alert>
              )}
              <h6 className="mb-2">Patient</h6>
              <Card className="mb-3 border">
                <CardBody className="py-3">
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-muted">Patient ID</span>
                      <p className="fw-semibold mb-0">{modalPatient.id}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Name</span>
                      <p className="fw-semibold mb-0">{modalPatient.fullName}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Phone</span>
                      <p className="mb-0">{modalPatient.phone}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Doctor</span>
                      <p className="mb-0">
                        {modalDoctor
                          ? `Dr. ${modalDoctor.firstName} ${modalDoctor.lastName}`
                          : '—'}
                      </p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Admitted</span>
                      <p className="mb-0">{modalAdm.admittedAt}</p>
                    </Col>
                  </Row>
                </CardBody>
              </Card>

              <InpatientChargesSection
                admissionId={modalAdm.id}
                receptionId={receptionId}
                userRole={userRole}
                isSupabase={isSupabase}
                dataVersion={dataVersion}
                onRefresh={refresh}
                onDischarged={closeBillingModal}
              />
            </>
          ) : (
            <Alert variant="info" className="mb-0">
              <IconifyIcon icon="solar:info-circle-broken" className="me-1" />
              This bed is vacant. Assign a patient from{' '}
              <Link to="/hms/reception/inpatient-request">In Patient Request</Link>.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          {modalAdm?.status === 'Active' && (
            <Button variant="outline-primary" className="me-auto" onClick={openEditRoomBed}>
              <IconifyIcon icon="solar:bed-broken" className="me-1" />
              Edit Room & Bed
            </Button>
          )}
          <Button variant="light" onClick={closeBillingModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEditRoomBed} onHide={closeEditRoomBed} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Room & Bed — {modalPatient?.fullName}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => void handleSaveRoomBed(e)}>
          <Modal.Body>
            {editErr && <Alert variant="danger">{editErr}</Alert>}
            <Alert variant="info" className="py-2 small">
              Move patient to another room or bed. Only available beds are shown.
            </Alert>
            <InpatientRoomBedFields
              roomId={editRoomId}
              bedId={editBedId}
              onRoomChange={setEditRoomId}
              onBedChange={setEditBedId}
              isEditMode
              excludeAdmissionId={modalAdm?.id}
              currentBedId={modalAdm?.bedId}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={closeEditRoomBed}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={!editBedId || editSaving}>
              <IconifyIcon icon="solar:bed-broken" className="me-1" />
              {editSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </PermissionGuard>
  )
}

export default ReceptionAllInpatientsPage
