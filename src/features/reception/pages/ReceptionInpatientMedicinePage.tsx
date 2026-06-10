import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PrintableReceipt from '@/features/reception/components/PrintableReceipt'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  chargeInpatientMedicineToBookAtReception,
  collectInpatientMedicinePaymentAtReception,
  estimatePrescriptionTotalFee,
  getInpatientMedicinePaymentSummary,
  getNursingInpatientMedicineRequests,
  getPatientById,
  getPrescriptionDispenseBilling,
  inventoryItems,
  isInpatientMedicineActive,
  isInpatientMedicinePaymentCollected,
  persistInpatientMedicinePaymentNowAsync,
  prescriptions as storePrescriptions,
} from '@/shared/services/hmsStore'
import type { Prescription, ReceptionReceipt } from '@/shared/types'

const PAGE_SIZE = 10

type StatusFilter = 'active' | 'inactive'

const findInventoryItem = (medicineName: string) => {
  const lower = medicineName.toLowerCase()
  return inventoryItems.find(
    (i) =>
      i.name.toLowerCase().includes(lower) ||
      lower.includes(i.name.toLowerCase().split(' ')[0]),
  )
}

const ReceptionInpatientMedicinePage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<Prescription | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const refresh = () => setTick((t) => t + 1)

  const allRequests = useMemo(
    () => getNursingInpatientMedicineRequests('Approved'),
    [tick, dataVersion, storePrescriptions.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRequests.filter((rx) => {
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
  }, [allRequests, search, statusFilter])

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

  const activeCount = allRequests.filter((p) => isInpatientMedicineActive(p)).length
  const inactiveCount = allRequests.length - activeCount

  const modalSummary = selected ? getInpatientMedicinePaymentSummary(selected) : null
  const modalPatient = selected ? getPatientById(selected.patientId) : undefined
  const modalBilling = selected ? getPrescriptionDispenseBilling(selected) : null
  const modalPaid = selected ? isInpatientMedicinePaymentCollected(selected) : false
  const canCollectCash = selected && !modalPaid && modalBilling === 'inpatient_cash'
  const canAddToBook = selected && !modalPaid && modalBilling === 'inpatient_credit_book'

  const handleCollectPayment = async () => {
    if (!selected || !user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const result = collectInpatientMedicinePaymentAtReception(selected.id, user.id)
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error ?? 'Could not collect payment.' })
        return
      }
      if (isSupabase) await persistInpatientMedicinePaymentNowAsync()
      setMessage({ type: 'success', text: 'Payment collected — request is now inactive for pharmacy.' })
      if (result.receipt) {
        setPrintReceipt(result.receipt)
        setShowPrintModal(true)
      }
      setSelected(null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Payment saved locally but database sync failed.' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleAddToBook = async () => {
    if (!selected || !user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const result = chargeInpatientMedicineToBookAtReception(selected.id, user.id)
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error ?? 'Could not charge credit book.' })
        return
      }
      if (isSupabase) await persistInpatientMedicinePaymentNowAsync()
      setMessage({ type: 'success', text: 'Charged to credit book — request is now inactive for pharmacy.' })
      setSelected(null)
      refresh()
    } catch {
      setMessage({ type: 'danger', text: 'Charge saved locally but database sync failed.' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Inpatient Medicine" />
      <PageHeader
        title="Inpatient Medicine"
        subtitle="Collect payment or charge credit book — pharmacy dispenses after payment"
        breadcrumbs={[
          { label: 'HMS', href: '/hms/dashboard' },
          { label: 'Reception', href: '/hms/reception/dashboard' },
          { label: 'Inpatient Medicine' },
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
            <strong>Active</strong> = awaiting payment · <strong>Inactive</strong> = payment
            collected — click a row for details
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
                  <th>Phone</th>
                  <th>Patient ID</th>
                  <th>Medicines</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Remaining</th>
                  <th>Status</th>
                  <th>Billing</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-5">
                      No inpatient medicine requests match your filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((rx) => {
                    const patient = getPatientById(rx.patientId)
                    const { total, paid, remaining } = getInpatientMedicinePaymentSummary(rx)
                    const isActive = isInpatientMedicineActive(rx)
                    const billing = getPrescriptionDispenseBilling(rx)
                    return (
                      <tr
                        key={rx.id}
                        role="button"
                        className="cursor-pointer"
                        onClick={() => setSelected(rx)}
                      >
                        <td className="fw-medium">{patient?.fullName ?? '—'}</td>
                        <td className="small">{patient?.phone ?? '—'}</td>
                        <td className="small">{patient?.id ?? '—'}</td>
                        <td className="small" style={{ maxWidth: 200 }}>
                          {rx.items.map((i) => i.medicine).join(', ')}
                        </td>
                        <td className="text-end">
                          {currency}
                          {total.toFixed(2)}
                        </td>
                        <td className="text-end text-success">
                          {currency}
                          {paid.toFixed(2)}
                        </td>
                        <td className="text-end text-danger">
                          {currency}
                          {remaining.toFixed(2)}
                        </td>
                        <td>
                          <Badge
                            bg={isActive ? 'warning-subtle' : 'success-subtle'}
                            text={isActive ? 'warning' : 'success'}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="small">
                          {billing === 'inpatient_credit_book' ? 'Credit book' : 'Cash'}
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
                  <div className="mt-2">
                    <Badge
                      bg={isInpatientMedicineActive(selected) ? 'warning-subtle' : 'success-subtle'}
                      text={isInpatientMedicineActive(selected) ? 'warning' : 'success'}
                    >
                      {isInpatientMedicineActive(selected)
                        ? 'Active — awaiting payment'
                        : 'Inactive — payment collected'}
                    </Badge>
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

              {modalPaid && (
                <Alert variant="success" className="small mb-0">
                  Payment collected
                  {selected.paymentMethod ? ` (${selected.paymentMethod})` : ''}. Pharmacy can
                  dispense medicine.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelected(null)}>
            Close
          </Button>
          {canCollectCash && (
            <Button variant="success" disabled={saving} onClick={() => void handleCollectPayment()}>
              <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
              {saving ? 'Collecting...' : 'Collect Payment'}
            </Button>
          )}
          {canAddToBook && (
            <Button variant="primary" disabled={saving} onClick={() => void handleAddToBook()}>
              <IconifyIcon icon="solar:notebook-bookmark-broken" className="me-1" />
              {saving ? 'Saving...' : 'Add to Book'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        size="sm"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Print Receipt</Modal.Title>
        </Modal.Header>
        <Modal.Body>{printReceipt && <PrintableReceipt receipt={printReceipt} />}</Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowPrintModal(false)}>
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

export default ReceptionInpatientMedicinePage
