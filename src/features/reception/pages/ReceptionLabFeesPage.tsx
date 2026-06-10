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
  calculateLabRequestSubtotal,
  confirmLabFeePayment,
  generateId,
  generateNumber,
  getMaxDiscountPercent,
  getPatientById,
  getStaffById,
  getVisitById,
  getActiveAdmissionForVisit,
  labRequests as storeLabRequests,
  labTestCatalog,
  persistLabFeePaymentNowAsync,
  receptionReceipts,
} from '@/shared/services/hmsStore'
import type { LabRequest, ReceptionReceipt } from '@/shared/types'
import { discountAmountFromPercent } from '@/shared/utils/discountLimits'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

const PAGE_SIZE = 10

type SubmitFilter = 'all' | 'not_submitted' | 'submitted'

const isLabFeeSubmitted = (req: LabRequest) => Boolean(req.paymentConfirmedAt)

const getDoctorDisplayName = (doctorId: string) => {
  const doctor = getStaffById(doctorId)
  if (!doctor) return '—'
  if (doctor.role === 'emergency') return 'Emergency'
  return `Dr. ${doctor.firstName} ${doctor.lastName}`
}

const getLabFeeStatusLabel = (req: LabRequest) => {
  if (!isLabFeeSubmitted(req)) return 'Not Submitted'
  return 'Submitted'
}

const parseDiscountPercent = (raw: string) => {
  const n = parseFloat(raw.replace(/,/g, '').replace(/%/g, '').trim())
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 100)
}

const percentFromDiscountAmount = (subtotal: number, amount: number) => {
  if (subtotal <= 0 || amount <= 0) return 0
  return Math.round((amount / subtotal) * 10000) / 100
}

const buildLabFeeReceipt = (
  req: LabRequest,
  receiptNumber: string,
  receptionId: string,
  lineItems: { testName: string; price: number }[],
  subtotal: number,
  discountAmount: number,
  total: number,
  discountPercent?: number,
): ReceptionReceipt => {
  const visit = getVisitById(req.visitId)
  return {
    id: generateId('rcpt'),
    receiptNumber,
    type: 'lab',
    patientId: req.patientId,
    visitId: req.visitId,
    doctorId: req.doctorId,
    doctorName: getDoctorDisplayName(req.doctorId),
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: lineItems.map((l) => ({ description: l.testName, amount: l.price })),
    subtotal,
    discountPercent,
    discountAmount,
    total,
    paymentConfirmed: true,
    labRequestNumber: req.requestNumber,
    createdAt: req.paymentConfirmedAt ?? new Date().toISOString(),
    createdBy: receptionId,
  }
}

