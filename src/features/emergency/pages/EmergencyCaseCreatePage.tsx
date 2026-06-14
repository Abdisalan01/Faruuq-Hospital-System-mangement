import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageMetaData from '@/components/PageTitle'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import type { EmergencyCase, EmergencySeverity, Gender, Patient } from '@/shared/types'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import {
  emergencyCases,
  clearPatientDataResetFlag,
  generateId,
  generateNumber,
  patients,
  persistEmergencyCaseNowAsync,
} from '@/shared/services/hmsStore'

const SEVERITIES: EmergencySeverity[] = ['Critical', 'Urgent', 'Stable', 'Minor']

const EmergencyCaseCreatePage = () => {
  const navigate = useNavigate()
  const { isSupabase } = useHmsStoreContext()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing')
  const [emgNumber] = useState(() => generateNumber('EMG'))

  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    severity: 'Urgent' as EmergencySeverity,
    arrivalTime: new Date().toISOString().slice(0, 16),
    fullName: '',
    gender: 'Male' as Gender,
    age: 30,
    phone: '',
    address: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      let patientId = form.patientId

      if (patientMode === 'new') {
        clearPatientDataResetFlag()
        const newPatient: Patient = {
          id: generateId('pat'),
          fullName: form.fullName.trim(),
          gender: form.gender,
          age: form.age,
          phone: form.phone.trim(),
          address: form.address.trim(),
          paymentType: 'cash',
          status: 'Active',
          createdAt: new Date().toISOString().split('T')[0],
        }
        patients.push(newPatient)
        patientId = newPatient.id
      }

      const newCase: EmergencyCase = {
        id: generateId('emg'),
        emgNumber,
        patientId,
        arrivalTime: new Date(form.arrivalTime).toISOString(),
        severity: form.severity,
        status: 'Active',
        createdAt: new Date().toISOString(),
      }

      emergencyCases.push(newCase)
      if (isSupabase) await persistEmergencyCaseNowAsync()
      navigate(`/hms/emergency/cases/${newCase.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['emergency_registration']}>
      <PageMetaData title="Register Emergency Case" />
      <PageHeader
        title="Register Emergency Case"
        breadcrumbs={[
          { label: 'Emergency', href: '/hms/emergency/dashboard' },
          { label: 'Cases', href: '/hms/emergency/cases' },
          { label: 'Register' },
        ]}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <Form onSubmit={(e) => void handleSubmit(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>EMG Number (auto-generated)</Form.Label>
                  <Form.Control type="text" value={emgNumber} readOnly className="bg-light" />
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

            <Form.Group className="mb-3">
              <Form.Label>Patient</Form.Label>
              <div className="d-flex gap-3 mb-2">
                <Form.Check
                  type="radio"
                  id="existing-patient"
                  label="Select existing patient"
                  checked={patientMode === 'existing'}
                  onChange={() => setPatientMode('existing')}
                />
                <Form.Check
                  type="radio"
                  id="new-patient"
                  label="Register new patient"
                  checked={patientMode === 'new'}
                  onChange={() => setPatientMode('new')}
                />
              </div>

              {patientMode === 'existing' ? (
                <Form.Select
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  required
                >
                  <option value="">Select patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} — {p.phone}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Gender</Form.Label>
                      <Form.Select
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Age</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
              )}
            </Form.Group>

            <div className="d-flex gap-2">
              <Button type="submit" variant="danger" disabled={saving}>
                <IconifyIcon icon="solar:ambulance-broken" className="me-1" />
                {saving ? 'Saving…' : 'Register Emergency Case'}
              </Button>
              <Button type="button" variant="light" onClick={() => navigate('/hms/emergency/cases')}>
                Cancel
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default EmergencyCaseCreatePage
