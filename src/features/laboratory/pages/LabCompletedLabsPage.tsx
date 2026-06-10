import { useEffect, useMemo, useState } from 'react'
import { Button, Card, CardBody, Form, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import A4PrintModal from '@/features/doctor/components/a4/A4PrintModal'
import LabResultReportA4 from '@/features/laboratory/components/LabResultReportA4'
import { buildLabResultReportData } from '@/features/laboratory/utils/labResultReport'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  getPatientById,
  getStaffById,
  labRequests as storeLabRequests,
} from '@/shared/services/hmsStore'
import type { LabRequest } from '@/shared/types'
import type { LabResultReportData } from '@/features/laboratory/components/LabResultReportA4'

const PAGE_SIZE = 10

const getDoctorName = (doctorId: string) => {
  const d = getStaffById(doctorId)
  if (!d) return '—'
  if (d.role === 'emergency') return 'Emergency'
  return `Dr. ${d.firstName} ${d.lastName}`
}

const LabCompletedLabsPage = () => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [printData, setPrintData] = useState<LabResultReportData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const completed = useMemo(
    () =>
      storeLabRequests
        .filter((l) => l.status === 'Completed')
        .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)),
    [storeLabRequests.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return completed
    return completed.filter((req) => {
      const patient = getPatientById(req.patientId)
      const hay = [
        req.requestNumber,
        patient?.id,
        patient?.fullName,
        getDoctorName(req.doctorId),
        req.tests.map((t) => `${t.testName} ${t.result ?? ''}`).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [completed, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search])

  const openPrint = (req: LabRequest) => {
    const data = buildLabResultReportData(req)
    if (!data) return
    setPrintData(data)
    setShowPrintModal(true)
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['enter_lab_results']}>
      <PageMetaData title="Completed Labs" />
      <PageHeader
        title="Completed Labs"
        subtitle="View and print A4 laboratory result reports"
        breadcrumbs={[
          { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
          { label: 'Completed Labs' },
        ]}
      />

      <Card className="mb-3">
        <CardBody>
          <Form.Control
            type="search"
            placeholder="Search patient, request #, test, result..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
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
                    <td colSpan={6} className="text-center text-muted py-4">
                      No completed results found
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    return (
                      <tr key={req.id}>
                        <td>{patient?.id ?? '—'}</td>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td>{getDoctorName(req.doctorId)}</td>
                        <td className="small">{req.tests.map((t) => t.testName).join(', ')}</td>
                        <td>
                          <StatusBadge status="Completed" />
                        </td>
                        <td>
                          <div className="d-flex gap-1 justify-content-center">
                            <Link to={`/hms/laboratory/requests/${req.id}`}>
                              <Button size="sm" variant="outline-primary" title="View">
                                <IconifyIcon icon="solar:eye-broken" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="primary"
                              title="Print A4 report"
                              onClick={() => openPrint(req)}
                            >
                              <IconifyIcon icon="solar:printer-broken" />
                            </Button>
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

export default LabCompletedLabsPage
