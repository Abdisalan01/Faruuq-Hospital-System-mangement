import { useState } from 'react'
import { Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  addAccountPayment,
  getPatientById,
  patientAccounts,
  persistCreditPaymentNowAsync,
} from '@/shared/services/hmsStore'

const PatientCreditPage = () => {
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const [refresh, setRefresh] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')

  const accounts = patientAccounts.filter((a) => a.outstandingBalance > 0)

  const {
    pageItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useTablePagination(patientAccounts, 10, [patientAccounts.length, refresh])

  const openPaymentModal = (patientId: string, balance: number) => {
    setSelectedPatientId(patientId)
    setPaymentAmount(String(balance))
    setShowModal(true)
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (amount <= 0) return
    addAccountPayment(selectedPatientId, amount, user?.id ?? 'staff-002')
    try {
      if (isSupabase) await persistCreditPaymentNowAsync()
    } catch {
      return
    }
    setShowModal(false)
    setRefresh((r) => r + 1)
  }

  return (
    <PermissionGuard permissions={['manage_patient_credit']}>
      <PageMetaData title="Credit Accounts" />
      <PageHeader
        title="Patient Credit Accounts"
        subtitle="Outstanding balances and payments"
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: 'Credit Accounts' },
        ]}
      />
      <Card key={refresh}>
        <CardBody>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Payment Type</th>
                  <th>Outstanding Balance</th>
                  <th>Account Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patientAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No credit accounts found
                    </td>
                  </tr>
                ) : (
                  pageItems.map((account) => {
                    const patient = getPatientById(account.patientId)
                    return (
                      <tr key={account.id}>
                        <td>
                          {patient ? (
                            <Link to={`/hms/patients/${patient.id}`} className="fw-medium">
                              {patient.fullName}
                            </Link>
                          ) : (
                            'Unknown'
                          )}
                        </td>
                        <td>{patient?.phone ?? '—'}</td>
                        <td>{patient?.paymentType ?? '—'}</td>
                        <td className={account.outstandingBalance > 0 ? 'text-warning fw-medium' : 'text-success'}>
                          {currency}{account.outstandingBalance.toFixed(2)}
                        </td>
                        <td>{account.createdAt}</td>
                        <td>
                          {account.outstandingBalance > 0 && (
                            <Button size="sm" variant="soft-success" onClick={() => openPaymentModal(account.patientId, account.outstandingBalance)}>
                              Receive Payment
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
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            safePage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
          {accounts.length > 0 && (
            <p className="text-muted mt-3 mb-0">
              Total outstanding: {currency}
              {accounts.reduce((s, a) => s + a.outstandingBalance, 0).toFixed(2)}
            </p>
          )}
        </CardBody>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Receive Credit Payment</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handlePayment}>
          <Modal.Body>
            <Row>
              <Col>
                <Form.Group>
                  <Form.Label>Patient</Form.Label>
                  <Form.Control value={getPatientById(selectedPatientId)?.fullName ?? ''} disabled />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label>Amount ({currency})</Form.Label>
                  <Form.Control
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success">
              Record Payment
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </PermissionGuard>
  )
}

export default PatientCreditPage
