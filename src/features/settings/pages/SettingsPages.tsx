import { Alert, Card, CardBody, Col, Form, Row, Button } from 'react-bootstrap'
import { useState } from 'react'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import { persistSystemSettingsNowAsync, systemSettings } from '@/shared/services/hmsStore'
import { currency } from '@/context/constants'

export const HospitalInfoPage = () => {
  const { isSupabase } = useHmsStoreContext()
  const [form, setForm] = useState({ ...systemSettings })
  const [message, setMessage] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    Object.assign(systemSettings, form)
    try {
      if (isSupabase) await persistSystemSettingsNowAsync()
      setMessage(isSupabase ? 'Hospital info saved to database.' : 'Saved locally.')
    } catch {
      setMessage('Save failed — check Supabase connection.')
    }
  }

  return (
    <PermissionGuard permissions={['system_settings']}>
      <PageMetaData title="Hospital Information" />
      <PageHeader title="Hospital Information" breadcrumbs={[{ label: 'Settings' }, { label: 'Hospital Info' }]} />
      {message && <Alert variant="info">{message}</Alert>}
      <Card>
        <CardBody>
          <Form onSubmit={(e) => void handleSave(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Hospital Name</Form.Label>
                  <Form.Control value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Address</Form.Label>
                  <Form.Control value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
            <Button type="submit" variant="success">
              Save Changes
            </Button>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export const ServicesPricingPage = () => {
  const { isSupabase } = useHmsStoreContext()
  const [form, setForm] = useState({
    consultationFee: systemSettings.consultationFee,
    registrationFee: systemSettings.registrationFee,
  })
  const [message, setMessage] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    systemSettings.consultationFee = form.consultationFee
    systemSettings.registrationFee = form.registrationFee
    try {
      if (isSupabase) await persistSystemSettingsNowAsync()
      setMessage(isSupabase ? 'Pricing saved to database.' : 'Saved locally.')
    } catch {
      setMessage('Save failed — check Supabase connection.')
    }
  }

  return (
    <PermissionGuard permissions={['system_settings']}>
      <PageMetaData title="Services & Pricing" />
      <PageHeader title="Services & Pricing" breadcrumbs={[{ label: 'Settings' }, { label: 'Pricing' }]} />
      {message && <Alert variant="info">{message}</Alert>}
      <Card>
        <CardBody>
          <Form onSubmit={(e) => void handleSave(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Consultation Fee ({currency})</Form.Label>
                  <Form.Control type="number" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) })} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Registration Fee ({currency})</Form.Label>
                  <Form.Control type="number" value={form.registrationFee} onChange={(e) => setForm({ ...form, registrationFee: Number(e.target.value) })} />
                </Form.Group>
              </Col>
            </Row>
            <Button type="submit" variant="success">
              Save Pricing
            </Button>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export const GeneralSettingsPage = () => (
  <PermissionGuard permissions={['system_settings']}>
    <PageMetaData title="General Settings" />
    <PageHeader title="General Settings" breadcrumbs={[{ label: 'Settings' }, { label: 'General' }]} />
    <Card>
      <CardBody>
        <p className="text-muted">System-wide preferences and configuration options for the hospital management system.</p>
        <ul className="mb-0">
          <li>Default currency: {currency}</li>
          <li>Patient ID auto-generation: Enabled</li>
          <li>Visit queue auto-numbering: Enabled</li>
          <li>Credit account tracking: Enabled</li>
        </ul>
      </CardBody>
    </Card>
  </PermissionGuard>
)
