import { useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  generateId,
  generateNumber,
  getPatientById,
  getStaffServiceFee,
  getVisitById,
  incomeRecords,
  patients,
  payments,
  persistPatientsNowAsync,
  systemSettings,
  touchHmsStore,
  visits,
} from '@/shared/services/hmsStore'

const PaymentsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [patientId, setPatientId] = useState('')
  const [visitId, setVisitId] = useState('')
  const [amount, setAmount] = useState(systemSettings.consultationFee)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [description, setDescription] = useState('Consultation Fee')

  const patientVisits = patientId ? visits.filter((v) => v.patientId === patientId) : []

  const handleVisitChange = (vId: string) => {
    setVisitId(vId)
    if (!vId) return
    const visit = getVisitById(vId)
    if (visit) {
      const fee = getStaffServiceFee(visit.assignedDoctorId)
      setAmount(fee)
      setDescription('Consultation Fee')
    }
  }

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [payments.length, refresh],
  )

  const {
    pageItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useTablePagination(sortedPayments, 10, [sortedPayments.length, refresh])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const receiptNumber = generateNumber('RCP')
    const payment = {
      id: generateId('pay'),
      patientId,
      visitId: visitId || undefined,
      amount: Number(amount),
      paymentMethod,
      receiptNumber,
      description,
      receivedBy: user?.id ?? 'staff-002',
      createdAt: new Date().toISOString(),
    }
    payments.push(payment)
    const visit = visitId ? getVisitById(visitId) : undefined
    incomeRecords.push({
      id: generateId('inc'),
      category: description.toLowerCase().includes('registration') ? 'Registration' : 'Consultation',
      amount: Number(amount),
      description: `${description} — ${getPatientById(patientId)?.fullName ?? 'Patient'}`,
      reference: visitId || payment.id,
      doctorId: visit?.assignedDoctorId,
      receivedBy: user?.id ?? 'staff-002',
      createdAt: new Date().toISOString(),
    })
    touchHmsStore()
    setSaving(true)
    setMessage(null)
    try {
      if (isSupabase) await persistPatientsNowAsync()
      setMessage({
        type: 'success',
        text: `Payment recorded — ${receiptNumber}.${isSupabase ? ' Saved to database.' : ''}`,
      })
      setPatientId('')
      setVisitId('')
      setAmount(systemSettings.consultationFee)
      setDescription('Consultation Fee')
      setRefresh((r) => r + 1)
    } catch {
      setMessage({ type: 'danger', text: 'Payment saved locally but database sync failed.' })
      setRefresh((r) => r + 1)
    } finally {
      setSaving(false)
    }
  }

  const printReceipt = (receiptNumber: string) => {
    window.print()
    alert(`Receipt ${receiptNumber} sent to printer.`)
  }

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Payments" />
      <PageHeader
        title="Receive Payment"
        subtitle="Record patient payments and print receipts"
        breadcrumbs={[
          { label: 'Visits', href: '/hms/reception/billing' },
          { label: 'Payments' },
        ]}
      />

      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">
          {message.text}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <h5 className="mb-3">New Payment</h5>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Patient</Form.Label>
                  <Form.Select
                    value={patientId}
                    onChange={(e) => {
                      setPatientId(e.target.value)
                      setVisitId('')
                    }}
                    required
                  >
                    <option value="">Select patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Visit (optional)</Form.Label>
                  <Form.Select value={visitId} onChange={(e) => handleVisitChange(e.target.value)} disabled={!patientId}>
                    <option value="">None</option>
                    {patientVisits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.visitNumber} — {v.visitDate}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Amount ({currency})</Form.Label>
                  <Form.Control type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Method</Form.Label>
                  <Form.Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control value={description} onChange={(e) => setDescription(e.target.value)} required />
                </Form.Group>
              </Col>
            </Row>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? 'Saving…' : 'Record Payment'}
            </Button>
          </Form>
        </CardBody>
      </Card>

      <Card key={refresh}>
        <CardBody>
          <h5 className="mb-3">Payment History</h5>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No payments recorded
                    </td>
                  </tr>
                ) : (
                  pageItems.map((payment) => {
                    const patient = getPatientById(payment.patientId)
                    return (
                      <tr key={payment.id}>
                        <td className="fw-medium">{payment.receiptNumber}</td>
                        <td>{new Date(payment.createdAt).toLocaleString()}</td>
                        <td>{patient?.fullName ?? 'Unknown'}</td>
                        <td>{payment.description}</td>
                        <td>{payment.paymentMethod}</td>
                        <td>{currency}{payment.amount.toFixed(2)}</td>
                        <td>
                          <PermissionGuard permissions={['print_receipts']}>
                            <Button size="sm" variant="soft-primary" onClick={() => printReceipt(payment.receiptNumber)}>
                              <IconifyIcon icon="solar:printer-broken" className="me-1" />
                              Print
                            </Button>
                          </PermissionGuard>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            safePage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default PaymentsPage
