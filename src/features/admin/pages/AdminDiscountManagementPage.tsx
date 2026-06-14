import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  persistSystemSettingsNowAsync,
  systemSettings,
  updateDiscountLimits,
} from '@/shared/services/hmsStore'
import type { DiscountLimitsSettings } from '@/shared/types'
import { FEE_TYPE_LABELS } from '@/shared/utils/discountLimits'

const AdminDiscountManagementPage = () => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [limits, setLimits] = useState<DiscountLimitsSettings>({
    reception: { ...systemSettings.discountLimits.reception },
    pharmacy: { ...systemSettings.discountLimits.pharmacy },
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLimits({
      reception: { ...systemSettings.discountLimits.reception },
      pharmacy: { ...systemSettings.discountLimits.pharmacy },
    })
  }, [dataVersion])

  const save = async () => {
    setError('')
    setMessage('')

    const allPercents = [
      ...Object.values(limits.reception),
      limits.pharmacy.dispensing,
    ]
    if (allPercents.some((p) => Number.isNaN(p) || p < 0 || p > 100)) {
      setError('All discount limits must be between 0% and 100%.')
      return
    }

    setSaving(true)
    try {
      updateDiscountLimits(limits)
      if (isSupabase) await persistSystemSettingsNowAsync()
      setLimits({
        reception: { ...systemSettings.discountLimits.reception },
        pharmacy: { ...systemSettings.discountLimits.pharmacy },
      })
      setMessage(
        isSupabase
          ? 'Discount limits saved to database. Reception and pharmacy will use these maximums.'
          : 'Discount limits saved locally. Enable VITE_USE_SUPABASE to persist to database.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save discount limits')
    } finally {
      setSaving(false)
    }
  }

  const clampPercent = (value: number) => {
    if (Number.isNaN(value)) return 0
    return Math.max(0, Math.min(100, value))
  }

  const updateReception = (key: keyof DiscountLimitsSettings['reception'], value: number) => {
    setLimits((prev) => ({
      ...prev,
      reception: { ...prev.reception, [key]: clampPercent(value) },
    }))
  }

  const updatePharmacy = (value: number) => {
    setLimits((prev) => ({
      ...prev,
      pharmacy: { dispensing: clampPercent(value) },
    }))
  }

  return (
    <PermissionGuard permissions={['system_settings', 'user_management']}>
      <PageMetaData title="Discount Management" />
      <PageHeader
        title="Discount Management"
        subtitle="Set maximum discount percentages each role is allowed to apply"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Discount Management' },
        ]}
      />

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2">
          {error}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={7}>
          <Card className="border-0 shadow-sm">
            <CardBody>
              <h5 className="mb-1">
                <IconifyIcon icon="solar:user-id-broken" className="me-1 text-primary" />
                Reception / Cashier limits
              </h5>
              <p className="text-muted small mb-4">
                Maximum discount % reception can apply when collecting registration, lab, surgery, and in-patient
                fees.
              </p>
              <Row className="g-3">
                {(
                  [
                    ['registration', 'Registration'],
                    ['lab', 'Laboratory'],
                    ['surgery', 'Surgery'],
                    ['inpatient', 'In-Patient'],
                  ] as const
                ).map(([key, label]) => (
                  <Col md={6} key={key}>
                    <Form.Group>
                      <Form.Label>{label}</Form.Label>
                      <div className="input-group">
                        <Form.Control
                          type="number"
                          min={0}
                          max={100}
                          value={limits.reception[key]}
                          onChange={(e) => updateReception(key, Number(e.target.value))}
                        />
                        <span className="input-group-text">% max</span>
                      </div>
                      <Form.Text className="text-muted">{FEE_TYPE_LABELS[key]} fee discount cap</Form.Text>
                    </Form.Group>
                  </Col>
                ))}
              </Row>
            </CardBody>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="border-0 shadow-sm h-100">
            <CardBody>
              <h5 className="mb-1">
                <IconifyIcon icon="solar:pill-broken" className="me-1 text-success" />
                Pharmacy limit
              </h5>
              <p className="text-muted small mb-4">
                Maximum discount % pharmacy staff can apply when dispensing medicines.
              </p>
              <Form.Group>
                <Form.Label>Pharmacy / Dispensing</Form.Label>
                <div className="input-group">
                  <Form.Control
                    type="number"
                    min={0}
                    max={100}
                    value={limits.pharmacy.dispensing}
                    onChange={(e) => updatePharmacy(Number(e.target.value))}
                  />
                  <span className="input-group-text">% max</span>
                </div>
              </Form.Group>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="mt-3 border-0 shadow-sm">
        <CardBody>
          <h6 className="mb-3">Current limits summary</h6>
          <Row>
            <Col md={6}>
              <ul className="small mb-md-0">
                <li>Registration: <strong>{limits.reception.registration}%</strong></li>
                <li>Laboratory: <strong>{limits.reception.lab}%</strong></li>
                <li>Surgery: <strong>{limits.reception.surgery}%</strong></li>
                <li>In-Patient: <strong>{limits.reception.inpatient}%</strong></li>
              </ul>
            </Col>
            <Col md={6}>
              <ul className="small mb-0">
                <li>Pharmacy dispensing: <strong>{limits.pharmacy.dispensing}%</strong></li>
              </ul>
            </Col>
          </Row>
          <Button variant="success" className="mt-3" onClick={() => void save()} disabled={saving}>
            <IconifyIcon icon="solar:diskette-broken" className="me-1" />
            {saving ? 'Saving...' : 'Save discount limits'}
          </Button>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default AdminDiscountManagementPage