const ReceptionLabFeesPage = () => {
  const { user } = useAuthContext()
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const userRole = user?.role ?? 'reception_cashier'
  const maxLabDiscount = getMaxDiscountPercent(userRole, 'lab')
  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'lab', parseDiscountPercent(raw))
  const [, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [submitFilter, setSubmitFilter] = useState<SubmitFilter>('all')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<LabRequest | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const allRequests = useMemo(
    () =>
      [...storeLabRequests]
        .filter((r) => r.status !== 'Cancelled')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [dataVersion, storeLabRequests.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRequests.filter((req) => {
      const adm = getActiveAdmissionForVisit(req.visitId)
      if (adm?.billingMode === 'credit_book' && adm.bookOpen) return false
      const submitted = isLabFeeSubmitted(req)
      if (submitFilter === 'not_submitted' && submitted) return false
      if (submitFilter === 'submitted' && !submitted) return false

      if (!q) return true
      const patient = getPatientById(req.patientId)
      const doctorName = getDoctorDisplayName(req.doctorId).toLowerCase()
      const tests = req.tests.map((t) => t.testName).join(' ').toLowerCase()
      const hay = [
        req.requestNumber,
        patient?.id,
        patient?.fullName,
        patient?.phone,
        doctorName,
        tests,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [allRequests, search, submitFilter, dataVersion])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, submitFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openView = (req: LabRequest, readOnly: boolean) => {
    setSelected(req)
    setViewOnly(readOnly)
    const sub = req.totalFee ?? calculateLabRequestSubtotal(req.tests)
    if (req.discountPercent != null && req.discountPercent > 0) {
      setDiscountInput(String(req.discountPercent))
    } else if (req.discountAmount != null && req.discountAmount > 0 && sub > 0) {
      setDiscountInput(String(percentFromDiscountAmount(sub, req.discountAmount)))
    } else {
      setDiscountInput('')
    }
    setPaymentConfirmed(false)
    setError('')
    setSuccess('')
  }

  const openThermalPrint = (req: LabRequest) => {
    const stored = receptionReceipts.find(
      (r) => r.type === 'lab' && r.labRequestNumber === req.requestNumber,
    )
    if (stored) {
      setPrintReceipt(stored)
      setShowPrintModal(true)
      return
    }
    const items = req.tests.map((t) => ({
      testName: t.testName,
      price: labTestCatalog.find((c) => c.testName === t.testName)?.price ?? 0,
    }))
    const sub = req.totalFee ?? calculateLabRequestSubtotal(req.tests)
    const disc = req.discountAmount ?? 0
    const pct =
      req.discountPercent ??
      (disc > 0 && sub > 0 ? percentFromDiscountAmount(sub, disc) : undefined)
    setPrintReceipt(
      buildLabFeeReceipt(
        req,
        generateNumber('RCP'),
        user?.id ?? 'staff-002',
        items,
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
    setViewOnly(false)
    setPaymentConfirmed(false)
    setError('')
  }

  const lineItems = useMemo(() => {
    if (!selected) return []
    return selected.tests.map((t) => {
      const catalog = labTestCatalog.find((c) => c.testName === t.testName)
      return {
        testName: t.testName,
        price: catalog?.price ?? 0,
      }
    })
  }, [selected])

  const subtotal = selected
    ? selected.totalFee ?? calculateLabRequestSubtotal(selected.tests)
    : 0
  const discountPercent = viewOnly && selected?.discountPercent != null
    ? selected.discountPercent
    : appliedDiscountPercent(discountInput)
  const discountAmount =
    viewOnly && selected?.discountAmount != null
      ? selected.discountAmount
      : discountAmountFromPercent(subtotal, discountPercent)
  const total = viewOnly && selected?.amountPaid != null
    ? selected.amountPaid
    : Math.max(0, subtotal - discountAmount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selected || viewOnly) return
    if (!paymentConfirmed) {
      setError('Confirm payment before submitting.')
      return
    }

    const receptionId = user?.id ?? 'staff-002'
    const finalPercent = appliedDiscountPercent(discountInput)
    const finalDiscount = discountAmountFromPercent(subtotal, finalPercent)
    const finalTotal = Math.max(0, subtotal - finalDiscount)

    setSaving(true)
    try {
      const receipt = confirmLabFeePayment({
        labRequestId: selected.id,
        receptionId,
        subtotal,
        discountPercent: finalPercent,
        discountAmount: finalDiscount,
        total: finalTotal,
        lineItems,
      })
      refreshVisitWorkflow(selected.visitId)

      if (isSupabase) await persistLabFeePaymentNowAsync(selected.id)

      setSuccess(
        `Payment confirmed. Lab ${selected.requestNumber} sent to laboratory.${
          isSupabase ? ' Saved to database.' : ''
        }`,
      )
      closeModal()
      refresh()
      setPrintReceipt(receipt)
      setShowPrintModal(true)
      setTimeout(() => setSuccess(''), 8000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm lab payment')
    } finally {
      setSaving(false)
    }
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Lab Fees" />
      <PageHeader
        title="Lab Fees"
        subtitle="Search, filter, and collect lab fees — laboratory receives requests after payment is submitted"
        breadcrumbs={[
          { label: 'Reception', href: '/hms/patients' },
          { label: 'Lab Fees' },
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
                placeholder="Search patient ID, name, doctor, test..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['not_submitted', 'Not Submitted'],
                    ['submitted', 'Submitted'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={submitFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setSubmitFilter(key)}
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
                  <th>Doctor</th>
                  <th>Test</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No lab fees match your search or filter
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    const amount = req.amountPaid ?? req.totalFee ?? calculateLabRequestSubtotal(req.tests)
                    const feeStatus = getLabFeeStatusLabel(req)
                    return (
                      <tr key={req.id}>
                        <td>{patient?.id ?? '—'}</td>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td>{getDoctorDisplayName(req.doctorId)}</td>
                        <td className="small">{req.tests.map((t) => t.testName).join(', ')}</td>
                        <td>
                          {currency}
                          {amount.toLocaleString()}
                        </td>
                        <td>
                          <StatusBadge status={feeStatus} />
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            {!isLabFeeSubmitted(req) ? (
                              <Button
                                size="sm"
                                variant="primary"
                                title="Collect payment & send to lab"
                                onClick={() => openView(req, false)}
                              >
                                <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
                                Pay
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                title="View"
                                onClick={() => openView(req, true)}
                              >
                                <IconifyIcon icon="solar:eye-broken" />
                              </Button>
                            )}
                            {isLabFeeSubmitted(req) && (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                title="Print receipt"
                                onClick={() => openThermalPrint(req)}
                              >
                                <IconifyIcon icon="solar:printer-broken" />
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
            Lab Fees — {selected?.requestNumber}
            {viewOnly && <span className="text-muted fs-6 ms-2">(View)</span>}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            {selected && (
              <>
                <Row className="mb-3 g-2">
                  <Col md={6}>
                    <p className="text-muted mb-1 small">Patient ID</p>
                    <p className="mb-0 fw-medium">{getPatientById(selected.patientId)?.id}</p>
                  </Col>
                  <Col md={6}>
                    <p className="text-muted mb-1 small">Patient Name</p>
                    <p className="mb-0 fw-medium">{getPatientById(selected.patientId)?.fullName}</p>
                  </Col>
                  <Col md={6}>
                    <p className="text-muted mb-1 small">Doctor</p>
                    <p className="mb-0">{getDoctorDisplayName(selected.doctorId)}</p>
                  </Col>
                  <Col md={6}>
                    <p className="text-muted mb-1 small">Status</p>
                    <StatusBadge status={getLabFeeStatusLabel(selected)} />
                  </Col>
                </Row>
                <Table size="sm" className="mb-3">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th className="text-end">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line) => (
                      <tr key={line.testName}>
                        <td>{line.testName}</td>
                        <td className="text-end">
                          {currency}
                          {line.price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="fw-bold">
                      <td>Subtotal</td>
                      <td className="text-end">
                        {currency}
                        {subtotal.toLocaleString()}
                      </td>
                    </tr>
                    {discountAmount > 0 && (
                      <tr>
                        <td>
                          Discount
                          {discountPercent > 0 && (
                            <span className="text-muted"> ({discountPercent}%)</span>
                          )}
                        </td>
                        <td className="text-end text-danger">
                          -{currency}
                          {discountAmount.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr className="fw-bold">
                      <td>{viewOnly ? 'Total paid' : 'Total'}</td>
                      <td className="text-end">
                        {currency}
                        {total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </Table>
                {viewOnly && selected.paymentConfirmedAt && (
                  <Alert variant="success" className="py-2 small mb-0">
                    Submitted {new Date(selected.paymentConfirmedAt).toLocaleString()}
                  </Alert>
                )}
                {!viewOnly && (
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Discount (%) — optional</Form.Label>
                        <div className="input-group">
                          <Form.Control
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            placeholder="e.g. 10"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                          />
                          <span className="input-group-text">%</span>
                        </div>
                        <Form.Text className="text-muted">
                          Enter 10 for 10%, 1 for 1% — saves {currency}
                          {discountAmountFromPercent(subtotal, appliedDiscountPercent(discountInput)).toFixed(2)}{' '}
                          off. Maximum allowed: <strong>{maxLabDiscount}%</strong>
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Total after discount</Form.Label>
                        <Form.Control
                          value={`${currency}${total.toFixed(2)}`}
                          disabled
                          className="fw-bold"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Check
                        type="checkbox"
                        id="lab-payment-confirmed"
                        label="Confirm patient has paid (xaqiiji lacag bixiyay)"
                        checked={paymentConfirmed}
                        onChange={(e) => setPaymentConfirmed(e.target.checked)}
                        className="mb-3 fw-medium"
                      />
                    </Col>
                  </Row>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={closeModal}>
              Close
            </Button>
            {!viewOnly && (
              <Button type="submit" variant="primary" disabled={!paymentConfirmed || saving}>
                <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                {saving ? 'Saving...' : 'Confirm Payment & Send to Lab'}
              </Button>
            )}
            {viewOnly && selected && !isLabFeeSubmitted(selected) && (
              <Button
                variant="primary"
                onClick={() => {
                  setViewOnly(false)
                  setPaymentConfirmed(false)
                }}
              >
                <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
                Collect Payment
              </Button>
            )}
            {viewOnly && selected && isLabFeeSubmitted(selected) && (
              <Button variant="outline-primary" onClick={() => openThermalPrint(selected)}>
                <IconifyIcon icon="solar:printer-broken" className="me-1" />
                Print Thermal
              </Button>
            )}
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
          <Modal.Title>Print — 80mm Thermal Paper</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex justify-content-center p-0 bg-white">
          {printReceipt && <PrintableReceipt receipt={printReceipt} />}
        </Modal.Body>
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

export default ReceptionLabFeesPage
