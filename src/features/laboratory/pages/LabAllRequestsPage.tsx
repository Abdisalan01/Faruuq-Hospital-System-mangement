import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import A4PrintModal from '@/features/doctor/components/a4/A4PrintModal'
import LabResultReportA4 from '@/features/laboratory/components/LabResultReportA4'
import { buildLabResultReportData, isLabPendingStatus } from '@/features/laboratory/utils/labResultReport'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  getLabVisibleRequests,
  getPatientById,
  getStaffById,
  labRequests as storeLabRequests,
  persistLabRequestNowAsync,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import type { LabRequest } from '@/shared/types'
import type { LabResultReportData } from '@/features/laboratory/components/LabResultReportA4'

const PAGE_SIZE = 10

type StatusFilter = 'all' | 'pending' | 'completed'

const getDoctorName = (doctorId: string) => {
  const d = getStaffById(doctorId)
  if (!d) return '—'
  if (d.role === 'emergency') return 'Emergency'
  return `Dr. ${d.firstName} ${d.lastName}`
}

const LabAllRequestsPage = () => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [printData, setPrintData] = useState<LabResultReportData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(
    null,
  )

  const visible = useMemo(
    () => getLabVisibleRequests().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [dataVersion, storeLabRequests.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return visible.filter((req) => {
      if (statusFilter === 'pending' && !isLabPendingStatus(req.status)) return false
      if (statusFilter === 'completed' && req.status !== 'Completed') return false
      if (!q) return true
      const patient = getPatientById(req.patientId)
      const hay = [
        req.requestNumber,
        patient?.id,
        patient?.fullName,
        getDoctorName(req.doctorId),
        req.tests.map((t) => t.testName).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [visible, search, statusFilter, dataVersion])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const startTest = async (req: LabRequest) => {
    if (req.status !== 'Pending') return
    req.status = 'In Progress'
    req.lastModifiedAt = new Date().toISOString()
    touchHmsStore()
    refresh()
    if (isSupabase) {
      try {
        await persistLabRequestNowAsync(req.id)
        setActionMessage({ type: 'success', text: 'Test started — saved to database.' })
      } catch (err) {
        setActionMessage({
          type: 'danger',
          text: err instanceof Error ? err.message : 'Started locally but database save failed.',
        })
      }
    } else {
      setActionMessage({ type: 'success', text: 'Test started.' })
    }
  }

  const openPrint = (req: LabRequest) => {
    const data = buildLabResultReportData(req)
    if (!data) return
    setPrintData(data)
    setShowPrintModal(true)
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['view_lab_requests']}>
      <PageMetaData title="All Labs" />
      <PageHeader
        title="All Labs"
        subtitle="Search and process laboratory requests (paid at reception)"
        breadcrumbs={[
          { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
          { label: 'All Labs' },
        ]}
      />

      {actionMessage && (
        <Alert
          variant={actionMessage.type}
          dismissible
          onClose={() => setActionMessage(null)}
          className="py-2"
        >
          {actionMessage.text}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search request #, patient, doctor, test..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['completed', 'Completed'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Request #</th>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Doctor</th>
                  <th>Tests</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No lab requests match your filters
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    return (
                      <tr key={req.id}>
                        <td className="fw-medium">{req.requestNumber}</td>
                        <td>{patient?.id ?? '—'}</td>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td>{getDoctorName(req.doctorId)}</td>
                        <td className="small">{req.tests.map((t) => t.testName).join(', ')}</td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1 justify-content-center">
                            <Link to={`/hms/laboratory/requests/${req.id}`}>
                              <Button size="sm" variant="outline-primary" title="View">
                                <IconifyIcon icon="solar:eye-broken" />
                              </Button>
                            </Link>
                            {req.status === 'Pending' && (
                              <Button
                                size="sm"
                                variant="outline-info"
                                title="Start"
                                onClick={() => void startTest(req)}
                              >
                                <IconifyIcon icon="solar:play-broken" />
                              </Button>
                            )}
                            {isLabPendingStatus(req.status) && (
                              <Link to={`/hms/laboratory/requests/${req.id}/edit`}>
                                <Button size="sm" variant="soft-success" title="Enter results">
                                  <IconifyIcon icon="solar:pen-broken" />
                                </Button>
                              </Link>
                            )}
                            {req.status === 'Completed' && (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                title="Print A4"
                                onClick={() => openPrint(req)}
                              >
                                <IconifyIcon icon="solar:printer-broken" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
            <p className="text-muted small mb-0">
              {filtered.length === 0
                ? 'Showing 0 records'
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span className="align-self-center small text-muted">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <A4PrintModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Laboratory Result — A4 / PDF"
      >
        {printData && <LabResultReportA4 data={printData} />}
      </A4PrintModal>
    </PermissionGuard>
  )
}

export default LabAllRequestsPage
