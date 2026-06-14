import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, Form } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  getObstetricianFee,
  persistSystemSettingsNowAsync,
  setObstetricianFee,
} from '@/shared/services/hmsStore'

const AdminObstetricianFeePage = () => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [fee, setFee] = useState(getObstetricianFee())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFee(getObstetricianFee())
  }, [dataVersion])

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3500)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setObstetricianFee(fee)
    if (!isSupabase) {
      showMessage('Obstetrician fee saved.')
      return
    }
    setSaving(true)
    try {
      await persistSystemSettingsNowAsync()
      showMessage('Obstetrician fee saved to database.')
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      showMessage(`Save failed: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['system_settings']}>
      <PageMetaData title="Obstetrician Fee" />
      <PageHeader
        title="Obstetrician Fee"
        subtitle="Set the fee reception collects for delivery / maternity registration"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Obstetrician Fee' },
        ]}
      />

      {message && (
        <Alert variant="success" className="py-2">
          {message}
        </Alert>
      )}

      <Card className="mw-100" style={{ maxWidth: 480 }}>
        <CardBody>
          <h5 className="mb-3">Delivery registration fee</h5>
          <p className="text-muted small">
            This amount is applied when reception registers a mother who has delivered and collects
            the obstetrician fee.
          </p>
          <Form onSubmit={(e) => void handleSave(e)}>
            <Form.Group className="mb-3">
              <Form.Label>Obstetrician fee ({currency})</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step={0.01}
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                required
              />
            </Form.Group>
            <p className="text-muted small mb-3">
              Current fee:{' '}
              <strong>
                {currency}
                {getObstetricianFee().toLocaleString()}
              </strong>
            </p>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? 'Saving…' : 'Save fee'}
            </Button>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default AdminObstetricianFeePage
