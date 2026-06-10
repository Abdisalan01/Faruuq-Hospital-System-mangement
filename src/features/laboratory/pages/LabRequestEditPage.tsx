import { useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import A4PrintModal from '@/features/doctor/components/a4/A4PrintModal'
import LabResultReportA4 from '@/features/laboratory/components/LabResultReportA4'
import { buildLabResultReportData } from '@/features/laboratory/utils/labResultReport'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  completeLabRequest,
  getPatientById,
  labRequests,
  persistLabRequestNowAsync,
} from '@/shared/services/hmsStore'
import type { LabTestItem } from '@/shared/types'
import { refreshVisitWorkflow } from '@/shared/utils/visitConsultation'
import type { LabResultReportData } from '@/features/laboratory/components/LabResultReportA4'

const LabRequestEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isSupabase } = useHmsStoreContext()
  const request = id ? labRequests.find((l) => l.id === id) : undefined
  const patient = request ? getPatientById(request.patientId) : undefined

  const [tests, setTests] = useState<LabTestItem[]>(request ? request.tests.map((t) => ({ ...t })) : [])
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [printData, setPrintData] = useState<LabResultReportData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [canPrint, setCanPrint] = useState(false)
  const [saving, setSaving] = useState(false)

  const updateTest = (index: number, field: keyof LabTestItem, value: string) => {
    setTests((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  const openPrint = () => {
    if (!request) return
    const draft = { ...request, tests }
    const data = buildLabResultReportData(draft)
    if (!data) return
    setPrintData(data)
    setShowPrintModal(true)
  }

  const saveResults = async () => {
    if (!request) return
    const missing = tests.some((t) => !t.result?.trim())
    if (missing) {
      setMessage({ type: 'danger', text: 'Enter a result for each test' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const completed = completeLabRequest(request.id, tests)
      refreshVisitWorkflow(completed.visitId)

      if (isSupabase) {
        await persistLabRequestNowAsync(completed.id)
      }

      const data = buildLabResultReportData(completed)
      if (data) {
        setPrintData(data)
        setCanPrint(true)
        setMessage({
          type: 'success',
          text: isSupabase
            ? 'Results saved to database. Status: Completed. Click Print for A4 report.'
            : 'Results saved. Click Print to print the A4 report.',
        })
      } else {
        setMessage({
          type: 'success',
          text: isSupabase ? 'Results saved to database.' : 'Results saved.',
        })
        setTimeout(() => navigate(`/hms/laboratory/requests/${request.id}`), 1500)
      }
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err instanceof Error ? err.message : 'Could not save results to database',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!request) {
    return (
      <PermissionGuard permissions={['enter_lab_results']}>
        <PageMetaData title="Enter Lab Results" />
        <p className="text-danger">Lab request not found.</p>
        <Link to="/hms/laboratory/all">Back to list</Link>
      </PermissionGuard>
    )
  }

  if (request.status === 'Awaiting Payment') {
    return (
      <PermissionGuard permissions={['enter_lab_results']}>
        <PageMetaData title="Enter Lab Results" />
        <Alert variant="warning">This request is awaiting payment at reception.</Alert>
        <Link to="/hms/laboratory/all">Back to All Labs</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['enter_lab_results']}>
      <PageMetaData title={`Enter Results — ${request.requestNumber}`} />
      <PageHeader
        title={`Enter Results — ${request.requestNumber}`}
        subtitle={patient ? `Patient: ${patient.fullName}` : undefined}
        breadcrumbs={[
          { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
          { label: 'All Labs', href: '/hms/laboratory/all' },
          { label: request.requestNumber, href: `/hms/laboratory/requests/${request.id}` },
          { label: 'Edit' },
        ]}
      />

      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          {tests.map((test, idx) => (
            <Row key={idx} className="mb-3 border-bottom pb-3">
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Test</Form.Label>
                  <Form.Control plaintext readOnly value={test.testName} />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Result</Form.Label>
                  <Form.Control
                    value={test.result ?? ''}
                    onChange={(e) => updateTest(idx, 'result', e.target.value)}
                    placeholder="Enter result"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Reference Value</Form.Label>
                  <Form.Control
                    value={test.referenceValue ?? ''}
                    onChange={(e) => updateTest(idx, 'referenceValue', e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Remarks</Form.Label>
                  <Form.Control
                    value={test.remarks ?? ''}
                    onChange={(e) => updateTest(idx, 'remarks', e.target.value)}
                    placeholder="Optional"
                  />
                </Form.Group>
              </Col>
            </Row>
          ))}

          <div className="d-flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void saveResults()} disabled={saving}>
              <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
              {saving ? 'Saving...' : 'Submit'}
            </Button>
            {canPrint && printData && (
              <Button variant="outline-primary" onClick={openPrint}>
                <IconifyIcon icon="solar:printer-broken" className="me-1" />
                Print A4
              </Button>
            )}
            <Link to={`/hms/laboratory/requests/${request.id}`} className="btn btn-outline-secondary">
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>

      <A4PrintModal
        show={showPrintModal}
        onHide={() => {
          setShowPrintModal(false)
          if (request.status === 'Completed') {
            navigate(`/hms/laboratory/requests/${request.id}`)
          }
        }}
        title="Laboratory Result — A4 / PDF"
      >
        {printData && <LabResultReportA4 data={printData} />}
      </A4PrintModal>
    </PermissionGuard>
  )
}

export default LabRequestEditPage
