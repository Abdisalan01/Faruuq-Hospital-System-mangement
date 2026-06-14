import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  departmentSupplyRequests,
  getInventoryForMedicine,
  getInpatientMedicineRequests,
  getPatientById,
  inventoryItems as storeInventory,
  medicineCatalog,
  prescriptions as storePrescriptions,
  stockTransactions,
} from '@/shared/services/hmsStore'
import type { PharmacyTransactionSource, ReportDatePeriod } from '@/shared/types'
import {
  getPharmacyPeriodRange,
  getPharmacyProfitSummary,
  getPharmacyTransactionLines,
} from '@/shared/utils/pharmacyTransactions'

const QUICK_ACTIONS = [
  {
    label: 'Medical Catalog',
    icon: 'solar:pill-broken',
    href: '/hms/pharmacy/catalog',
    variant: 'primary',
  },
  {
    label: 'Stock Transactions',
    icon: 'solar:box-broken',
    href: '/hms/pharmacy/stock',
    variant: 'success',
  },
  {
    label: 'Supply Requests',
    icon: 'solar:clipboard-list-broken',
    href: '/hms/pharmacy/supply-requests',
    variant: 'warning',
  },
  {
    label: 'Inpatient Medicine Requests',
    icon: 'solar:document-medicine-broken',
    href: '/hms/pharmacy/prescriptions',
    variant: 'info',
  },
] as const

const PERIOD_OPTIONS: { key: ReportDatePeriod; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
]

const SOURCE_LABELS: Record<PharmacyTransactionSource, string> = {
  'Stock Sale': 'Stock Transactions',
  'Inpatient Medicine': 'Inpatient Medicine',
  'Supply Request': 'Supply Requests',
}

const SOURCE_COLORS: Record<PharmacyTransactionSource, { bg: string; text: string }> = {
  'Stock Sale': { bg: 'success-subtle', text: 'success' },
  'Inpatient Medicine': { bg: 'info-subtle', text: 'info' },
  'Supply Request': { bg: 'warning-subtle', text: 'warning' },
}

