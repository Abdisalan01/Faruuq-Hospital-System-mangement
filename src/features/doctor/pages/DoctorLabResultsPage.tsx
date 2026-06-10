import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  getLabRequestById,
  getLabRequestsForDoctor,
  getPatientById,
  isLabResultViewedByDoctor,
  labRequests as storeLabRequests,
  markLabViewedByDoctor,
  persistLabViewedByDoctorNowAsync,
} from '@/shared/services/hmsStore'
import type { LabRequest } from '@/shared/types'

const PAGE_SIZE = 10

type ViewFilter = 'all' | 'viewed' | 'not_viewed'

const getViewStatusLabel = (req: LabRequest) => {
  if (req.status === 'Completed') {
    return isLabResultViewedByDoctor(req) ? 'Viewed' : 'Not Viewed'
  }
  return req.status
}

const DoctorLabResultsPage = () => {
  const { user } = useAuthContext()
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const doctorId = user?.id ?? 'staff-003'
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [page, setPage] = useState(1)
  const [viewLab, setViewLab] = useState<LabRequest | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const myLabs = useMemo(
    () => getLabRequestsForDoctor(doctorId),
    [doctorId, tick, dataVersion, storeLabRequests.length],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return myLabs.filter((req) => {
      if (viewFilter === 'viewed' && !isLabResultViewedByDoctor(req)) return false
      if (viewFilter === 'not_viewed') {
        if (req.status !== 'Completed' || isLabResultViewedByDoctor(req)) return false
      }

      if (!q) return true
      const patient = getPatientById(req.patientId)
      const hay = [
        req.requestNumber,
        req.id,
        patient?.fullName,
        patient?.id,
        req.tests.map((t) => `${t.testName} ${t.result ?? ''}`).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [myLabs, search, viewFilter, tick, dataVersion])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, viewFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openResults = async (req: LabRequest) => {
    if (req.status !== 'Completed') return
    setError('')
    setViewingId(req.id)
    try {
      if (isSupabase) {
        await persistLabViewedByDoctorNowAsync(req.id)
      } else {
        markLabViewedByDoctor(req.id)
      }
      const updated = getLabRequestById(req.id) ?? req
      setViewLab(updated)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save viewed status to database')
    } finally {
      setViewingId(null)
    }
  }

  const closeResults = () => setViewLab(null)

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PermissionGuard permissions={['view_patient_lab_results']}>
      <PageMetaData title="Lab Results" />
      <PageHeader
        title="View Lab Results"
        subtitle="Review results, then consult to order more labs, prescription, admission, or surgery"
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'Lab Results' },
        ]}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search lab ID, patient, test, result..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['viewed', 'Viewed'],
                    ['not_viewed', 'Not Viewed'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={viewFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setViewFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
          <p className="text-muted small mb-0 mt-2">
            Click the <strong>View</strong> icon to open results — status changes to <strong>Viewed</strong> and
            saves to database.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Lab ID</th>
                  <th>Patient Name</th>
                  <th>Tests</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No lab records match your filters
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const patient = getPatientById(req.patientId)
                    const live = getLabRequestById(req.id) ?? req
                    const viewLabel = getViewStatusLabel(live)
                    const isViewing = viewingId === req.id
                    return (
                      <tr key={req.id}>
                        <td className="fw-medium">{req.requestNumber}</td>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td className="small">{req.tests.map((t) => t.testName).join(', ')}</td>
                        <td>
                          <StatusBadge status={viewLabel} />
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1 justify-content-center">
                            {req.status === 'Completed' && (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                title="View results"
                                disabled={isViewing}
                                onClick={() => void openResults(req)}
                              >
                                {isViewing ? (
                                  <span className="spinner-border spinner-border-sm" role="status" />
                                ) : (
                                  <IconifyIcon icon="solar:document-text-broken" />
                                )}
                              </Button>
                            )}
                            <Link to={`/hms/doctor/consultation/${req.visitId}?tab=lab`}>
                              <Button size="sm" variant="primary" title="Consult">
                                <IconifyIcon icon="solar:stethoscope-broken" className="me-1" />
                                Consult
                              </Button>
                            </Link>
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

      <Modal show={!!viewLab} onHide={closeResults} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2 flex-wrap">
            <span>Lab Results — {viewLab?.requestNumber}</span>
            {viewLab && isLabResultViewedByDoctor(viewLab) && (
              <StatusBadge status="Viewed" />
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewLab && (
            <>
              <p className="mb-3">
                <strong>Patient:</strong> {getPatientById(viewLab.patientId)?.fullName}
                {viewLab.completedAt && (
                  <span className="text-muted ms-2">
                    · {new Date(viewLab.completedAt).toLocaleString()}
                  </span>
                )}
                {viewLab.doctorViewedAt && (
                  <span className="text-muted ms-2">
                    · Viewed {new Date(viewLab.doctorViewedAt).toLocaleString()}
                  </span>
                )}
              </p>
              <Table bordered size="sm" className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Test</th>
                    <th>Result</th>
                    <th>Reference</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLab.tests.map((t, i) => (
                    <tr key={i}>
                      <td>{t.testName}</td>
                      <td className="fw-semibold">{t.result ?? '—'}</td>
                      <td>{t.referenceValue ?? '—'}</td>
                      <td>{t.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={closeResults}>
            Close
          </Button>
          {viewLab && (
            <Link to={`/hms/doctor/consultation/${viewLab.visitId}?tab=lab`}>
              <Button variant="primary">
                <IconifyIcon icon="solar:stethoscope-broken" className="me-1" />
                Consult — add Lab / Rx / more
              </Button>
            </Link>
          )}
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default DoctorLabResultsPage
