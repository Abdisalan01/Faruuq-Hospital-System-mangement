import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PrintableReceipt from '@/features/reception/components/PrintableReceipt'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  clampDiscountPercent,
  confirmInpatientSurgeryBookAndSchedule,
  confirmSurgeryCashAndSchedule,
  generateId,
  generateNumber,
  getMaxDiscountPercent,
  getPatientById,
  getStaffById,
  getActiveAdmissionForVisit,
  getSurgeryById,
  getSurgeryReceptionMode,
  getSurgeryRequestFee,
  getVisitById,
  isSurgeryFeePaid,
  persistInpatientPaymentNowAsync,
  persistSurgeryFeePaymentNowAsync,
  receptionReceipts,
  scheduleSurgeryRequest,
  surgeryRequests as storeSurgeryRequests,
  type SurgeryReceptionMode,
} from '@/shared/services/hmsStore'
import type { ReceptionReceipt, SurgeryRequest } from '@/shared/types'
import { isReceptionSurgeryVisible, refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

const PAGE_SIZE = 10

type PayFilter = 'all' | 'awaiting' | 'scheduled' | 'completed'

const getDoctorDisplayName = (doctorId: string) => {
  const doctor = getStaffById(doctorId)
  if (!doctor) return '—'
  if (doctor.role === 'emergency') return 'Emergency'
  return `Dr. ${doctor.firstName} ${doctor.lastName}`
}

const getSurgeryStatusLabel = (req: SurgeryRequest) => {
  if (req.status === 'Completed') return 'Completed'
  if (req.status === 'Cancelled') return 'Cancelled'
  if (req.status === 'Scheduled') return 'Scheduled'
  if (isSurgeryFeePaid(req)) {
    return req.paymentMethod === 'Credit Book' ? 'On Credit Book' : 'Paid — Awaiting Schedule'
  }
  const adm = getActiveAdmissionForVisit(req.visitId)
  if (adm?.billingMode === 'credit_book' && adm.bookOpen) return 'Awaiting Credit Book'
  if (adm?.billingMode === 'nightly_cash') return 'Inpatient — Awaiting Payment'
  return 'Awaiting Payment'
}

const parseDiscountPercent = (raw: string) => {
  const n = parseFloat(raw.replace(/,/g, '').replace(/%/g, '').trim())
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 100)
}

const discountAmountFromPercent = (subtotal: number, percent: number) => {
  if (percent <= 0 || subtotal <= 0) return 0
  return Math.round(((subtotal * percent) / 100) * 100) / 100
}

const percentFromDiscountAmount = (subtotal: number, amount: number) => {
  if (subtotal <= 0 || amount <= 0) return 0
  return Math.round((amount / subtotal) * 10000) / 100
}

const buildSurgeryReceipt = (
  req: SurgeryRequest,
  receiptNumber: string,
  receptionId: string,
  subtotal: number,
  discountAmount: number,
  total: number,
  discountPercent?: number,
): ReceptionReceipt => {
  const visit = getVisitById(req.visitId)
  return {
    id: generateId('rcpt'),
    receiptNumber,
    type: 'surgery',
    patientId: req.patientId,
    visitId: req.visitId,
    doctorId: req.doctorId,
    doctorName: getDoctorDisplayName(req.doctorId),
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: [{ description: req.surgeryName, amount: subtotal }],
    subtotal,
    discountPercent,
    discountAmount,
    total,
    paymentConfirmed: true,
    surgeryRequestNumber: req.requestNumber,
    createdAt: req.paymentConfirmedAt ?? new Date().toISOString(),
    createdBy: receptionId,
  }
}

const ReceptionSurgeryPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const userRole = user?.role ?? 'reception_cashier'
  const maxSurgeryDiscount = getMaxDiscountPercent(userRole, 'surgery')
  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'surgery', parseDiscountPercent(raw))
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState<PayFilter>('all')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<SurgeryRequest | null>(null)
  const [modalMode, setModalMode] = useState<SurgeryReceptionMode>('cash')
  const [discountInput, setDiscountInput] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledNotes, setScheduledNotes] = useState('')
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const surgerySyncKey = useMemo(
    () =>
      storeSurgeryRequests
        .map((r) => {
          const visit = getVisitById(r.visitId)
          return `${r.id}:${r.status}:${r.lastModifiedAt ?? ''}:${visit?.status ?? ''}`
        })
        .join('|'),
    [dataVersion, storeSurgeryRequests.length],
  )

  const allRequests = useMemo(
    () =>
      [...storeSurgeryRequests]
        .filter(isReceptionSurgeryVisible)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [surgerySyncKey],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRequests.filter((req) => {
      const paid = isSurgeryFeePaid(req)
      if (payFilter === 'awaiting' && paid) return false
      if (payFilter === 'scheduled' && (req.status !== 'Scheduled' || !paid)) return false
      if (payFilter === 'completed' && req.status !== 'Completed') return false

      if (!q) return true
      const patient = getPatientById(req.patientId)
      const doctorName = getDoctorDisplayName(req.doctorId).toLowerCase()
      const hay = [
        req.requestNumber,
        patient?.id,
        patient?.fullName,
        patient?.phone,
        doctorName,
        req.surgeryName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [allRequests, search, payFilter, tick, dataVersion])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, payFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openView = (req: SurgeryRequest) => {
    setSelected(req)
    setModalMode(getSurgeryReceptionMode(req))
    const sub = getSurgeryRequestFee(req)
    if (req.discountPercent != null && req.discountPercent > 0) {
      setDiscountInput(String(req.discountPercent))
    } else if (req.discountAmount != null && req.discountAmount > 0 && sub > 0) {
      setDiscountInput(String(percentFromDiscountAmount(sub, req.discountAmount)))
    } else {
      setDiscountInput('')
    }
    setScheduledDate(req.scheduledDate ?? '')
    setScheduledNotes(req.scheduledNotes ?? '')
    setPaymentConfirmed(false)
    setError('')
    setSuccess('')
  }

  const openThermalPrint = (req: SurgeryRequest) => {
    const stored = receptionReceipts.find(
      (r) => r.type === 'surgery' && r.surgeryRequestNumber === req.requestNumber,
    )
    if (stored) {
      setPrintReceipt(stored)
      setShowPrintModal(true)
      return
    }
    const sub = getSurgeryRequestFee(req)
    const disc = req.discountAmount ?? 0
    const pct =
      req.discountPercent ??
      (disc > 0 && sub > 0 ? percentFromDiscountAmount(sub, disc) : undefined)
    setPrintReceipt(
      buildSurgeryReceipt(
        req,
        generateNumber('RCP'),
        user?.id ?? 'staff-002',
        sub,
        disc,
        req.amountPaid ?? sub - disc,
        pct,
      ),
    )
    setShowPrintModal(true)
  }

  const closeModal = () => {
    setSelected(null)
    setModalMode('cash')
    setPaymentConfirmed(false)
    setError('')
  }

  const isViewOnly = modalMode === 'view'
  const selectedAdmission = selected ? getActiveAdmissionForVisit(selected.visitId) : undefined

  const subtotal = selected ? getSurgeryRequestFee(selected) : 0
  const discountPercent =
    isViewOnly && selected?.discountPercent != null
      ? selected.discountPercent
      : appliedDiscountPercent(discountInput)
  const discountAmount =
    isViewOnly && selected?.discountAmount != null
      ? selected.discountAmount
      : discountAmountFromPercent(subtotal, discountPercent)
  const total =
    isViewOnly && selected?.amountPaid != null
      ? selected.amountPaid
      : Math.max(0, subtotal - discountAmount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selected || isViewOnly) return
    if (!scheduledDate) {
      setError('Select a surgery date.')
      return
    }

    const receptionId = user?.id ?? 'staff-002'
    const finalPercent = appliedDiscountPercent(discountInput)
    const finalDiscount = discountAmountFromPercent(subtotal, finalPercent)
    const finalTotal = Math.max(0, subtotal - finalDiscount)

    if (modalMode === 'cash' && !paymentConfirmed) {
      setError('Confirm cash payment before scheduling surgery.')
      return
    }
    if (modalMode === 'inpatient_book' && !paymentConfirmed) {
      setError('Confirm charge to inpatient account before scheduling.')
      return
    }

    setSaving(true)
    try {
      let receipt: ReceptionReceipt | undefined

      if (modalMode === 'cash') {
        const result = confirmSurgeryCashAndSchedule({
          requestId: selected.id,
          receptionId,
          scheduledDate,
          scheduledNotes,
          subtotal,
          discountPercent: finalPercent > 0 ? finalPercent : undefined,
          discountAmount: finalDiscount > 0 ? finalDiscount : undefined,
          total: finalTotal,
          receiptNumber: generateNumber('RCP'),
          surgeryName: selected.surgeryName,
        })
        if (!result.ok) {
          setError(result.error ?? 'Could not confirm surgery payment.')
          return
        }
        receipt = result.receipt
        if (isSupabase) await persistSurgeryFeePaymentNowAsync()
        setSuccess(
          `Cash payment recorded. ${selected.surgeryName} scheduled for ${scheduledDate}.${
            isSupabase ? ' Saved to database.' : ''
          }`,
        )
        setPrintReceipt(receipt ?? null)
      } else if (modalMode === 'inpatient_book') {
        if (!selectedAdmission) {
          setError('Active inpatient admission not found.')
          return
        }
        const result = confirmInpatientSurgeryBookAndSchedule({
          requestId: selected.id,
          admissionId: selectedAdmission.id,
          receptionId,
          scheduledDate,
          scheduledNotes,
        })
        if (!result.ok) {
          setError(result.error ?? 'Could not charge surgery to inpatient account.')
          return
        }
        if (isSupabase) await persistInpatientPaymentNowAsync()
        setSuccess(
          `Charged to inpatient account. ${selected.surgeryName} scheduled for ${scheduledDate}.${
            isSupabase ? ' Saved to database.' : ''
          }`,
        )
      } else if (modalMode === 'schedule_only') {
        const result = scheduleSurgeryRequest(selected.id, scheduledDate, scheduledNotes)
        if (!result.ok) {
          setError(result.error ?? 'Could not schedule surgery.')
          return
        }
        if (isSupabase) await persistSurgeryFeePaymentNowAsync()
        setSuccess(
          `${selected.surgeryName} scheduled for ${scheduledDate}.${
            isSupabase ? ' Saved to database.' : ''
          }`,
        )
      }

      refreshVisitWorkflow(selected.visitId)
      closeModal()
      refresh()
      setTimeout(() => setSuccess(''), 8000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm surgery')
    } finally {
      setSaving(false)
    }
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Surgery" />
      <PageHeader
        title="Surgery"
        subtitle="Doctor surgery requests — collect fees and schedule procedures"
        breadcrumbs={[
          { label: 'Reception', href: '/hms/dashboard' },
          { label: 'Surgery' },
        ]}
      />

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span>{success}</span>
            {printReceipt && (
              <Button
                size="sm"
                variant="outline-success"
                onClick={() => setShowPrintModal(true)}
              >
                <IconifyIcon icon="solar:printer-broken" className="me-1" />
                Print
              </Button>
            )}
          </div>
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search request #, patient, doctor, surgery..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['awaiting', 'Awaiting Payment'],
                    ['scheduled', 'Scheduled'],
                    ['completed', 'Completed'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={payFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setPayFilter(key)}
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
                  <th>Request #</th>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Doctor</th>
                  <th>Surgery</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No surgery requests match your search or filter
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    const amount = req.amountPaid ?? getSurgeryRequestFee(req)
                    const statusLabel = getSurgeryStatusLabel(req)
                    const paid = isSurgeryFeePaid(req)
                    const catalog = getSurgeryById(req.surgeryCatalogId)
                    const adm = getActiveAdmissionForVisit(req.visitId)
                    const openMode = getSurgeryReceptionMode(req)
                    return (
                      <tr key={req.id}>
                        <td className="fw-medium">{req.requestNumber}</td>
                        <td>{patient?.id ?? '—'}</td>
                        <td>
                          {patient?.fullName ?? '—'}
                          {adm && (
                            <div className="small text-muted">
                              Inpatient
                              {adm.billingMode === 'credit_book' ? ' · Book' : ''}
                            </div>
                          )}
                        </td>
                        <td>{getDoctorDisplayName(req.doctorId)}</td>
                        <td className="small">
                          {req.surgeryName}
                          {catalog && (
                            <div className="text-muted">{catalog.category}{catalog.riskLevel ? ` · ${catalog.riskLevel} risk` : ''}</div>
                          )}
                        </td>
                        <td>
                          {currency}
                          {amount.toLocaleString()}
                        </td>
                        <td>
                          <StatusBadge status={statusLabel} />
                        </td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            title={openMode === 'view' ? 'View' : 'Open'}
                            onClick={() => openView(req)}
                          >
                            <IconifyIcon
                              icon={
                                openMode === 'view'
                                  ? 'solar:eye-broken'
                                  : 'solar:pen-new-square-broken'
                              }
                            />
                          </Button>
                          {paid && (
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              title="Print receipt"
                              onClick={() => openThermalPrint(req)}
                            >
                              <IconifyIcon icon="solar:printer-broken" />
                            </Button>
                          )}
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

      <Modal show={!!selected} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Surgery — {selected?.requestNumber}
            {isViewOnly && <span className="text-muted fs-6 ms-2">(View)</span>}
            {modalMode === 'inpatient_book' && (
              <span className="text-muted fs-6 ms-2">(Inpatient — credit book)</span>
            )}
            {modalMode === 'schedule_only' && (
              <span className="text-muted fs-6 ms-2">(Schedule — payment received)</span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            {selected && (
              <>
                {(() => {
                  const catalog = getSurgeryById(selected.surgeryCatalogId)
                  if (!catalog) return null
                  return (
                    <Alert variant="light" className="small border mb-3">
                      <strong>{catalog.surgeryId}</strong> · {catalog.category}
                      {catalog.duration && ` · ${catalog.duration}`}
                      {catalog.anesthesiaType && ` · ${catalog.anesthesiaType}`}
                      {catalog.riskLevel && ` · ${catalog.riskLevel} risk`}
                      {catalog.preOpInstructions && (
                        <div className="mt-1 text-muted">Pre-op: {catalog.preOpInstructions}</div>
                      )}
                      {catalog.postOpCare && selected.status === 'Completed' && (
                        <div className="mt-1 text-muted">Post-op: {catalog.postOpCare}</div>
                      )}
                    </Alert>
                  )
                })()}
                <Card className="mb-3 bg-light border-0">
                  <CardBody className="py-3">
                    <Row className="g-2 small">
                      <Col sm={6}>
                        <span className="text-muted">Patient ID</span>
                        <p className="fw-semibold mb-0">{getPatientById(selected.patientId)?.id}</p>
                      </Col>
                      <Col sm={6}>
                        <span className="text-muted">Patient Name</span>
                        <p className="fw-semibold mb-0">
                          {getPatientById(selected.patientId)?.fullName}
                        </p>
                      </Col>
                      <Col sm={6}>
                        <span className="text-muted">Phone</span>
                        <p className="mb-0">{getPatientById(selected.patientId)?.phone}</p>
                      </Col>
                      <Col sm={6}>
                        <span className="text-muted">Doctor</span>
                        <p className="mb-0">{getDoctorDisplayName(selected.doctorId)}</p>
                      </Col>
                      <Col sm={6}>
                        <span className="text-muted">Status</span>
                        <p className="mb-0">
                          <StatusBadge status={getSurgeryStatusLabel(selected)} />
                        </p>
                      </Col>
                      {selected.notes && (
                        <Col xs={12}>
                          <span className="text-muted">Clinical notes</span>
                          <p className="mb-0">{selected.notes}</p>
                        </Col>
                      )}
                    </Row>
                  </CardBody>
                </Card>

                <Table size="sm" className="mb-3">
                  <thead>
                    <tr>
                      <th>Surgery / Procedure</th>
                      <th className="text-end">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{selected.surgeryName}</td>
                      <td className="text-end">
                        {currency}
                        {subtotal.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </Table>

                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Discount (%)</Form.Label>
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={isViewOnly ? String(discountPercent || '') : discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        disabled={isViewOnly || modalMode === 'inpatient_book' || modalMode === 'schedule_only'}
                      />
                      {!isViewOnly && modalMode === 'cash' && (
                        <Form.Text className="text-muted">
                          Maximum allowed: <strong>{maxSurgeryDiscount}%</strong>
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Total to collect</Form.Label>
                      <Form.Control
                        readOnly
                        value={`${currency}${total.toLocaleString()}`}
                        className="fw-bold"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Surgery date</Form.Label>
                      <Form.Control
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        required={!isViewOnly}
                        disabled={isViewOnly}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Schedule notes (optional)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g. fasting required, OR room 2"
                        value={scheduledNotes}
                        onChange={(e) => setScheduledNotes(e.target.value)}
                        disabled={isViewOnly}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {!isViewOnly && modalMode === 'cash' && (
                  <Form.Check
                    type="checkbox"
                    id="surgery-payment-confirmed"
                    className="mb-0"
                    label={
                      <span>
                        I confirm cash payment of{' '}
                        <strong>
                          {currency}
                          {total.toLocaleString()}
                        </strong>{' '}
                        received from patient
                      </span>
                    }
                    checked={paymentConfirmed}
                    onChange={(e) => setPaymentConfirmed(e.target.checked)}
                  />
                )}

                {!isViewOnly && modalMode === 'inpatient_book' && (
                  <Alert variant="warning" className="py-2 small">
                    Fee will be added to the inpatient credit book (not collected as cash now).
                  </Alert>
                )}

                {!isViewOnly && modalMode === 'inpatient_book' && (
                  <Form.Check
                    type="checkbox"
                    id="surgery-book-confirmed"
                    className="mb-0"
                    label={
                      <span>
                        I confirm surgery fee of{' '}
                        <strong>
                          {currency}
                          {total.toLocaleString()}
                        </strong>{' '}
                        charged to inpatient account
                      </span>
                    }
                    checked={paymentConfirmed}
                    onChange={(e) => setPaymentConfirmed(e.target.checked)}
                  />
                )}

                {!isViewOnly && modalMode === 'schedule_only' && (
                  <Alert variant="info" className="py-2 small mb-0">
                    Payment already collected — set the surgery date and confirm schedule.
                  </Alert>
                )}

                {isViewOnly && selected.status === 'Completed' && selected.completedAt && (
                  <Alert variant="success" className="py-2 small mb-0 mt-3">
                    Completed on <strong>{new Date(selected.completedAt).toLocaleString()}</strong>
                  </Alert>
                )}

                {isViewOnly && selected.scheduledDate && selected.status !== 'Completed' && (
                  <Alert variant="info" className="py-2 small mb-0 mt-3">
                    Scheduled for <strong>{selected.scheduledDate}</strong>
                    {selected.scheduledNotes ? ` — ${selected.scheduledNotes}` : ''}
                  </Alert>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={closeModal}>
              {isViewOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isViewOnly && (
              <Button type="submit" variant="success" disabled={saving}>
                <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                {saving
                  ? 'Saving...'
                  : modalMode === 'schedule_only'
                    ? 'Confirm & Schedule'
                    : modalMode === 'inpatient_book'
                      ? 'Charge to Account & Schedule'
                      : 'Confirm Payment & Schedule'}
              </Button>
            )}
            {isViewOnly && selected && isSurgeryFeePaid(selected) && (
              <Button variant="outline-primary" onClick={() => openThermalPrint(selected)}>
                <IconifyIcon icon="solar:printer-broken" className="me-1" />
                Print Receipt
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        size="sm"
        centered
        className="print-modal"
      >
        <Modal.Body className="p-0">
          {printReceipt && <PrintableReceipt receipt={printReceipt} />}
        </Modal.Body>
        <Modal.Footer className="no-print">
          <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default ReceptionSurgeryPage
