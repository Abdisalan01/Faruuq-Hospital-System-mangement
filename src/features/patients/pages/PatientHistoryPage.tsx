import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardBody, Col, Modal, Row, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import PrintablePatientHistory from '@/features/patients/components/PrintablePatientHistory'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { getPatientById, getPatientHistory } from '@/shared/services/hmsStore'
import type { PatientHistoryPaymentStatus } from '@/shared/types'

const statusVariant = (status: PatientHistoryPaymentStatus) => {
  if (status === 'Paid') return 'success'
  if (status === 'On book') return 'warning'
  return 'danger'
}

const PatientHistoryPage = () => {
  const { id } = useParams<{ id: string }>()
  const patient = id ? getPatientById(id) : undefined
  const history = useMemo(() => (id ? getPatientHistory(id) : null), [id])
  const [showPrint, setShowPrint] = useState(false)

  if (!patient || !history) {
    return (
      <PermissionGuard permissions={['register_patients', 'reports', 'user_management']}>
        <PageMetaData title="Patient History" />
        <div className="alert alert-warning">Patient not found.</div>
        <Link to="/hms/patients">Back to Patients</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['register_patients', 'reports', 'user_management']}>
      <PageMetaData title={`History — ${patient.fullName}`} />
      <PageHeader
        title="Patient History"
        subtitle={`All transactions for ${patient.fullName} (${patient.id})`}
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: patient.fullName, href: `/hms/patients/${patient.id}` },
          { label: 'History' },
        ]}>
        <Button variant="primary" onClick={() => setShowPrint(true)}>
          <IconifyIcon icon="solar:document-text-broken" className="me-1" />
          Download PDF
        </Button>
      </PageHeader>

      <Row className="mb-3 g-3">
        <Col md={4}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Charged</p>
              <h4 className="mb-0">
                {currency}
                {history.totalCharged.toFixed(2)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Paid</p>
              <h4 className="mb-0 text-success">
                {currency}
                {history.totalPaid.toFixed(2)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card className={history.hasDebt ? 'border-warning' : 'border-success'}>
            <CardBody>
              <p className="text-muted mb-1">Outstanding / Dayn</p>
              <h4 className={`mb-0 ${history.hasDebt ? 'text-warning' : 'text-success'}`}>
                {currency}
                {history.outstandingBalance.toFixed(2)}
              </h4>
              {history.hasDebt ? (
                <Badge bg="warning" className="mt-2">
                  Patient has debt
                </Badge>
              ) : (
                <Badge bg="success" className="mt-2">
                  No outstanding debt
                </Badge>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <h5 className="mb-3">Transaction Timeline ({history.entries.length})</h5>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Handled By</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No transactions recorded for this patient
                    </td>
                  </tr>
                ) : (
                  history.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.date).toLocaleString()}</td>
                      <td>{entry.category}</td>
                      <td>{entry.description}</td>
                      <td className="text-muted">{entry.reference ?? '—'}</td>
                      <td>
                        {entry.amount > 0 ? (
                          <>
                            {currency}
                            {entry.amount.toFixed(2)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <Badge bg={statusVariant(entry.paymentStatus)}>{entry.paymentStatus}</Badge>
                      </td>
                      <td className="text-muted">{entry.handledBy ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Modal
        show={showPrint}
        onHide={() => setShowPrint(false)}
        size="lg"
        centered
        className="a4-hospital-print-modal"
        dialogClassName="a4-hospital-print-dialog">
        <Modal.Header closeButton className="no-print">
          <Modal.Title>Patient History — PDF</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <PrintablePatientHistory history={history} />
        </Modal.Body>
        <Modal.Footer className="no-print">
          <Button variant="light" onClick={() => setShowPrint(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <IconifyIcon icon="solar:printer-broken" className="me-1" />
            Save as PDF / Print
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default PatientHistoryPage