const fmt = (n: number) =>
  `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const todayKey = () => new Date().toISOString().slice(0, 10)

const PharmacyDashboardPage = () => {
  const { user } = useAuthContext()
  const { dataVersion } = useHmsStoreContext()
  const [period, setPeriod] = useState<ReportDatePeriod>('month')
  const [anchorDate, setAnchorDate] = useState(todayKey())
  const [sourceFilter, setSourceFilter] = useState<PharmacyTransactionSource | 'all'>('all')

  const periodRange = useMemo(
    () => getPharmacyPeriodRange(period, anchorDate),
    [period, anchorDate, dataVersion, stockTransactions.length],
  )

  const summary = useMemo(
    () => getPharmacyProfitSummary(periodRange.start, periodRange.end),
    [periodRange.start, periodRange.end, dataVersion, stockTransactions.length],
  )

  const allLines = useMemo(
    () => getPharmacyTransactionLines(periodRange.start, periodRange.end),
    [periodRange.start, periodRange.end, dataVersion, stockTransactions.length],
  )

  const filteredLines = useMemo(
    () => (sourceFilter === 'all' ? allLines : allLines.filter((l) => l.source === sourceFilter)),
    [allLines, sourceFilter],
  )

  const ledgerPagination = useTablePagination(filteredLines, 12, [filteredLines.length])

  const stats = useMemo(() => {
    const catalogCount = medicineCatalog.length
    const lowStock = storeInventory.filter((i) => i.quantity <= i.reorderLevel).length
    const outOfStock = medicineCatalog.filter((m) => (getInventoryForMedicine(m)?.quantity ?? 0) <= 0).length
    const totalValue = storeInventory.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    const pendingRx = getInpatientMedicineRequests('Pending').length
    const today = todayKey()
    const dispensedToday = storePrescriptions.filter(
      (p) => p.status === 'Dispensed' && p.dispensedAt?.slice(0, 10) === today,
    ).length
    const pendingSupply = departmentSupplyRequests.filter((r) => r.status === 'Pending').length
    return { catalogCount, lowStock, outOfStock, totalValue, pendingRx, dispensedToday, pendingSupply }
  }, [
    storeInventory.length,
    storePrescriptions.length,
    medicineCatalog.length,
    departmentSupplyRequests.length,
    dataVersion,
  ])

  const lowStockItems = useMemo(
    () =>
      storeInventory
        .filter((i) => i.quantity <= i.reorderLevel)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5),
    [storeInventory.length, dataVersion],
  )

  const pendingSupplyRequests = useMemo(
    () =>
      departmentSupplyRequests
        .filter((r) => r.status === 'Pending')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [departmentSupplyRequests.length, dataVersion],
  )

  const pendingPrescriptions = useMemo(
    () => getInpatientMedicineRequests('Pending').slice(0, 5),
    [storePrescriptions.length, dataVersion],
  )

  const profitClass = summary.profit >= 0 ? 'pharm-profit-positive' : 'pharm-profit-negative'

  return (
    <PermissionGuard permissions={['inventory_management']}>
      <PageMetaData title="Pharmacy Dashboard" />
      <div className="pharmacy-dashboard-page">
        <PageHeader
          title="Pharmacy Dashboard"
          subtitle="Track sales, inpatient medicine, and supply transactions with profit & loss"
          breadcrumbs={[{ label: 'Pharmacy Dashboard' }]}
          actionLabel="Add to Catalog"
          actionHref="/hms/pharmacy/catalog"
          actionIcon="solar:add-circle-broken"
        />

        <Card className="mb-4 border-0 shadow-sm overflow-hidden">
          <CardBody className="p-4 bg-success bg-opacity-10">
            <Row className="align-items-center g-3">
              <Col md={8}>
                <div className="d-flex align-items-center gap-3">
                  <div className="avatar-lg bg-success bg-opacity-25 rounded-circle flex-centered">
                    <IconifyIcon icon="solar:pill-broken" className="fs-32 text-success" />
                  </div>
                  <div>
                    <p className="text-success fw-medium mb-1">Welcome back</p>
                    <h4 className="mb-1">
                      {user?.firstName} {user?.lastName}
                    </h4>
                    <p className="text-muted mb-0">
                      Every pharmacy transaction is tracked — compare cost price vs selling price to see profit or loss.
                    </p>
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="d-flex flex-wrap gap-2 justify-content-md-end">
                  {QUICK_ACTIONS.map((action) => (
                    <Link
                      key={action.href}
                      to={action.href}
                      className={`btn btn-${action.variant} btn-sm`}
                    >
                      <IconifyIcon icon={action.icon} className="me-1" />
                      {action.label}
                    </Link>
                  ))}
                </div>
              </Col>
            </Row>
          </CardBody>
        </Card>

        <Card className="mb-4 pharm-filter-card">
          <CardBody>
            <Row className="g-3 align-items-end">
              <Col md={5}>
                <Form.Label className="small text-muted mb-1">Report period</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map(({ key, label }) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={period === key ? 'success' : 'outline-secondary'}
                      className="pharm-period-btn"
                      onClick={() => setPeriod(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">Anchor date</Form.Label>
                <Form.Control
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                />
              </Col>
              <Col md={4}>
                <p className="small text-muted mb-0">
                  Showing <strong>{periodRange.label}</strong> — {summary.transactionCount} transaction
                  {summary.transactionCount !== 1 ? 's' : ''}
                </p>
              </Col>
            </Row>
          </CardBody>
        </Card>

        <Row className="g-3 mb-4">
          <Col md={6} xl={3}>
            <Card className="pharm-stat-card">
              <CardBody>
                <div className="pharm-stat-label">Total Revenue</div>
                <div className="pharm-stat-value">{fmt(summary.revenue)}</div>
                <div className="pharm-stat-sub">Selling price × quantity</div>
              </CardBody>
            </Card>
          </Col>
          <Col md={6} xl={3}>
            <Card className="pharm-stat-card">
              <CardBody>
                <div className="pharm-stat-label">Total Cost</div>
                <div className="pharm-stat-value">{fmt(summary.cost)}</div>
                <div className="pharm-stat-sub">Purchase/cost price × quantity</div>
              </CardBody>
            </Card>
          </Col>
          <Col md={6} xl={3}>
            <Card className="pharm-stat-card">
              <CardBody>
                <div className="pharm-stat-label">
                  {summary.profit >= 0 ? 'Net Profit' : 'Net Loss'}
                </div>
                <div className={`pharm-stat-value ${profitClass}`}>
                  {summary.profit >= 0 ? '+' : ''}
                  {fmt(summary.profit)}
                </div>
                <div className="pharm-stat-sub">
                  Margin: {summary.marginPercent.toFixed(1)}%
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col md={6} xl={3}>
            <Card className="pharm-stat-card">
              <CardBody>
                <div className="pharm-stat-label">By Source</div>
                <div className="d-flex flex-column gap-1 mt-1">
                  <div className="d-flex justify-content-between small">
                    <span>Stock Sales</span>
                    <span className={summary.stockSales.profit >= 0 ? 'text-success' : 'text-danger'}>
                      {fmt(summary.stockSales.profit)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span>Inpatient Med</span>
                    <span className={summary.inpatientMedicine.profit >= 0 ? 'text-success' : 'text-danger'}>
                      {fmt(summary.inpatientMedicine.profit)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span>Supply</span>
                    <span className={summary.supplyRequests.profit >= 0 ? 'text-success' : 'text-danger'}>
                      {fmt(summary.supplyRequests.profit)}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Row className="mb-3">
          <StatCard
            title="Catalog Items"
            value={stats.catalogCount}
            icon="solar:pill-broken"
            variant="primary"
            link="/hms/pharmacy/catalog"
            linkLabel="Open catalog"
          />
          <StatCard
            title="Low Stock"
            value={stats.lowStock}
            icon="solar:danger-triangle-broken"
            variant="danger"
            link="/hms/pharmacy/stock"
            linkLabel="View stock"
          />
          <StatCard
            title="Pending Supply"
            value={stats.pendingSupply}
            icon="solar:clipboard-list-broken"
            variant="warning"
            link="/hms/pharmacy/supply-requests"
            linkLabel="Review requests"
          />
          <StatCard
            title="Dispensed Today"
            value={stats.dispensedToday}
            icon="solar:check-circle-broken"
            variant="success"
            link="/hms/pharmacy/prescriptions"
            linkLabel="Medicine requests"
          />
        </Row>

        <Card className="mb-4 border-0 shadow-sm">
          <CardBody>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 className="mb-0">
                <IconifyIcon icon="solar:chart-2-broken" className="me-1 text-success" />
                Transaction Ledger
              </h5>
              <div className="d-flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={sourceFilter === 'all' ? 'dark' : 'outline-secondary'}
                  onClick={() => setSourceFilter('all')}
                >
                  All
                </Button>
                {(Object.keys(SOURCE_LABELS) as PharmacyTransactionSource[]).map((src) => (
                  <Button
                    key={src}
                    size="sm"
                    variant={sourceFilter === src ? 'success' : 'outline-secondary'}
                    onClick={() => setSourceFilter(src)}
                  >
                    {SOURCE_LABELS[src]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <Table hover className="pharm-ledger-table mb-0 align-middle">
                <thead className="bg-light bg-opacity-50">
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th className="text-end">Cost/Unit</th>
                    <th className="text-end">Sell/Unit</th>
                    <th className="text-end">Revenue</th>
                    <th className="text-end">Cost</th>
                    <th className="text-end">Profit/Loss</th>
                    <th>Patient / Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPagination.pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center text-muted py-5">
                        No transactions in this period.
                      </td>
                    </tr>
                  ) : (
                    ledgerPagination.pageItems.map((line) => {
                      const colors = SOURCE_COLORS[line.source]
                      const profitPositive = line.profit >= 0
                      return (
                        <tr key={line.id}>
                          <td className="text-nowrap small">{line.date}</td>
                          <td>
                            <Badge bg={colors.bg} text={colors.text} className="pharm-source-pill">
                              {SOURCE_LABELS[line.source]}
                            </Badge>
                          </td>
                          <td className="fw-medium">{line.itemName}</td>
                          <td>{line.quantity}</td>
                          <td className="text-end">{fmt(line.unitCost)}</td>
                          <td className="text-end">{fmt(line.unitPrice)}</td>
                          <td className="text-end">{fmt(line.revenue)}</td>
                          <td className="text-end">{fmt(line.cost)}</td>
                          <td
                            className={`text-end fw-semibold ${profitPositive ? 'text-success' : 'text-danger'}`}
                          >
                            {profitPositive ? '+' : ''}
                            {fmt(line.profit)}
                          </td>
                          <td className="small text-muted">{line.patientOrDept ?? '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </Table>
            </div>
            <TablePagination
              className="pt-3 border-top mt-3"
              totalItems={ledgerPagination.totalItems}
              rangeStart={ledgerPagination.rangeStart}
              rangeEnd={ledgerPagination.rangeEnd}
              safePage={ledgerPagination.safePage}
              totalPages={ledgerPagination.totalPages}
              onPageChange={ledgerPagination.setPage}
            />
          </CardBody>
        </Card>

        <Row className="g-3">
          <Col xl={4}>
            <Card className="h-100 border-0 shadow-sm">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">
                    <IconifyIcon icon="solar:clipboard-list-broken" className="me-1 text-warning" />
                    Pending Supply
                  </h6>
                  <Link to="/hms/pharmacy/supply-requests" className="btn btn-sm btn-soft-warning">
                    View all
                  </Link>
                </div>
                {pendingSupplyRequests.length === 0 ? (
                  <p className="text-muted small mb-0">No pending supply requests</p>
                ) : (
                  pendingSupplyRequests.map((req) => (
                    <div key={req.id} className="d-flex justify-content-between py-2 border-bottom">
                      <div>
                        <Badge bg="secondary-subtle" text="secondary" className="me-1">
                          {req.department}
                        </Badge>
                        <span className="small">{req.items.map((i) => i.supplyName).join(', ')}</span>
                      </div>
                      <span className="small text-muted text-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="h-100 border-0 shadow-sm">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">
                    <IconifyIcon icon="solar:danger-triangle-broken" className="me-1 text-danger" />
                    Low Stock
                  </h6>
                  <Link to="/hms/pharmacy/stock" className="btn btn-sm btn-soft-danger">
                    Manage
                  </Link>
                </div>
                {lowStockItems.length === 0 ? (
                  <p className="text-muted small mb-0">All items above reorder level</p>
                ) : (
                  lowStockItems.map((item) => (
                    <div key={item.id} className="d-flex justify-content-between py-2 border-bottom">
                      <span className="fw-medium small">{item.name}</span>
                      <div className="d-flex align-items-center gap-2">
                        <span className={item.quantity <= 0 ? 'text-danger fw-semibold' : 'small'}>
                          {item.quantity}
                        </span>
                        <StatusBadge status={item.quantity <= 0 ? 'Inactive' : 'Active'} />
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="h-100 border-0 shadow-sm">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">
                    <IconifyIcon icon="solar:document-medicine-broken" className="me-1 text-info" />
                    Pending Medicine Requests
                  </h6>
                  <Link to="/hms/pharmacy/prescriptions" className="btn btn-sm btn-soft-info">
                    View all
                  </Link>
                </div>
                {pendingPrescriptions.length === 0 ? (
                  <p className="text-muted small mb-0">No pending inpatient requests</p>
                ) : (
                  pendingPrescriptions.map((rx) => {
                    const patient = getPatientById(rx.patientId)
                    return (
                      <div key={rx.id} className="d-flex justify-content-between py-2 border-bottom">
                        <div>
                          <span className="fw-medium small">{patient?.fullName ?? '—'}</span>
                          <div className="small text-muted">
                            {rx.items.map((i) => i.medicine).join(', ')}
                          </div>
                        </div>
                        <StatusBadge status={rx.status} />
                      </div>
                    )
                  })
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </div>
    </PermissionGuard>
  )
}

export default PharmacyDashboardPage
