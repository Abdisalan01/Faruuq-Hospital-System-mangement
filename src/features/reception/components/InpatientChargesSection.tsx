import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import PrintableReceipt from '@/features/reception/components/PrintableReceipt'
import type { InpatientChargeRow, ReceptionReceipt } from '@/shared/types'
import {
  buildInpatientChargeReceipt,
  clampDiscountPercent,
  collectInpatientChargePayment,
  collectInpatientTotalPayment,
  getAdmissionById,
  getInpatientBillingLedger,
  getInpatientOutstandingTotal,
  getLatestInpatientCheckoutReceipt,
  getMaxDiscountPercent,
  getVisitById,
  isInpatientChargePaid,
  persistInpatientPaymentNowAsync,
} from '@/shared/services/hmsStore'
import { discountAmountFromPercent, parseDiscountPercent } from '@/shared/utils/discountLimits'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'
import type { UserRole } from '@/shared/types/roles'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'

type InpatientChargesSectionProps = {
  admissionId: string
  receptionId: string
  userRole: UserRole
  isSupabase: boolean
  dataVersion: number
  onRefresh: () => void
  onDischarged?: () => void
  showDiscount?: boolean
  compact?: boolean
}

const InpatientChargesSection = ({
  admissionId,
  receptionId,
  userRole,
  isSupabase,
  dataVersion,
  onRefresh,
  onDischarged,
  showDiscount = true,
  compact = false,
}: InpatientChargesSectionProps) => {
  const maxDiscount = getMaxDiscountPercent(userRole, 'inpatient')
  const [discountInput, setDiscountInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const adm = getAdmissionById(admissionId)
  const visit = adm ? getVisitById(adm.visitId) : undefined

  const ledger = useMemo(
    () => getInpatientBillingLedger(admissionId),
    [admissionId, dataVersion],
  )
  const totalOutstanding = useMemo(
    () => getInpatientOutstandingTotal(admissionId),
    [admissionId, dataVersion, ledger.length],
  )
  const latestCheckoutReceipt = useMemo(
    () => getLatestInpatientCheckoutReceipt(admissionId),
    [admissionId, dataVersion],
  )

  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'inpatient', parseDiscountPercent(raw))
  const discountPercent = appliedDiscountPercent(discountInput)
  const totalDiscountAmount = discountAmountFromPercent(totalOutstanding, discountPercent)
  const totalAfterDiscount = Math.max(0, totalOutstanding - totalDiscountAmount)

  const buildDiscountOptions = (subtotal: number) => {
    const percent = appliedDiscountPercent(discountInput)
    const amount = discountAmountFromPercent(subtotal, percent)
    return {
      discountPercent: percent > 0 ? percent : undefined,
      discountAmount: amount,
    }
  }

  const getStatusBadge = (status: InpatientChargeRow['status']) => {
    if (isInpatientChargePaid(status)) {
      return <Badge bg="success-subtle" text="success">Paid</Badge>
    }
    return <Badge bg="danger-subtle" text="danger">Unpaid</Badge>
  }

  const getRowActionLabel = (row: InpatientChargeRow): string | null => {
    if (isInpatientChargePaid(row.status)) return 'Print receipt'
    return 'Collect payment'
  }

  const handleRowAction = async (row: InpatientChargeRow) => {
    if (!adm) return
    setError('')
    setMessage('')

    if (isInpatientChargePaid(row.status)) {
      setPrintReceipt(buildInpatientChargeReceipt(adm, row, receptionId))
      setShowPrintModal(true)
      return
    }

    const discount = buildDiscountOptions(row.amount)
    const paidAmount = Math.max(0, row.amount - discount.discountAmount)
    setSaving(true)
    try {
      const result = collectInpatientChargePayment(admissionId, row, receptionId, discount)
      if (!result.ok) {
        setError(result.error ?? 'Could not collect payment.')
        return
      }
      if (row.sourceType === 'lab' && visit) refreshVisitWorkflow(visit.id)
      if (row.sourceType === 'pharmacy' && visit) refreshVisitWorkflow(visit.id)
      if (isSupabase) await persistInpatientPaymentNowAsync()
      setMessage(
        `Collected ${currency}${paidAmount.toFixed(2)}.${isSupabase ? ' Saved to database.' : ''}${
          result.discharged ? ' Patient discharged.' : ''
        }`,
      )
      if (result.receipt) {
        setPrintReceipt(result.receipt)
        setShowPrintModal(true)
      }
      if (result.discharged) onDischarged?.()
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment.')
    } finally {
      setSaving(false)
    }
  }

  const handleTotalPaid = async () => {
    if (!adm || totalOutstanding <= 0) return
    setError('')
    setMessage('')

    const discount = buildDiscountOptions(totalOutstanding)
    setSaving(true)
    try {
      const result = collectInpatientTotalPayment(admissionId, receptionId, discount)
      if (!result.ok) {
        setError(result.error ?? 'Could not collect total payment.')
        return
      }
      if (visit) refreshVisitWorkflow(visit.id)
      if (isSupabase) await persistInpatientPaymentNowAsync()
      setMessage(
        `Total paid ${currency}${totalAfterDiscount.toFixed(2)}.${isSupabase ? ' Saved to database.' : ''}${
          result.discharged ? ' Patient discharged.' : ''
        }`,
      )
      if (result.receipt) {
        setPrintReceipt(result.receipt)
        setShowPrintModal(true)
      }
      if (result.discharged) onDischarged?.()
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment.')
    } finally {
      setSaving(false)
    }
  }

  const bedRows = ledger.filter((r) => r.sourceType === 'bed')

  const {
    pageItems: ledgerPageItems,
    setPage: setLedgerPage,
    safePage: ledgerPage,
    totalPages: ledgerTotalPages,
    rangeStart: ledgerRangeStart,
    rangeEnd: ledgerRangeEnd,
    totalItems: ledgerTotalItems,
  } = useTablePagination(ledger, 10, [ledger.length, admissionId, dataVersion])

  return (
    <div className={compact ? 'mt-3' : 'mt-3'}>
      <Alert variant="info" className="py-2 small mb-3">
        <IconifyIcon icon="solar:bed-broken" className="me-1" />
        Bed fee starts on the assignment date. One charge is added each night until the doctor
        discharges the patient. Collect payments below.
        {bedRows.length > 0 && (
          <span className="d-block mt-1 text-muted">
            {bedRows.length} night{bedRows.length !== 1 ? 's' : ''} billed
            {adm?.status === 'Active' ? ' · updates automatically each day' : ''}
          </span>
        )}
      </Alert>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2">
          {error}
        </Alert>
      )}

      {showDiscount && totalOutstanding > 0 && (
        <Row className="g-3 mb-3 align-items-end">
          <Col sm={6}>
            <Form.Group className="mb-0">
              <Form.Label className="small">Discount (%) — optional</Form.Label>
              <div className="input-group input-group-sm">
                <Form.Control
                  type="number"
                  min={0}
                  max={maxDiscount}
                  step={0.01}
                  placeholder="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
                <span className="input-group-text">%</span>
              </div>
              <Form.Text className="text-muted">
                Maximum: <strong>{maxDiscount}%</strong>
              </Form.Text>
            </Form.Group>
          </Col>
          <Col sm={6}>
            <div className="p-2 bg-primary bg-opacity-10 rounded border border-primary border-opacity-25 small">
              <div className="d-flex justify-content-between">
                <span>Subtotal (unpaid)</span>
                <span>
                  {currency}
                  {totalOutstanding.toFixed(2)}
                </span>
              </div>
              {totalDiscountAmount > 0 && (
                <div className="d-flex justify-content-between text-success">
                  <span>Discount ({discountPercent}%)</span>
                  <span>
                    −{currency}
                    {totalDiscountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="d-flex justify-content-between fw-semibold mt-1 pt-1 border-top">
                <span>Total due</span>
                <span>
                  {currency}
                  {totalAfterDiscount.toFixed(2)}
                </span>
              </div>
            </div>
          </Col>
        </Row>
      )}

      <h6 className="mb-2">Bed & inpatient charges</h6>
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
              {ledgerPageItems.map((row) => {
                const actionLabel = getRowActionLabel(row)
                return (
                  <tr key={row.id}>
                    <td className="small">{row.date}</td>
                    <td className="small">{row.description}</td>
                    <td className="text-end small">
                      {currency}
                      {row.amount.toFixed(2)}
                    </td>
                    <td>{getStatusBadge(row.status)}</td>
                    <td>
                      {actionLabel ? (
                        <Button
                          size="sm"
                          variant={isInpatientChargePaid(row.status) ? 'outline-secondary' : 'success'}
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
            {!compact && (
              <tfoot className="bg-light">
                <tr>
                  <td colSpan={2} className="fw-semibold text-end">
                    Total Unpaid
                  </td>
                  <td className="text-end fw-bold">
                    {currency}
                    {totalAfterDiscount.toFixed(2)}
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
                      <Button
                        size="sm"
                        variant="success"
                        disabled={saving}
                        onClick={() => void handleTotalPaid()}
                      >
                        Total Paid
                      </Button>
                    ) : latestCheckoutReceipt ? (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setPrintReceipt(latestCheckoutReceipt)
                          setShowPrintModal(true)
                        }}
                      >
                        <IconifyIcon icon="solar:printer-broken" className="me-1" />
                        Print receipt
                      </Button>
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            )}
          </Table>
          <TablePagination
            className="pt-2"
            totalItems={ledgerTotalItems}
            rangeStart={ledgerRangeStart}
            rangeEnd={ledgerRangeEnd}
            safePage={ledgerPage}
            totalPages={ledgerTotalPages}
            onPageChange={setLedgerPage}
            disabled={saving}
          />
        </div>
      )}

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        centered
        className="thermal-print-modal"
        dialogClassName="thermal-print-dialog"
      >
        <Modal.Header closeButton className="no-print">
          <Modal.Title>Print receipt</Modal.Title>
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
    </div>
  )
}

export default InpatientChargesSection
