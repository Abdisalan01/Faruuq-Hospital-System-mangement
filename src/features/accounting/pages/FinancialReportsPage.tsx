import { useMemo, useState } from 'react'
import { Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import StatCard from '@/shared/components/StatCard'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  filterExpensesByDateRange,
  filterIncomeByDateRange,
  getDateRange,
  getIncomeByCategory,
  getSupplyExpenses,
  getTodayReceptionSummary,
} from '@/shared/services/hmsStore'
import type { DateFilterPeriod } from '@/shared/services/hmsStore'
import { downloadCsv } from '@/shared/utils/exportCsv'

const FinancialReportsPage = () => {
  const [period, setPeriod] = useState<DateFilterPeriod>('day')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [, setTick] = useState(0)

  const { start, end } = getDateRange(period, customStart || undefined, customEnd || undefined)
  const income = useMemo(() => filterIncomeByDateRange(start, end), [start, end, setTick])
  const expenses = useMemo(() => filterExpensesByDateRange(start, end), [start, end, setTick])
  const incomeByCategory = useMemo(() => getIncomeByCategory(income), [income])
  const totalIncome = income.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  const supplyExpenses = useMemo(() => getSupplyExpenses(start, end), [start, end, setTick])
  const todaySummary = getTodayReceptionSummary()

  const periodLabel =
    period === 'day'
      ? 'Today'
      : period === 'week'
        ? 'This Week'
        : period === 'month'
          ? 'This Month'
          : `${start} — ${end}`

  const exportIncome = () => {
    downloadCsv(
      `income-${start}-${end}`,
      ['Date', 'Category', 'Description', 'Amount'],
      income.map((r) => [
        r.createdAt.split('T')[0],
        r.category,
        r.description,
        r.amount,
      ]),
    )
  }

  const exportExpenses = () => {
    downloadCsv(
      `expenses-${start}-${end}`,
      ['Date', 'Category', 'Description', 'Amount'],
      expenses.map((r) => [r.createdAt.split('T')[0], r.category, r.description, r.amount]),
    )
  }

  const printReport = () => window.print()

  return (
    <PermissionGuard permissions={['accounting', 'reports']}>
      <PageMetaData title="Financial Reports" />
      <PageHeader
        title="Accounting Reports"
        subtitle="Hospital income, expenses, and reception collections — print or export to Excel"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Financial Reports' },
        ]}
      >
        <Button variant="outline-primary" onClick={exportIncome}>
          <IconifyIcon icon="solar:file-download-broken" className="me-1" />
          Export Income
        </Button>
        <Button variant="outline-secondary" onClick={exportExpenses}>
          <IconifyIcon icon="solar:file-download-broken" className="me-1" />
          Export Expenses
        </Button>
        <Button variant="light" onClick={printReport}>
          <IconifyIcon icon="solar:printer-broken" className="me-1" />
          Print
        </Button>
      </PageHeader>

      <Card className="mb-3">
        <CardBody>
          <Row className="align-items-end g-2">
            <Col md={3}>
              <Form.Label>Period</Form.Label>
              <Form.Select value={period} onChange={(e) => setPeriod(e.target.value as DateFilterPeriod)}>
                <option value="day">Today (Day)</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Selected Date Range</option>
              </Form.Select>
            </Col>
            {period === 'custom' && (
              <>
                <Col md={3}>
                  <Form.Label>From</Form.Label>
                  <Form.Control type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Label>To</Form.Label>
                  <Form.Control type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </Col>
              </>
            )}
            <Col md={period === 'custom' ? 3 : 9} className="text-md-end">
              <Button variant="primary" onClick={() => setTick((t) => t + 1)}>
                Apply Filter
              </Button>
              <span className="text-muted ms-2 small">{periodLabel}</span>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Row className="mb-3">
        <StatCard title="Total Income" value={`${currency}${totalIncome.toLocaleString()}`} icon="solar:dollar-minimalistic-broken" variant="success" />
        <StatCard title="Total Expenses" value={`${currency}${totalExpenses.toLocaleString()}`} icon="solar:wallet-money-broken" variant="danger" />
        <StatCard title="Net (Income − Expenses)" value={`${currency}${(totalIncome - totalExpenses).toLocaleString()}`} icon="solar:chart-2-broken" variant="primary" />
        <StatCard title="Supply Expenses" value={`${currency}${supplyExpenses.toLocaleString()}`} icon="solar:box-broken" variant="warning" />
      </Row>

      <Row>
        <Col lg={6} className="mb-3">
          <Card>
            <CardBody>
              <h5 className="mb-3">Income by Category — {periodLabel}</h5>
              <Table size="sm" className="mb-0">
                <thead className="bg-light bg-opacity-50">
                  <tr>
                    <th>Category</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(incomeByCategory).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-muted text-center py-3">
                        No income in this period
                      </td>
                    </tr>
                  ) : (
                    Object.entries(incomeByCategory).map(([cat, amt]) => (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td className="text-end text-success">
                          {currency}
                          {amt.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {totalIncome > 0 && (
                  <tfoot>
                    <tr className="fw-bold">
                      <td>Total</td>
                      <td className="text-end text-success">
                        {currency}
                        {totalIncome.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardBody>
          </Card>
        </Col>

        <Col lg={6} className="mb-3">
          <Card>
            <CardBody>
              <h5 className="mb-3">Expenses — {periodLabel}</h5>
              <Table size="sm" className="mb-0">
                <thead className="bg-light bg-opacity-50">
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-muted text-center py-3">
                        No expenses in this period
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.category}</td>
                        <td>{e.description}</td>
                        <td className="text-end text-danger">
                          {currency}
                          {e.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <p className="text-muted small mt-2 mb-0">
                Supply expenses include medicines/gloves used internally by doctors and nurses (Internal Usage + Supply Expenses category).
              </p>
            </CardBody>
          </Card>
        </Col>

        <Col lg={12} className="mb-3">
          <Card className="border-primary">
            <CardBody>
              <h5 className="mb-3">Today&apos;s Reception Collections</h5>
              <Row className="mb-3">
                <Col md={3}>
                  <div className="p-2 bg-light rounded">
                    <p className="text-muted mb-0 small">Total Today</p>
                    <p className="fw-bold mb-0 text-success">
                      {currency}
                      {todaySummary.total.toLocaleString()}
                    </p>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-2 bg-light rounded">
                    <p className="text-muted mb-0 small">Reception Only</p>
                    <p className="fw-bold mb-0">
                      {currency}
                      {todaySummary.receptionOnly.toLocaleString()}
                    </p>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-2 bg-light rounded">
                    <p className="text-muted mb-0 small">Laboratory</p>
                    <p className="fw-bold mb-0">
                      {currency}
                      {todaySummary.labTotal.toLocaleString()}
                    </p>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-2 bg-light rounded">
                    <p className="text-muted mb-0 small">Pharmacy</p>
                    <p className="fw-bold mb-0">
                      {currency}
                      {todaySummary.pharmacyTotal.toLocaleString()}
                    </p>
                  </div>
                </Col>
              </Row>
              <h6 className="mb-2">By Doctor (visits &amp; fees collected today)</h6>
              <Table size="sm" className="mb-0">
                <thead className="bg-light bg-opacity-50">
                  <tr>
                    <th>Doctor</th>
                    <th>Patients Seen Today</th>
                    <th className="text-end">Fees Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySummary.byDoctor.map((row) => (
                    <tr key={row.doctorId}>
                      <td>{row.doctorName}</td>
                      <td>{row.visitCount}</td>
                      <td className="text-end">
                        {currency}
                        {row.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </Col>

        <Col lg={12}>
          <Card>
            <CardBody>
              <h5 className="mb-3">Income Detail — {periodLabel}</h5>
              <div className="table-responsive">
                <Table size="sm" hover className="mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {income.map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td>{r.category}</td>
                        <td>{r.description}</td>
                        <td className="text-end text-success">
                          {currency}
                          {r.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </PermissionGuard>
  )
}

export default FinancialReportsPage
