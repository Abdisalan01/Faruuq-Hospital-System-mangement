import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageMetaData from '@/components/PageTitle'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'

import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import type { EmergencySeverity } from '@/shared/types'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import { emergencyCases, getPatientById, patients, persistEmergencyCaseNowAsync } from '@/shared/services/hmsStore'

const SEVERITIES: EmergencySeverity[] = ['Critical', 'Urgent', 'Stable', 'Minor']

const EmergencyCaseEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isSupabase } = useHmsStoreContext()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const emgCase = emergencyCases.find((c) => c.id === id)

  const [form, setForm] = useState({
    patientId: emgCase?.patientId ?? '',
    severity: emgCase?.severity ?? ('Urgent' as EmergencySeverity),
    arrivalTime: emgCase ? new Date(emgCase.arrivalTime).toISOString().slice(0, 16) : '',
    triageNotes: emgCase?.triageNotes ?? '',
    diagnosis: emgCase?.diagnosis ?? '',
    status: emgCase?.status ?? ('Active' as 'Active' | 'Completed'),
  })

  if (!emgCase) {
    return (
      <>
        <PageMetaData title="Case Not Found" />
        <Alert variant="danger">Emergency case not found.</Alert>
      </>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      emgCase.patientId = form.patientId
      emgCase.severity = form.severity
      emgCase.arrivalTime = new Date(form.arrivalTime).toISOString()
      emgCase.triageNotes = form.triageNotes.trim() || undefined
      emgCase.diagnosis = form.diagnosis.trim() || undefined
      emgCase.status = form.status
      if (isSupabase) await persistEmergencyCaseNowAsync()
      navigate(`/hms/emergency/cases/${emgCase.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['emergency_registration']}>
      <PageMetaData title={`Edit ${emgCase.emgNumber}`} />
      <PageHeader
        title={`Edit ${emgCase.emgNumber}`}
        breadcrumbs={[
          { label: 'Emergency', href: '/hms/emergency/dashboard' },
          { label: 'Cases', href: '/hms/emergency/cases' },
          { label: emgCase.emgNumber, href: `/hms/emergency/cases/${emgCase.id}` },
          { label: 'Edit' },
        ]}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <Form onSubmit={(e) => void handleSubmit(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>EMG Number</Form.Label>
                  <Form.Control type="text" value={emgCase.emgNumber} readOnly className="bg-light" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Arrival Time</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={form.arrivalTime}
                    onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Patient</Form.Label>
              <Form.Select
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} — {getPatientById(p.id)?.phone}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Severity</Form.Label>
                  <Form.Select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as EmergencySeverity })}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Completed' })}
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Triage Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.triageNotes}
                onChange={(e) => setForm({ ...form, triageNotes: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Diagnosis</Form.Label>
              <Form.Control
                type="text"
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="light" onClick={() => navigate(`/hms/emergency/cases/${emgCase.id}`)}>
                Cancel
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default EmergencyCaseEditPage
