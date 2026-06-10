import { Card, CardBody, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { getPatientById, payments } from '@/shared/services/hmsStore'

const ReceiptsPage = () => (
  <PermissionGuard permissions={['print_receipts', 'receive_payments']}>
    <PageMetaData title="Receipts" />
    <PageHeader title="Payment Receipts" breadcrumbs={[{ label: 'Reception & Cashier' }, { label: 'Receipts' }]} />
    <Card>
      <CardBody className="p-0">
        <div className="table-responsive">
          <Table className="mb-0">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th>Receipt #</th>
                <th>Patient</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Description</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receiptNumber}</td>
                  <td>{getPatientById(p.patientId)?.fullName}</td>
                  <td>
                    {currency}
                    {p.amount}
                  </td>
                  <td>{p.paymentMethod}</td>
                  <td>{p.description}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardBody>
    </Card>
  </PermissionGuard>
)

export default ReceiptsPage
