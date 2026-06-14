import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Collapse,
  Form,
  Nav,
  Row,
  Tab,
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import { currency } from '@/context/constants'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  confirmDoctorCommissionPayout,
  doctorCommissionPayouts,
  getDoctorCommissionPayoutForMonth,
  incomeRecords,
  persistDoctorCommissionPayoutNowAsync,
  receptionReceipts,
  stockTransactions,
} from '@/shared/services/hmsStore'
import type {
  DoctorFinancialReport,
  FinancialFeeCategory,
  FinancialTransactionLine,
  ReportDatePeriod,
} from '@/shared/types'
import {
  getAllDoctorsFinancialReports,
  getFinancialDiscountLines,
  getFinancialTransactionLines,
  getHospitalRevenueReport,
  getMonthDateRange,
  getReportDateRange,
} from '@/shared/utils/financialReports'

type ReportTab = 'doctors' | 'hospital' | 'discounts'

const PERIOD_OPTIONS: { key: ReportDatePeriod; label: string }[] = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
]

const CATEGORY_OPTIONS: Array<FinancialFeeCategory | 'all'> = [
  'all',
  'Registration',
  'Laboratory',
  'Surgery',
  'Obstetrics',
  'In-patient',
  'Pharmacy',
]

const fmt = (n: number) =>
  `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const FeeMetric = ({
  label,
  count,
  subtotal,
  discount,
  collected,
}: {
  label: string
  count: number
  subtotal: number
  discount: number
  collected: number
}) => (
  <div className="fin-metric-box">
    <div className="fin-metric-label">{label}</div>
    <div className="fin-metric-value">{fmt(collected)}</div>
    <div className="fin-amount-sub">{count} payment{count !== 1 ? 's' : ''}</div>
    {discount > 0 ? (
      <div className="fin-metric-discount">
        −{fmt(discount)} discount · was {fmt(subtotal)}
      </div>
    ) : (
      <div className="fin-amount-sub">No discount</div>
    )}
  </div>
)

const PATIENTS_VIEW_PAGE_SIZE = 2

const PatientListPager = ({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) => {
  if (totalItems === 0) return null
  const rangeStart = (page - 1) * PATIENTS_VIEW_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PATIENTS_VIEW_PAGE_SIZE, totalItems)

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top bg-light bg-opacity-50">
      <span className="small text-muted">
        Showing {rangeStart}–{rangeEnd} of {totalItems} payment{totalItems !== 1 ? 's' : ''}
      </span>
      <div className="d-flex align-items-center gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <IconifyIcon icon="solar:alt-arrow-left-broken" className="me-1" />
          Prev
        </Button>
        <span className="small text-muted">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <IconifyIcon icon="solar:alt-arrow-right-broken" className="ms-1" />
        </Button>
      </div>
    </div>
  )
}

const TransactionTable = ({
  rows,
  showDoctor = true,
  emptyText,
}: {
  rows: FinancialTransactionLine[]
  showDoctor?: boolean
  emptyText: string
}) => (
  <div className="table-responsive">
    <Table hover className="fin-table mb-0">
      <thead>
        <tr>
          <th>Date</th>
          <th>Patient</th>
          <th>Category</th>
          {showDoctor && <th>Doctor</th>}
          <th>Reference</th>
          <th className="text-end">Subtotal</th>
          <th className="text-end">Discount</th>
          <th className="text-end">Collected</th>
          <th>Receipt</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={showDoctor ? 9 : 8} className="text-center text-muted py-4">
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className={row.hasDiscount ? 'table-warning table-warning-subtle' : undefined}>
              <td>{row.date}</td>
              <td>
                <div className="fin-patient-name">{row.patientName}</div>
                <div className="fin-patient-id">{row.patientId}</div>
              </td>
              <td>
                <Badge
                  bg={
                    row.category === 'Registration'
                      ? 'primary'
                      : row.category === 'Laboratory'
                        ? 'info'
                        : row.category === 'Surgery'
                          ? 'danger'
                          : row.category === 'In-patient'
                            ? 'secondary'
                            : 'light'
                  }
                  text={row.category === 'Obstetrics' ? 'dark' : undefined}
                  className="fin-discount-badge"
                >
                  {row.category}
                </Badge>
              </td>
              {showDoctor && <td className="small">{row.doctorName}</td>}
              <td className="small text-muted">{row.reference ?? '—'}</td>
              <td className="fin-amount-cell">{fmt(row.subtotal)}</td>
              <td className="fin-amount-cell">
                {row.hasDiscount ? (
                  <>
                    <div className="fin-amount-discount">−{fmt(row.discountAmount)}</div>
                    {row.discountPercent != null && row.discountPercent > 0 && (
                      <div className="fin-amount-sub">{row.discountPercent}% off</div>
                    )}
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="fin-amount-cell fw-semibold">{fmt(row.collected)}</td>
              <td className="small font-monospace">{row.receiptNumber}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  </div>
)

const DoctorCommissionCard = ({
  report,
  transactions,
  closureMonth,
  onConfirmPaid,
  confirming,
}: {
  report: DoctorFinancialReport
  transactions: FinancialTransactionLine[]
  closureMonth?: string
  onConfirmPaid?: (report: DoctorFinancialReport) => void
  confirming?: string | null
}) => {
  const [showDetails, setShowDetails] = useState(false)
  const [showLabs, setShowLabs] = useState(false)
  const [patientPage, setPatientPage] = useState(1)
  const payout = closureMonth ? getDoctorCommissionPayoutForMonth(report.doctorId, closureMonth) : undefined
  const isConfirming = confirming === report.doctorId
  const discounted = transactions.filter((t) => t.hasDiscount)

  const patientTotalPages = Math.max(1, Math.ceil(transactions.length / PATIENTS_VIEW_PAGE_SIZE))
  const safePatientPage = Math.min(patientPage, patientTotalPages)
  const pagedTransactions = useMemo(() => {
    const start = (safePatientPage - 1) * PATIENTS_VIEW_PAGE_SIZE
    return transactions.slice(start, start + PATIENTS_VIEW_PAGE_SIZE)
  }, [transactions, safePatientPage])

  useEffect(() => {
    setPatientPage(1)
  }, [showDetails, transactions.length, report.doctorId])

  useEffect(() => {
    if (patientPage > patientTotalPages) setPatientPage(patientTotalPages)
  }, [patientPage, patientTotalPages])

  return (
    <div className="fin-doctor-card">
      <div className="fin-doctor-card-header">
        <div>
          <h6 className="fin-doctor-name">{report.doctorName}</h6>
          <div className="small text-muted">
            Gross {fmt(report.grossTotal)} · Doctor share{' '}
            <span className="text-primary fw-semibold">{fmt(report.commissionAmount)}</span> (50%)
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {report.labByCategory.length > 0 && (
            <Button size="sm" variant="outline-secondary" onClick={() => setShowLabs((v) => !v)}>
              Lab categories
            </Button>
          )}
          <Button size="sm" variant="outline-primary" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? 'Hide patients' : 'View patients'}
          </Button>
        </div>
      </div>

      <div className="fin-metric-grid">
        <FeeMetric
          label="Registration"
          count={report.registrationCount}
          subtotal={report.registrationSubtotal}
          discount={report.registrationDiscount}
          collected={report.registrationCollected}
        />
        <FeeMetric
          label="Laboratory"
          count={report.labPatientCount}
          subtotal={report.labSubtotal}
          discount={report.labDiscount}
          collected={report.labCollected}
        />
        <FeeMetric
          label="Surgery"
          count={report.surgeryCount}
          subtotal={report.surgerySubtotal}
          discount={report.surgeryDiscount}
          collected={report.surgeryCollected}
        />
        <FeeMetric
          label="Obstetric"
          count={report.obstetricCount}
          subtotal={report.obstetricSubtotal}
          discount={report.obstetricDiscount}
          collected={report.obstetricCollected}
        />
      </div>

      {discounted.length > 0 && (
        <div className="px-3 pb-2">
          <Alert variant="warning" className="py-2 mb-0 small">
            <IconifyIcon icon="solar:tag-price-broken" className="me-1" />
            {discounted.length} payment{discounted.length !== 1 ? 's' : ''} with discount — total{' '}
            <strong>{fmt(discounted.reduce((s, r) => s + r.discountAmount, 0))}</strong> off
          </Alert>
        </div>
      )}

      <Collapse in={showLabs}>
        <div className="px-3 pb-3">
          <Table size="sm" bordered className="mb-0 bg-white">
            <thead className="table-light">
              <tr>
                <th>Lab category</th>
                <th>Tests</th>
                <th>Patients</th>
                <th className="text-end">Collected</th>
                <th className="text-end">Discount</th>
              </tr>
            </thead>
            <tbody>
              {report.labByCategory.map((cat) => (
                <tr key={cat.category}>
                  <td>{cat.category}</td>
                  <td>{cat.testCount}</td>
                  <td>{cat.patientCount}</td>
                  <td className="text-end">{fmt(cat.collected)}</td>
                  <td className="text-end text-danger">{cat.discount > 0 ? `−${fmt(cat.discount)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Collapse>

      <Collapse in={showDetails}>
        <div className="border-top">
          <TransactionTable
            rows={pagedTransactions}
            showDoctor={false}
            emptyText="No payments for this doctor in this period"
          />
          <PatientListPager
            page={safePatientPage}
            totalPages={patientTotalPages}
            totalItems={transactions.length}
            onPageChange={setPatientPage}
          />
        </div>
      </Collapse>

      {closureMonth && onConfirmPaid && (
        <div className="fin-closure-bar">
          <div className="small">
            <strong>Monthly closure — {closureMonth}</strong>
            {payout && (
              <span className="text-muted ms-2">
                Confirmed {new Date(payout.confirmedAt).toLocaleString()}
              </span>
            )}
          </div>
          {payout ? (
            <Badge bg="success" className="px-3 py-2">Paid this month</Badge>
          ) : report.grossTotal > 0 ? (
            <Button size="sm" variant="success" disabled={isConfirming} onClick={() => onConfirmPaid(report)}>
              <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
              {isConfirming ? 'Saving...' : 'Confirm doctor received payment'}
            </Button>
          ) : (
            <Badge bg="secondary">No earnings</Badge>
          )}
        </div>
      )}
    </div>
  )
}

