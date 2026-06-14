import { useMemo, useState } from 'react'
import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { Badge, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  expenseRecords,
  getDashboardStats,
  getPatientHistory,
  incomeRecords,
  patients,
  staffUsers,
  visits,
} from '@/shared/services/hmsStore'

const AdminReportsPage = () => {
  const [historySearch, setHistorySearch] = useState('')
  const stats = getDashboardStats()
  const totalIncome = incomeRecords.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0)

  const filteredPatients = useMemo(() => {
    const q = historySearch.toLowerCase().trim()
    if (!q) return patients
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.id.toLowerCase().includes(q),
    )
  }, [historySearch, patients.length])

  const {
    pageItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useTablePagination(filteredPatients, 10, [filteredPatients.length, historySearch])

  return (
    <PermissionGuard permissions={['reports']}>
      <PageMetaData title="Admin Reports" />
      <PageHeader
        title="Administration Reports"
        subtitle="System-wide summary statistics"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Reports' },
        ]}
      />
      <Row>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Patients</p>
              <h3 className="mb-0">{patients.length}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Visits</p>
              <h3 className="mb-0">{visits.length}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Staff Members</p>
              <h3 className="mb-0">{staffUsers.length}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Today's Visits</p>
              <h3 className="mb-0">{stats.todayVisits}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Income</p>
              <h3 className="mb-0">{currency}{totalIncome.toFixed(2)}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Total Expenses</p>
              <h3 className="mb-0">{currency}{totalExpenses.toFixed(2)}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Outstanding Credit</p>
              <h3 className="mb-0 text-warning">{currency}{stats.totalOutstanding.toFixed(2)}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Today's Revenue</p>
              <h3 className="mb-0 text-success">{currency}{stats.todayRevenue.toFixed(2)}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md={6} xl={4} className="mb-3">
          <Card>
            <CardBody>
              <p className="text-muted mb-1">Net Balance</p>
              <h3 className="mb-0">{currency}{(totalIncome - totalExpenses).toFixed(2)}</h3>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <h5 className="mb-3">Patient Transaction History</h5>
          <p className="text-muted mb-3">
            View all transactions per patient — paid, on book, or outstanding debt. Download as PDF.
          </p>
          <Form.Control
            type="search"
            className="mb-3"
            placeholder="Search by patient name or phone number..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Outstanding</th>
                  <th>Transactions</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No patients match your search
                    </td>
                  </tr>
                ) : (
                  pageItems.map((patient) => {
                  const history = getPatientHistory(patient.id)
                  return (
                    <tr key={patient.id}>
                      <td className="fw-medium">{patient.id}</td>
                      <td>{patient.fullName}</td>
                      <td>{patient.phone}</td>
                      <td>
                        {currency}
                        {(history?.outstandingBalance ?? 0).toFixed(2)}
                      </td>
                      <td>{history?.entries.length ?? 0}</td>
                      <td>
                        {history?.hasDebt ? (
                          <Badge bg="warning">Has debt</Badge>
                        ) : (
                          <Badge bg="success">Clear</Badge>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/hms/patients/${patient.id}/history`}
                          className="btn btn-sm btn-soft-primary">
                          <IconifyIcon icon="solar:document-text-broken" className="me-1" />
                          History / PDF
                        </Link>
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

export default AdminReportsPage
