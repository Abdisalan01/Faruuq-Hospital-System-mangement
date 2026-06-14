import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  estimatePrescriptionTotalFee,
  generateId,
  getInpatientMedicinePaymentSummary,
  getInpatientMedicinePaymentStatus,
  getInpatientMedicineOrderedByLabel,
  getInpatientMedicineRequests,
  getPatientById,
  getPrescriptionDispenseBilling,
  inventoryItems,
  isInpatientMedicineActive,
  isInpatientMedicinePaymentCollected,
  isInpatientMedicineSentToReception,
  approveInpatientMedicineAtPharmacy,
  sendInpatientMedicineToReceptionAtPharmacy,
  collectInpatientMedicinePaymentAtPharmacy,
  processPrescriptionDispense,
  prescriptions as storePrescriptions,
  stockTransactions,
  syncMedicineStatusForInventoryItem,
  persistInpatientMedicineApprovalNowAsync,
  persistInpatientMedicinePaymentNowAsync,
  persistPharmacyDispenseNowAsync,
} from '@/shared/services/hmsStore'
import type { InpatientMedicinePaymentStatus, Prescription } from '@/shared/types'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

const PAGE_SIZE = 10

type StatusFilter = 'active' | 'inactive'

const paymentStatusLabel: Record<InpatientMedicinePaymentStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  at_reception: 'At reception',
  paid_cash: 'Paid (cash)',
  credit_book: 'Credit book',
}

const paymentStatusVariant: Record<
  InpatientMedicinePaymentStatus,
  { bg: string; text: string }
> = {
  awaiting_payment: { bg: 'warning-subtle', text: 'warning' },
  at_reception: { bg: 'info-subtle', text: 'info' },
  paid_cash: { bg: 'success-subtle', text: 'success' },
  credit_book: { bg: 'primary-subtle', text: 'primary' },
}

const findInventoryItem = (medicineName: string) => {
  const lower = medicineName.toLowerCase()
  return inventoryItems.find(
    (i) =>
      i.name.toLowerCase().includes(lower) ||
      lower.includes(i.name.toLowerCase().split(' ')[0]),
  )
}

const PrescriptionsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<Prescription | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  const refresh = () => setTick((t) => t + 1)

  const inpatientRequests = useMemo(
    () =>
      getInpatientMedicineRequests().filter(
        (p) => p.status === 'Pending' || p.status === 'Approved',
      ),
    [tick, dataVersion, storePrescriptions.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return inpatientRequests.filter((rx) => {
      const isActive = isInpatientMedicineActive(rx)
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'inactive' && isActive) return false

      if (!q) return true
      const patient = getPatientById(rx.patientId)
      const hay = [patient?.fullName, patient?.phone, patient?.id, rx.patientId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [inpatientRequests, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const activeCount = inpatientRequests.filter((p) => isInpatientMedicineActive(p)).length
  const inactiveCount = inpatientRequests.length - activeCount

  const modalSummary = selected ? getInpatientMedicinePaymentSummary(selected) : null
  const modalBilling = selected ? getPrescriptionDispenseBilling(selected) : null
  const modalPatient = selected ? getPatientById(selected.patientId) : undefined
  const modalPaid = selected ? isInpatientMedicinePaymentCollected(selected) : false
  const modalPaymentStatus = selected ? getInpatientMedicinePaymentStatus(selected) : null
  const canApprove = selected?.status === 'Pending'
  const canSendToReception =
    selected?.status === 'Approved' && !modalPaid && !isInpatientMedicineSentToReception(selected)
  const canCollectAtPharmacy =
    selected?.status === 'Approved' &&
    !modalPaid &&
    !isInpatientMedicineSentToReception(selected)
  const canDispense = selected?.status === 'Approved' && modalPaid

  const approve = async () => {
    if (!selected || !user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const result = approveInpatientMedicineAtPharmacy(selected.id, user.id)
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error ?? 'Could not approve request.' })
        return
      }
      if (isSupabase) await persistInpatientMedicineApprovalNowAsync()
      setMessage({ type: 'success', text: 'Request approved — reception can collect payment.' })
      setSelected(null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Approved locally but database save failed.' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const sendToReception = async () => {
    if (!selected || !user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const result = sendInpatientMedicineToReceptionAtPharmacy(selected.id, user.id)
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error ?? 'Could not send to reception.' })
        return
      }
      if (isSupabase) await persistInpatientMedicineApprovalNowAsync()
      setMessage({
        type: 'success',
        text: 'Sent to reception — appears in Inpatient billing table. Pharmacy shows "At reception".',
      })
      setSelected(null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Sent locally but database save failed.' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const collectAtPharmacy = async () => {
    if (!selected || !user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const result = collectInpatientMedicinePaymentAtPharmacy(selected.id, user.id)
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error ?? 'Could not collect payment.' })
        return
      }
      if (isSupabase) await persistInpatientMedicinePaymentNowAsync()
      setMessage({
        type: 'success',
        text: 'Payment collected at pharmacy — not sent to reception. You can dispense now.',
      })
      setSelected(storePrescriptions.find((p) => p.id === selected.id) ?? null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Payment saved locally but database sync failed.' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const dispense = async () => {
    if (!selected) return
    const rx = storePrescriptions.find((p) => p.id === selected.id)
    if (!rx || rx.status !== 'Approved') return

    const patient = getPatientById(rx.patientId)
    if (!patient) {
      setMessage({ type: 'danger', text: 'Patient not found' })
      return
    }

    let totalCost = 0
    const dispensedItems: string[] = []

    for (const item of rx.items) {
      const inv = findInventoryItem(item.medicine)
      if (!inv) {
        setMessage({ type: 'danger', text: `No inventory match for "${item.medicine}"` })
        return
      }
      const qty = 1
      if (inv.quantity < qty) {
        setMessage({ type: 'danger', text: `Insufficient stock for ${inv.name}` })
        return
      }
      inv.quantity -= qty
      syncMedicineStatusForInventoryItem(inv)
      totalCost += inv.unitPrice * qty
      dispensedItems.push(inv.name)

      stockTransactions.push({
        id: generateId('st'),
        itemId: inv.id,
        type: 'Dispense',
        quantity: qty,
        unitPrice: inv.unitPrice,
        unitCost: inv.purchasePrice ?? 0,
        reference: rx.id,
        notes: `Dispensed to ${patient.fullName}`,
        createdAt: new Date().toISOString(),
        createdBy: user?.id ?? 'staff-006',
      })
    }

    const result = processPrescriptionDispense(
      rx.id,
      totalCost,
      dispensedItems.join(', '),
      user?.id ?? 'staff-006',
    )
    if (!result.ok) {
      setMessage({ type: 'danger', text: result.error ?? 'Could not dispense.' })
      return
    }

    refreshVisitWorkflow(rx.visitId)
    setSaving(true)
    try {
      if (isSupabase) await persistPharmacyDispenseNowAsync()
      setMessage({ type: 'success', text: `Medicine dispensed — ${currency}${totalCost.toFixed(2)}.` })
      setSelected(null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Dispensed locally but database save failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['process_prescriptions']}>
      <PageMetaData title="Inpatient Medicine Requests" />
      <PageHeader
        title="Inpatient Medicine Requests"
        subtitle="Doctor & nursing prescriptions — approve, collect payment or send to reception, then dispense"
        breadcrumbs={[
          { label: 'HMS', href: '/hms/dashboard' },
          { label: 'Pharmacy', href: '/hms/pharmacy/dashboard' },
          { label: 'Inpatient Medicine Requests' },
        ]}
      />

      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card className="mb-3 border-0 shadow-sm">
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Label className="small text-muted mb-1">Search</Form.Label>
              <Form.Control
                type="search"
                placeholder="Patient name, phone, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted mb-1">Status</Form.Label>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['active', `Active (${activeCount})`],
                    ['inactive', `Inactive (${inactiveCount})`],
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
          <p className="text-muted small mb-0 mt-2">
            <strong>Active</strong> = awaiting payment · <strong>Inactive</strong> = paid or on credit
            book — payment status shows cash, credit, or at reception
          </p>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient</th>
                  <th>Ordered by</th>
                  <th>Medicines</th>
                  <th className="text-end">Total</th>
                  <th>Payment status</th>
                  <th>Dispense</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-5">
                      No inpatient medicine requests match your filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((rx) => {
                    const patient = getPatientById(rx.patientId)
                    const { total } = getInpatientMedicinePaymentSummary(rx)
                    const payStatus = getInpatientMedicinePaymentStatus(rx)
                    const variant = paymentStatusVariant[payStatus]
                    return (
                      <tr
                        key={rx.id}
                        role="button"
                        className="cursor-pointer"
                        onClick={() => setSelected(rx)}
                      >
                        <td className="fw-medium">{patient?.fullName ?? '—'}</td>
                        <td className="small">{getInpatientMedicineOrderedByLabel(rx)}</td>
                        <td className="small" style={{ maxWidth: 220 }}>
                          {rx.items.map((i) => i.medicine).join(', ')}
                        </td>
                        <td className="text-end">
                          {currency}
                          {total.toFixed(2)}
                        </td>
                        <td>
                          <Badge bg={variant.bg} text={variant.text}>
                            {paymentStatusLabel[payStatus]}
                          </Badge>
                        </td>
                        <td>
                          <StatusBadge status={rx.status} />
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

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Inpatient medicine — {modalPatient?.fullName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && modalSummary && (
            <>
              <Card className="mb-3 border-0 bg-light">
                <CardBody className="py-3">
                  <Row className="g-3">
                    <Col sm={4}>
                      <span className="text-muted small">Total due</span>
                      <p className="fw-bold mb-0 fs-5">
                        {currency}
                        {modalSummary.total.toFixed(2)}
                      </p>
                    </Col>
                    <Col sm={4}>
                      <span className="text-muted small">Paid</span>
                      <p className="fw-bold mb-0 fs-5 text-success">
                        {currency}
                        {modalSummary.paid.toFixed(2)}
                      </p>
                    </Col>
                    <Col sm={4}>
                      <span className="text-muted small">Remaining</span>
                      <p className="fw-bold mb-0 fs-5 text-danger">
                        {currency}
                        {modalSummary.remaining.toFixed(2)}
                      </p>
                    </Col>
                  </Row>
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {modalPaymentStatus && (
                      <Badge
                        bg={paymentStatusVariant[modalPaymentStatus].bg}
                        text={paymentStatusVariant[modalPaymentStatus].text}
                      >
                        {paymentStatusLabel[modalPaymentStatus]}
                      </Badge>
                    )}
                    <span className="small text-muted">
                      Ordered by {getInpatientMedicineOrderedByLabel(selected)}
                    </span>
                    {modalBilling === 'inpatient_credit_book' && (
                      <Badge bg="info-subtle" text="info">Credit book patient</Badge>
                    )}
                    {modalBilling === 'inpatient_cash' && (
                      <Badge bg="success-subtle" text="success">Cash inpatient</Badge>
                    )}
                    <StatusBadge status={selected.status} />
                  </div>
                </CardBody>
              </Card>

              <h6 className="mb-2">Medicines</h6>
              <Table size="sm" className="mb-3">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th className="text-end">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, idx) => {
                    const inv = findInventoryItem(item.medicine)
                    return (
                      <tr key={idx}>
                        <td>{item.medicine}</td>
                        <td className="small text-muted">
                          {item.dosage}, {item.frequency}
                        </td>
                        <td className="text-end">
                          {inv ? `${currency}${inv.unitPrice.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="fw-semibold text-end">
                      Total
                    </td>
                    <td className="text-end fw-bold">
                      {currency}
                      {estimatePrescriptionTotalFee(selected).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </Table>

              {selected.status === 'Pending' && (
                <Alert variant="info" className="small">
                  Review medicines and click <strong>Approve</strong>. Patient pays at pharmacy or
                  you send them to reception cashier.
                </Alert>
              )}
              {selected.status === 'Approved' && !modalPaid && (
                <Alert variant="warning" className="small">
                  <strong>Collect Payment</strong> — pharmacy takes payment here (reception will not
                  see this charge). <strong>Send to Reception</strong> — charge appears in{' '}
                  <strong>Inpatient billing</strong> for the cashier.
                </Alert>
              )}
              {selected.status === 'Approved' && modalPaid && (
                <Alert variant="success" className="small">
                  Payment settled
                  {modalPaymentStatus === 'credit_book' ? ' on credit book' : ' (cash)'} — dispense
                  medicine now.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelected(null)}>
            Close
          </Button>
          {canApprove && (
            <Button variant="primary" disabled={saving} onClick={() => void approve()}>
              <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
              {saving ? 'Approving...' : 'Approve'}
            </Button>
          )}
          {canCollectAtPharmacy && (
            <Button variant="success" disabled={saving} onClick={() => void collectAtPharmacy()}>
              <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
              {saving ? 'Collecting...' : 'Collect Payment'}
            </Button>
          )}
          {canSendToReception && (
            <Button variant="warning" disabled={saving} onClick={() => void sendToReception()}>
              <IconifyIcon icon="solar:transfer-horizontal-broken" className="me-1" />
              {saving ? 'Sending...' : 'Send to Reception'}
            </Button>
          )}
          {canDispense && (
            <Button variant="success" disabled={saving} onClick={() => void dispense()}>
              <IconifyIcon icon="solar:pill-broken" className="me-1" />
              {saving ? 'Dispensing...' : 'Dispense Medicine'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default PrescriptionsPage