const RevenueStatCard = ({
  icon,
  label,
  collected,
  count,
  subtotal,
  discount,
  variant,
}: {
  icon: string
  label: string
  collected: number
  count: number
  subtotal: number
  discount: number
  variant?: 'primary' | 'success'
}) => (
  <Card className={`fin-stat-card ${variant === 'primary' ? 'fin-stat-primary' : ''} ${variant === 'success' ? 'fin-stat-success' : ''}`}>
    <CardBody>
      <div className="fin-stat-icon">
        <IconifyIcon icon={icon} />
      </div>
      <div className="fin-stat-label">{label}</div>
      <div className={`fin-stat-value ${variant === 'success' ? 'text-success' : ''}`}>{fmt(collected)}</div>
      <div className="fin-stat-meta">
        {count} payment{count !== 1 ? 's' : ''}
        {discount > 0 && (
          <>
            {' '}
            · <span className="text-danger">−{fmt(discount)} discount</span>
          </>
        )}
        {discount > 0 && subtotal > collected && (
          <> · original {fmt(subtotal)}</>
        )}
      </div>
    </CardBody>
  </Card>
)

const AdminFinancialReportsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const [tab, setTab] = useState<ReportTab>('doctors')
  const [period, setPeriod] = useState<ReportDatePeriod>('month')
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().split('T')[0])
  const [closureMonth, setClosureMonth] = useState(currentMonth)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [discountCategory, setDiscountCategory] = useState<FinancialFeeCategory | 'all'>('all')
  const [patientSearch, setPatientSearch] = useState('')

  const dateRange = useMemo(
    () => getReportDateRange(period, anchorDate),
    [period, anchorDate],
  )

  const doctorReports = useMemo(
    () => getAllDoctorsFinancialReports(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end, dataVersion, receptionReceipts.length, incomeRecords.length],
  )

  const hospitalReport = useMemo(
    () => getHospitalRevenueReport(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end, dataVersion, incomeRecords.length, receptionReceipts.length, stockTransactions.length],
  )

  const allTransactions = useMemo(
    () => getFinancialTransactionLines(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end, dataVersion, receptionReceipts.length],
  )

  const discountLines = useMemo(
    () => getFinancialDiscountLines(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end, dataVersion, receptionReceipts.length],
  )

  const filteredDiscounts = useMemo(() => {
    const q = patientSearch.toLowerCase().trim()
    return discountLines.filter((row) => {
      if (discountCategory !== 'all' && row.category !== discountCategory) return false
      if (!q) return true
      return (
        row.patientName.toLowerCase().includes(q) ||
        row.patientId.toLowerCase().includes(q) ||
        row.receiptNumber.toLowerCase().includes(q) ||
        (row.reference?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [discountLines, discountCategory, patientSearch])

  const closureReports = useMemo(() => {
    const { start, end } = getMonthDateRange(closureMonth)
    return getAllDoctorsFinancialReports(start, end)
  }, [closureMonth, dataVersion, receptionReceipts.length, doctorCommissionPayouts.length])

  const doctorTotals = useMemo(
    () =>
      doctorReports.reduce(
        (acc, r) => ({
          gross: acc.gross + r.grossTotal,
          commission: acc.commission + r.commissionAmount,
          discount:
            acc.discount +
            r.registrationDiscount +
            r.labDiscount +
            r.surgeryDiscount +
            r.obstetricDiscount,
        }),
        { gross: 0, commission: 0, discount: 0 },
      ),
    [doctorReports],
  )

  const totalDiscounts = useMemo(
    () => discountLines.reduce((s, r) => s + r.discountAmount, 0),
    [discountLines],
  )

  const showMsg = (text: string, type: 'success' | 'danger' = 'success') => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleConfirmPayout = async (report: DoctorFinancialReport) => {
    const adminId = user?.id ?? 'staff-001'
    setConfirming(report.doctorId)
    try {
      const { start, end } = getMonthDateRange(closureMonth)
      const monthReport = getAllDoctorsFinancialReports(start, end).find(
        (r) => r.doctorId === report.doctorId,
      )
      if (!monthReport || monthReport.grossTotal <= 0) {
        showMsg('No earnings to confirm for this doctor in the selected month.', 'danger')
        return
      }
      confirmDoctorCommissionPayout({
        periodMonth: closureMonth,
        confirmedBy: adminId,
        report: monthReport,
      })
      if (isSupabase) {
        await persistDoctorCommissionPayoutNowAsync()
        showMsg(
          `${monthReport.doctorName} — ${closureMonth} commission ${fmt(monthReport.commissionAmount)} confirmed and saved.`,
        )
      } else {
        showMsg(`${monthReport.doctorName} commission confirmed locally.`)
      }
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not confirm payout', 'danger')
    } finally {
      setConfirming(null)
    }
  }

  const doctorTransactions = (doctorId: string) =>
    getFinancialTransactionLines(dateRange.start, dateRange.end, doctorId)

  return (
    <PermissionGuard permissions={['reports', 'user_management']}>
      <div className="financial-reports-page">
        <PageMetaData title="Financial Reports" />
        <PageHeader
          title="Financial Reports"
          subtitle="Doctor commissions, hospital revenue, discounts & patient payments"
          breadcrumbs={[
            { label: 'Hospital Dashboard', href: '/hms/dashboard' },
            { label: 'Administration', href: '/hms/administration/patient-reports' },
            { label: 'Financial Reports' },
          ]}
        />

        {message && (
          <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card className="fin-reports-filter-card mb-4">
          <CardBody>
            <Row className="g-3 align-items-end">
              <Col lg={5}>
                <Form.Label className="fin-stat-label mb-2">Report period</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <Button
                      key={opt.key}
                      size="sm"
                      variant={period === opt.key ? 'primary' : 'outline-secondary'}
                      onClick={() => setPeriod(opt.key)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </Col>
              <Col md={4} lg={3}>
                <Form.Label className="fin-stat-label mb-2">Reference date</Form.Label>
                <Form.Control
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                />
              </Col>
              <Col md={4} lg={4}>
                <div className="fin-stat-label">Showing</div>
                <div className="fw-semibold fs-5">{dateRange.label}</div>
                <div className="text-muted small">
                  {dateRange.start} → {dateRange.end}
                </div>
              </Col>
            </Row>
          </CardBody>
        </Card>

        <Tab.Container activeKey={tab} onSelect={(k) => setTab((k as ReportTab) ?? 'doctors')}>
          <Nav variant="pills" className="fin-reports-tab-nav">
            <Nav.Item>
              <Nav.Link eventKey="doctors">
                <IconifyIcon icon="solar:stethoscope-broken" />
                Doctor Commissions (50%)
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="hospital">
                <IconifyIcon icon="solar:buildings-2-broken" />
                Hospital Revenue
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="discounts">
                <IconifyIcon icon="solar:tag-price-broken" />
                Discounts & Patients
                {discountLines.length > 0 && (
                  <Badge bg="warning" text="dark" className="ms-1">
                    {discountLines.length}
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="doctors">
              <Row className="mb-4 g-3">
                <Col md={4}>
                  <Card className="fin-stat-card">
                    <CardBody>
                      <div className="fin-stat-icon">
                        <IconifyIcon icon="solar:wallet-money-broken" />
                      </div>
                      <div className="fin-stat-label">Total collected</div>
                      <div className="fin-stat-value">{fmt(doctorTotals.gross)}</div>
                      <div className="fin-stat-meta">After discounts · all doctors</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="fin-stat-card fin-stat-primary">
                    <CardBody>
                      <div className="fin-stat-icon">
                        <IconifyIcon icon="solar:hand-money-broken" />
                      </div>
                      <div className="fin-stat-label">Doctor share (50%)</div>
                      <div className="fin-stat-value text-primary">{fmt(doctorTotals.commission)}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="fin-stat-card">
                    <CardBody>
                      <div className="fin-stat-icon">
                        <IconifyIcon icon="solar:tag-price-broken" />
                      </div>
                      <div className="fin-stat-label">Discounts given</div>
                      <div className="fin-stat-value text-danger">{fmt(doctorTotals.discount)}</div>
                      <div className="fin-stat-meta">
                        <Button variant="link" className="p-0 small" onClick={() => setTab('discounts')}>
                          View discount log →
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {doctorReports.length === 0 ? (
                <Card className="fin-section-card">
                  <CardBody className="text-center text-muted py-5">No doctor earnings in this period</CardBody>
                </Card>
              ) : (
                doctorReports.map((report) => (
                  <DoctorCommissionCard
                    key={report.doctorId}
                    report={report}
                    transactions={doctorTransactions(report.doctorId)}
                  />
                ))
              )}

              <Card className="fin-section-card mt-4">
                <div className="fin-section-header">
                  <h5 className="fin-section-title">
                    <IconifyIcon icon="solar:calendar-mark-broken" />
                    Monthly account closure
                  </h5>
                  <p className="fin-section-hint">
                    Confirm each doctor received their 50% share for the selected month.
                  </p>
                </div>
                <CardBody>
                  <Row className="g-3 mb-3">
                    <Col md={4}>
                      <Form.Label className="fin-stat-label">Closure month</Form.Label>
                      <Form.Control
                        type="month"
                        value={closureMonth}
                        onChange={(e) => setClosureMonth(e.target.value)}
                      />
                    </Col>
                  </Row>
                  {closureReports.map((report) => (
                    <DoctorCommissionCard
                      key={`closure-${report.doctorId}`}
                      report={report}
                      transactions={getFinancialTransactionLines(
                        getMonthDateRange(closureMonth).start,
                        getMonthDateRange(closureMonth).end,
                        report.doctorId,
                      )}
                      closureMonth={closureMonth}
                      onConfirmPaid={handleConfirmPayout}
                      confirming={confirming}
                    />
                  ))}
                </CardBody>
              </Card>
            </Tab.Pane>

            <Tab.Pane eventKey="hospital">
              <Row className="mb-4 g-3">
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:user-id-broken"
                    label="Registration"
                    collected={hospitalReport.registration.collected}
                    count={hospitalReport.registration.count}
                    subtotal={hospitalReport.registration.subtotal}
                    discount={hospitalReport.registration.discount}
                  />
                </Col>
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:test-tube-broken"
                    label="Laboratory"
                    collected={hospitalReport.laboratory.collected}
                    count={hospitalReport.laboratory.count}
                    subtotal={hospitalReport.laboratory.subtotal}
                    discount={hospitalReport.laboratory.discount}
                  />
                </Col>
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:bed-broken"
                    label="In-patient / bed"
                    collected={hospitalReport.inpatient.collected}
                    count={hospitalReport.inpatient.count}
                    subtotal={hospitalReport.inpatient.subtotal}
                    discount={hospitalReport.inpatient.discount}
                  />
                </Col>
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:scalpel-broken"
                    label="Surgery"
                    collected={hospitalReport.surgery.collected}
                    count={hospitalReport.surgery.count}
                    subtotal={hospitalReport.surgery.subtotal}
                    discount={hospitalReport.surgery.discount}
                  />
                </Col>
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:heart-pulse-broken"
                    label="Obstetric / delivery"
                    collected={hospitalReport.obstetrics.collected}
                    count={hospitalReport.obstetrics.count}
                    subtotal={hospitalReport.obstetrics.subtotal}
                    discount={hospitalReport.obstetrics.discount}
                  />
                </Col>
                <Col md={6} xl={4}>
                  <RevenueStatCard
                    icon="solar:chart-2-broken"
                    label="Total revenue"
                    collected={hospitalReport.grossTotal}
                    count={allTransactions.length}
                    subtotal={allTransactions.reduce((s, r) => s + r.subtotal, 0)}
                    discount={totalDiscounts}
                    variant="success"
                  />
                </Col>
              </Row>

              <Card className="fin-section-card mb-4">
                <div className="fin-section-header">
                  <h5 className="fin-section-title">
                    <IconifyIcon icon="solar:pill-broken" />
                    Pharmacy breakdown
                  </h5>
                </div>
                <CardBody className="p-0">
                  <Table className="fin-table mb-0">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Income records (dispensing, inpatient medicine)</td>
                        <td className="fin-amount-cell">{fmt(hospitalReport.pharmacy.incomeRecords)}</td>
                      </tr>
                      <tr>
                        <td>Stock transactions (counter sales)</td>
                        <td className="fin-amount-cell">{fmt(hospitalReport.pharmacy.stockSales)}</td>
                      </tr>
                      <tr>
                        <td>Inpatient medicine requests</td>
                        <td className="fin-amount-cell">{fmt(hospitalReport.pharmacy.inpatientMedicineRequests)}</td>
                      </tr>
                      <tr>
                        <td>Supply requests delivered</td>
                        <td className="fin-amount-cell">{fmt(hospitalReport.pharmacy.supplyRequests)}</td>
                      </tr>
                      <tr className="fin-total-row">
                        <td>Pharmacy total</td>
                        <td className="fin-amount-cell">{fmt(hospitalReport.pharmacy.total)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </CardBody>
              </Card>

              <Card className="fin-section-card">
                <div className="fin-section-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <h5 className="fin-section-title mb-0">
                      <IconifyIcon icon="solar:document-text-broken" />
                      All payments this period
                    </h5>
                    <p className="fin-section-hint mb-0">Every receipt with patient name, discount, and amount collected</p>
                  </div>
                  <Button size="sm" variant="outline-warning" onClick={() => setTab('discounts')}>
                    {discountLines.length} with discount
                  </Button>
                </div>
                <TransactionTable
                  rows={allTransactions}
                  emptyText="No payments in this period"
                />
              </Card>
            </Tab.Pane>

            <Tab.Pane eventKey="discounts">
              <Row className="mb-4 g-3">
                <Col md={4}>
                  <Card className="fin-stat-card">
                    <CardBody>
                      <div className="fin-stat-label">Discounted payments</div>
                      <div className="fin-stat-value">{discountLines.length}</div>
                      <div className="fin-stat-meta">Registration, lab, surgery, in-patient</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="fin-stat-card">
                    <CardBody>
                      <div className="fin-stat-label">Total discount amount</div>
                      <div className="fin-stat-value text-danger">{fmt(totalDiscounts)}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="fin-stat-card">
                    <CardBody>
                      <div className="fin-stat-label">Patients with discount</div>
                      <div className="fin-stat-value">
                        {new Set(discountLines.map((r) => r.patientId)).size}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              <Card className="fin-section-card">
                <div className="fin-section-header">
                  <h5 className="fin-section-title">
                    <IconifyIcon icon="solar:tag-price-broken" />
                    Discount log — who received discount & how much
                  </h5>
                  <p className="fin-section-hint">
                    Shows patient name, fee type, original amount, discount % and amount, and final collected.
                  </p>
                </div>
                <CardBody className="border-bottom">
                  <Row className="g-3">
                    <Col md={5}>
                      <Form.Label className="fin-stat-label">Search patient</Form.Label>
                      <Form.Control
                        type="search"
                        placeholder="Patient name, ID, receipt or reference..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label className="fin-stat-label">Category</Form.Label>
                      <Form.Select
                        value={discountCategory}
                        onChange={(e) =>
                          setDiscountCategory(e.target.value as FinancialFeeCategory | 'all')
                        }
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === 'all' ? 'All categories' : cat}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>
                </CardBody>
                <TransactionTable
                  rows={filteredDiscounts}
                  emptyText="No discounted payments in this period"
                />
              </Card>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </div>
    </PermissionGuard>
  )
}

export default AdminFinancialReportsPage
