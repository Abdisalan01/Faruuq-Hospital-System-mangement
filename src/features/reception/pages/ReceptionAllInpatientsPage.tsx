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
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import InpatientBillingModeSelector from '@/features/reception/components/InpatientBillingModeSelector'
import InpatientRoomBedFields from '@/features/reception/components/InpatientRoomBedFields'
import InpatientUnpaidAlertCards from '@/features/reception/components/InpatientUnpaidAlertCards'
import PrintableReceipt from '@/features/reception/components/PrintableReceipt'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import type {
  Admission,
  InpatientBillingMode,
  InpatientChargeRow,
  InpatientUnpaidAlert,
  ReceptionReceipt,
} from '@/shared/types'
import {
  admissions,
  beds,
  buildInpatientChargeReceipt,
  clampDiscountPercent,
  collectInpatientChargePayment,
  collectInpatientTotalPayment,
  getMaxDiscountPercent,
  isInpatientChargePaid,
  getAdmissionById,
  getAllInpatientAdmissions,
  getInpatientBillingLedger,
  getInpatientOutstandingTotal,
  getLatestInpatientCheckoutReceipt,
  getPatientById,
  getReceptionInpatientUnpaidAlerts,
  getRoomById,
  getStaffById,
  getVisitById,
  persistAdmissionAssignmentNowAsync,
  persistInpatientPaymentNowAsync,
  rooms,
  updateInpatientRoomBedByAdmission,
} from '@/shared/services/hmsStore'
import { discountAmountFromPercent, parseDiscountPercent } from '@/shared/utils/discountLimits'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

type StatusFilter = 'all' | 'active' | 'inactive'

const ReceptionAllInpatientsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const userRole = user?.role ?? 'reception_cashier'
  const receptionId = user?.id ?? 'staff-002'
  const maxInpatientDiscount = getMaxDiscountPercent(userRole, 'inpatient')
  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'inpatient', parseDiscountPercent(raw))
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [pendingReceipt, setPendingReceipt] = useState<ReceptionReceipt | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEditRoomBed, setShowEditRoomBed] = useState(false)
  const [editRoomId, setEditRoomId] = useState('')
  const [editBedId, setEditBedId] = useState('')
  const [editBillingMode, setEditBillingMode] = useState<InpatientBillingMode>('credit_book')
  const [editErr, setEditErr] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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
  const ledger = modalAdm ? getInpatientBillingLedger(modalAdm.id) : []
  const totalOutstanding = modalAdm ? getInpatientOutstandingTotal(modalAdm.id) : 0
  const discountPercent = appliedDiscountPercent(discountInput)
  const totalDiscountAmount = discountAmountFromPercent(totalOutstanding, discountPercent)
  const totalAfterDiscount = Math.max(0, totalOutstanding - totalDiscountAmount)
  const latestCheckoutReceipt = modalAdm ? getLatestInpatientCheckoutReceipt(modalAdm.id) : undefined

  const buildDiscountOptions = (subtotal: number) => {
    const percent = appliedDiscountPercent(discountInput)
    const amount = discountAmountFromPercent(subtotal, percent)
    return {
      discountPercent: percent > 0 ? percent : undefined,
      discountAmount: amount,
    }
  }

  const resetBillingForm = () => {
    setActionMsg('')
    setActionErr('')
    setPendingReceipt(null)
    setDiscountInput('')
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
    setEditBillingMode(modalAdm.billingMode)
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
      const result = updateInpatientRoomBedByAdmission(
        modalAdm.id,
        editRoomId,
        editBedId,
        editBillingMode,
      )
      if (!result.ok) {
        setEditErr(result.error ?? 'Could not update room/bed.')
        return
      }
      if (result.admission) refreshVisitWorkflow(result.admission.visitId)
      if (isSupabase) await persistAdmissionAssignmentNowAsync()
      setSelectedBedId(editBedId)
      setShowEditRoomBed(false)
      setActionMsg(
        `Room & bed updated.${isSupabase ? ' Saved to database.' : ''}`,
      )
      refresh()
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : 'Database save failed.')
      refresh()
    } finally {
      setEditSaving(false)
    }
  }

  const openPrint = (receipt: ReceptionReceipt) => {
    setPrintReceipt(receipt)
    setShowPrintModal(true)
  }

  const handleRowAction = async (row: InpatientChargeRow) => {
    if (!modalAdm) return
    setActionErr('')
    setActionMsg('')

    if (isInpatientChargePaid(row.status)) {
      openPrint(buildInpatientChargeReceipt(modalAdm, row, receptionId))
      return
    }

    const discount = buildDiscountOptions(row.amount)
    const paidAmount = Math.max(0, row.amount - discount.discountAmount)
    setSaving(true)
    try {
      const result = collectInpatientChargePayment(modalAdm.id, row, receptionId, discount)
      if (!result.ok) {
        setActionErr(result.error ?? 'Could not collect payment.')
        return
      }
      if (row.sourceType === 'lab' && modalVisit) refreshVisitWorkflow(modalVisit.id)
      if (isSupabase) await persistInpatientPaymentNowAsync()
      setActionMsg(
        `Collected ${currency}${paidAmount.toFixed(2)}.${isSupabase ? ' Saved to database.' : ''}${
          result.discharged ? ' Patient is now inactive (discharged).' : ''
        } Click Print for receipt.`,
      )
      if (result.receipt) setPendingReceipt(result.receipt)
      if (result.discharged) closeBillingModal()
      refresh()
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Could not save payment to database')
    } finally {
      setSaving(false)
    }
  }

  const handleTotalPaid = async () => {
    if (!modalAdm || totalOutstanding <= 0) return
    setActionErr('')
    setActionMsg('')

    const discount = buildDiscountOptions(totalOutstanding)
    setSaving(true)
    try {
      const result = collectInpatientTotalPayment(modalAdm.id, receptionId, discount)
      if (!result.ok) {
        setActionErr(result.error ?? 'Could not collect total payment.')
        return
      }
      if (modalVisit) refreshVisitWorkflow(modalVisit.id)
      if (isSupabase) await persistInpatientPaymentNowAsync()
      setActionMsg(
        `Total paid ${currency}${totalAfterDiscount.toFixed(2)}.${isSupabase ? ' Saved to database.' : ''}${
          result.discharged ? ' Patient is now inactive (discharged).' : ''
        }`,
      )
      if (result.receipt) {
        setPendingReceipt(result.receipt)
        openPrint(result.receipt)
      }
      if (result.discharged) closeBillingModal()
      refresh()
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Could not save payment to database')
    } finally {
      setSaving(false)
    }
  }

  const getRowActionLabel = (row: InpatientChargeRow): string | null => {
    if (!modalAdm) return null
    if (isInpatientChargePaid(row.status)) return 'Print receipt'
    return 'Collect payment'
  }

  const getStatusBadge = (status: InpatientChargeRow['status']) => {
    if (isInpatientChargePaid(status)) {
      return <Badge bg="success-subtle" text="success">Paid</Badge>
    }
    return <Badge bg="danger-subtle" text="danger">Unpaid</Badge>
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
        <Row>
          {filteredAdmissions.map((adm) => {
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
          {actionMsg && (
            <Alert
              variant="success"
              dismissible
              onClose={() => {
                setActionMsg('')
                setPendingReceipt(null)
              }}
            >
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span>{actionMsg}</span>
                {pendingReceipt && (
                  <Button
                    size="sm"
                    variant="outline-success"
                    onClick={() => {
                      openPrint(pendingReceipt)
                      setPendingReceipt(null)
                    }}
                  >
                    <IconifyIcon icon="solar:printer-broken" className="me-1" />
                    Print
                  </Button>
                )}
              </div>
            </Alert>
          )}
          {actionErr && (
            <Alert variant="danger" dismissible onClose={() => setActionErr('')}>
              {actionErr}
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

              <InpatientBillingModeSelector
                value={modalAdm.billingMode}
                nightlyRate={modalBed?.dailyRate ?? 0}
                readOnly
                namePrefix="all-inpatient"
              />

              {totalOutstanding > 0 && (
                <Card className="mt-3 border-0 bg-light">
                  <CardBody className="py-3">
                    <Row className="g-3 align-items-end">
                      <Col sm={6}>
                        <Form.Group className="mb-0">
                          <Form.Label>Discount (%) — optional</Form.Label>
                          <div className="input-group">
                            <Form.Control
                              type="number"
                              min={0}
                              max={maxInpatientDiscount}
                              step={0.01}
                              placeholder="0"
                              value={discountInput}
                              onChange={(e) => setDiscountInput(e.target.value)}
                            />
                            <span className="input-group-text">%</span>
                          </div>
                          <Form.Text className="text-muted">
                            Maximum allowed: <strong>{maxInpatientDiscount}%</strong>
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col sm={6}>
                        <div className="p-3 bg-primary bg-opacity-10 rounded border border-primary border-opacity-25">
                          <div className="d-flex justify-content-between small">
                            <span>Subtotal (unpaid)</span>
                            <span>
                              {currency}
                              {totalOutstanding.toFixed(2)}
                            </span>
                          </div>
                          {totalDiscountAmount > 0 && (
                            <div className="d-flex justify-content-between small text-success">
                              <span>Discount ({discountPercent}%)</span>
                              <span>
                                −{currency}
                                {totalDiscountAmount.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between fw-semibold mt-2 pt-2 border-top">
                            <span>Total due</span>
                            <span>
                              {currency}
                              {totalAfterDiscount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              )}

              <div className="mt-3">
                <h6 className="mb-2">Charges</h6>
                {ledger.length === 0 ? (
                  <p className="text-muted small mb-0">No charges yet.</p>
                ) : (
                  <div className="table-responsive">
                    <Table size="sm" hover className="mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th className="text-end">Amount</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((row) => {
                          const actionLabel = getRowActionLabel(row)
                          return (
                            <tr key={row.id}>
                              <td className="small">{row.date}</td>
                              <td className="small">{row.description}</td>
                              <td className="text-end small">
                                {currency}
                                {row.amount}
                              </td>
                              <td>{getStatusBadge(row.status)}</td>
                              <td>
                                {actionLabel ? (
                                  <Button
                                    size="sm"
                                    variant={
                                      isInpatientChargePaid(row.status) ? 'outline-secondary' : 'success'
                                    }
                                    disabled={saving}
                                    onClick={() => void handleRowAction(row)}
                                  >
                                    {actionLabel}
                                  </Button>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-light">
                        <tr>
                          <td colSpan={2} className="fw-semibold text-end">
                            Total Unpaid
                          </td>
                          <td className="text-end fw-bold">
                            {currency}
                            {totalAfterDiscount.toFixed(2)}
                            {totalDiscountAmount > 0 && (
                              <div className="small text-muted fw-normal text-decoration-line-through">
                                {currency}
                                {totalOutstanding.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td>
                            {totalOutstanding > 0 ? (
                              <Badge bg="danger-subtle" text="danger">
                                Unpaid
                              </Badge>
                            ) : (
                              <Badge bg="success-subtle" text="success">
                                Paid
                              </Badge>
                            )}
                          </td>
                          <td>
                            {totalOutstanding > 0 ? (
                              <Button size="sm" variant="success" disabled={saving} onClick={() => void handleTotalPaid()}>
                                Total Paid
                              </Button>
                            ) : latestCheckoutReceipt ? (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => openPrint(latestCheckoutReceipt)}
                              >
                                <IconifyIcon icon="solar:printer-broken" className="me-1" />
                                Print receipt
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      </tfoot>
                    </Table>
                  </div>
                )}
              </div>
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
              billingMode={editBillingMode}
              onRoomChange={setEditRoomId}
              onBedChange={setEditBedId}
              onBillingModeChange={setEditBillingMode}
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

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        centered
        className="thermal-print-modal"
        dialogClassName="thermal-print-dialog"
      >
        <Modal.Header closeButton className="no-print">
          <Modal.Title>
            {printReceipt?.type === 'checkout' && (printReceipt.lineItems.length ?? 0) > 1
              ? 'Print total paid receipt'
              : 'Print receipt'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{printReceipt && <PrintableReceipt receipt={printReceipt} />}</Modal.Body>
        <Modal.Footer className="no-print">
          <Button variant="light" onClick={() => setShowPrintModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <IconifyIcon icon="solar:printer-broken" className="me-1" />
            Print
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default ReceptionAllInpatientsPage
