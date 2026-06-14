import { useMemo, useState } from 'react'
import { Card, CardBody, Nav, Tab, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  getStaffById,
  incomeRecords,
  labRequests,
  payments,
  prescriptions,
  receptionReceipts,
  staffUsers,
  visits,
} from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

type ReportTab = 'pharmacy' | 'doctors' | 'reception'

const AdminOperationalReportsPage = () => {
  const [tab, setTab] = useState<ReportTab>('pharmacy')

  const pharmacyRows = useMemo(() => {
    const rxIncome = incomeRecords.filter((r) => r.category === 'Pharmacy')
    const pending = prescriptions.filter((p) => p.status === 'Pending').length
    const dispensed = prescriptions.filter((p) => p.status === 'Dispensed').length
    const total = rxIncome.reduce((s, r) => s + r.amount, 0)
    return { pending, dispensed, total, rxIncome }
  }, [prescriptions.length, incomeRecords.length])

  const doctorRows = useMemo(() => {
    const doctors = staffUsers.filter((u) => u.role === 'doctor' && u.isActive)
    return doctors.map((doc) => {
      const docVisits = visits.filter((v) => v.assignedDoctorId === doc.id)
      const docLabs = labRequests.filter((l) => l.doctorId === doc.id)
      const docRx = prescriptions.filter((p) => p.doctorId === doc.id)
      const docIncome = incomeRecords
        .filter((r) => r.doctorId === doc.id)
        .reduce((s, r) => s + r.amount, 0)
      return {
        id: doc.id,
        name: `Dr. ${doc.firstName} ${doc.lastName}`,
        visits: docVisits.length,
        labs: docLabs.length,
        prescriptions: docRx.length,
        income: docIncome,
        fee: doc.serviceFee,
      }
    })
  }, [staffUsers.length, visits.length, labRequests.length, prescriptions.length])

  const receptionRows = useMemo(() => {
    const staff = staffUsers.filter(
      (u) => u.role === 'reception_cashier' && u.isActive,
    )
    return staff.map((rec) => {
      const recPayments = payments.filter((p) => p.receivedBy === rec.id)
      const recReceipts = receptionReceipts.filter((r) => r.createdBy === rec.id)
      const total = recPayments.reduce((s, p) => s + p.amount, 0)
      return {
        id: rec.id,
        name: `${rec.firstName} ${rec.lastName}`,
        payments: recPayments.length,
        receipts: recReceipts.length,
        total,
        fee: rec.serviceFee,
      }
    })
  }, [staffUsers.length, payments.length, receptionReceipts.length])

  const pharmacyIncomePagination = useTablePagination(pharmacyRows.rxIncome, 10, [
    pharmacyRows.rxIncome.length,
    tab,
  ])
  const doctorPagination = useTablePagination(doctorRows, 10, [doctorRows.length, tab])
  const receptionPagination = useTablePagination(receptionRows, 10, [receptionRows.length, tab])

  return (
    <PermissionGuard permissions={['reports', 'user_management']}>
      <PageMetaData title="Operational Reports" />
      <PageHeader
        title="Reports"
        subtitle="Pharmacy, doctors, and reception activity"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Reports' },
        ]}
      />

      <Tab.Container activeKey={tab} onSelect={(k) => setTab((k as ReportTab) ?? 'pharmacy')}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="pharmacy">Pharmacy</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="doctors">Doctors</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="reception">Reception</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="pharmacy">
            <Card className="mb-3">
              <CardBody>
                <div className="d-flex flex-wrap gap-4">
                  <div>
                    <p className="text-muted mb-1 small">Pending prescriptions</p>
                    <h4 className="mb-0">{pharmacyRows.pending}</h4>
                  </div>
                  <div>
                    <p className="text-muted mb-1 small">Dispensed</p>
                    <h4 className="mb-0">{pharmacyRows.dispensed}</h4>
                  </div>
                  <div>
                    <p className="text-muted mb-1 small">Pharmacy income</p>
                    <h4 className="mb-0">
                      {currency}
                      {pharmacyRows.total.toLocaleString()}
                    </h4>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-0">
                <Table hover className="mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmacyRows.rxIncome.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-4">
                          No pharmacy income records
                        </td>
                      </tr>
                    ) : (
                      pharmacyIncomePagination.pageItems.map((r) => (
                        <tr key={r.id}>
                          <td>{r.createdAt.split('T')[0]}</td>
                          <td>{r.description}</td>
                          <td className="text-end">
                            {currency}
                            {r.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
                <div className="p-3">
                  <TablePagination
                    className="pt-3 border-top"
                    totalItems={pharmacyIncomePagination.totalItems}
                    rangeStart={pharmacyIncomePagination.rangeStart}
                    rangeEnd={pharmacyIncomePagination.rangeEnd}
                    safePage={pharmacyIncomePagination.safePage}
                    totalPages={pharmacyIncomePagination.totalPages}
                    onPageChange={pharmacyIncomePagination.setPage}
                  />
                </div>
              </CardBody>
            </Card>
          </Tab.Pane>

          <Tab.Pane eventKey="doctors">
            <Card>
              <CardBody className="p-0">
                <Table hover className="mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Doctor</th>
                      <th>Registration Fee</th>
                      <th>Visits</th>
                      <th>Lab Orders</th>
                      <th>Prescriptions</th>
                      <th className="text-end">Income Linked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No doctors found
                        </td>
                      </tr>
                    ) : (
                      doctorPagination.pageItems.map((row) => (
                        <tr key={row.id}>
                          <td className="fw-medium">{row.name}</td>
                          <td>
                            {row.fee != null ? `${currency}${row.fee}` : '—'}
                          </td>
                          <td>{row.visits}</td>
                          <td>{row.labs}</td>
                          <td>{row.prescriptions}</td>
                          <td className="text-end">
                            {currency}
                            {row.income.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
                <div className="p-3">
                  <TablePagination
                    className="pt-3 border-top"
                    totalItems={doctorPagination.totalItems}
                    rangeStart={doctorPagination.rangeStart}
                    rangeEnd={doctorPagination.rangeEnd}
                    safePage={doctorPagination.safePage}
                    totalPages={doctorPagination.totalPages}
                    onPageChange={doctorPagination.setPage}
                  />
                </div>
              </CardBody>
            </Card>
          </Tab.Pane>

          <Tab.Pane eventKey="reception">
            <Card>
              <CardBody className="p-0">
                <Table hover className="mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Reception Staff</th>
                      <th>Role</th>
                      <th>Service Fee</th>
                      <th>Payments</th>
                      <th>Receipts</th>
                      <th className="text-end">Total Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receptionRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No reception staff found
                        </td>
                      </tr>
                    ) : (
                      receptionPagination.pageItems.map((row) => {
                        const staff = getStaffById(row.id)
                        return (
                          <tr key={row.id}>
                            <td className="fw-medium">{row.name}</td>
                            <td>
                              <StatusBadge status={ROLE_LABELS[staff?.role ?? 'reception_cashier']} />
                            </td>
                            <td>
                              {row.fee != null ? `${currency}${row.fee}` : '—'}
                            </td>
                            <td>{row.payments}</td>
                            <td>{row.receipts}</td>
                            <td className="text-end">
                              {currency}
                              {row.total.toLocaleString()}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
                <div className="p-3">
                  <TablePagination
                    className="pt-3 border-top"
                    totalItems={receptionPagination.totalItems}
                    rangeStart={receptionPagination.rangeStart}
                    rangeEnd={receptionPagination.rangeEnd}
                    safePage={receptionPagination.safePage}
                    totalPages={receptionPagination.totalPages}
                    onPageChange={receptionPagination.setPage}
                  />
                </div>
              </CardBody>
            </Card>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </PermissionGuard>
  )
}

export default AdminOperationalReportsPage
