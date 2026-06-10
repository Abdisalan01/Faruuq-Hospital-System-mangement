import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import SupplyItemPicker from '@/shared/components/SupplyItemPicker'
import StatusBadge from '@/shared/components/StatusBadge'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import {
  departmentSupplyRequests,
  generateId,
  persistSupplyRequestNowAsync,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import type { SupplyRequestDepartment } from '@/shared/types'

type SupplyLine = { supplyName: string; quantity: number; unit: string }

const emptyLine = (): SupplyLine => ({ supplyName: '', quantity: 1, unit: 'Unit' })

const DEPARTMENT_VARIANT: Record<SupplyRequestDepartment, string> = {
  Doctor: 'primary',
  Emergency: 'danger',
  Laboratory: 'info',
  Nursing: 'success',
}

type DepartmentSupplyRequestFormProps = {
  department: SupplyRequestDepartment
  requesterId: string
}

const DepartmentSupplyRequestForm = ({
  department,
  requesterId,
}: DepartmentSupplyRequestFormProps) => {
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [requesterName, setRequesterName] = useState('')
  const [lines, setLines] = useState<SupplyLine[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const myRequests = useMemo(
    () =>
      departmentSupplyRequests
        .filter((r) => r.department === department && r.requesterId === requesterId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [department, requesterId, departmentSupplyRequests.length, tick, dataVersion],
  )

  const updateLine = (index: number, field: keyof SupplyLine, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  const selectItem = (index: number, name: string, unit?: string) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, supplyName: name, unit: unit?.trim() || l.unit || 'Unit' } : l,
      ),
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = lines.filter((l) => l.supplyName.trim())
    if (valid.length === 0) {
      setMessage('Add at least one supply item.')
      return
    }

    setSaving(true)
    departmentSupplyRequests.push({
      id: generateId('dsr'),
      department,
      requesterId,
      requesterName: requesterName.trim() || undefined,
      items: valid.map((l) => ({
        supplyName: l.supplyName.trim(),
        quantity: Math.max(1, l.quantity),
        unit: l.unit.trim() || 'Unit',
      })),
      notes: notes.trim() || undefined,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    })

    touchHmsStore()

    try {
      if (isSupabase) await persistSupplyRequestNowAsync()
    } catch {
      setMessage('Request created locally but database save failed.')
      setSaving(false)
      return
    }

    setRequesterName('')
    setLines([emptyLine()])
    setNotes('')
    setMessage(
      `Supply request sent to pharmacy.${isSupabase ? ' Saved to database.' : ''}`,
    )
    setSaving(false)
    refresh()
  }

  const submitVariant =
    department === 'Emergency'
      ? 'danger'
      : department === 'Nursing'
        ? 'success'
        : department === 'Laboratory'
          ? 'info'
          : 'primary'

  return (
    <>
      {message && (
        <Alert
          variant={message.includes('failed') ? 'danger' : 'success'}
          className="py-2"
          dismissible
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      <Row className="g-3">
        <Col xl={7}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody>
              <div className="d-flex align-items-center gap-2 mb-3">
                <Badge bg={`${DEPARTMENT_VARIANT[department]}-subtle`} text={DEPARTMENT_VARIANT[department]}>
                  {department}
                </Badge>
                <h5 className="mb-0">Supply request to pharmacy</h5>
              </div>

              <Form onSubmit={submit}>
                <Form.Group className="mb-3">
                  <Form.Label>Requester name</Form.Label>
                  <Form.Control
                    type="text"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Your name or ward contact..."
                  />
                </Form.Group>

                <h6 className="mb-2">Supply items</h6>
                <p className="text-muted small mb-3">
                  Search and select from pharmacy medicines — then set quantity and unit.
                </p>

                <div className="table-responsive mb-2">
                  <Table size="sm" className="mb-0 align-middle">
                    <thead className="bg-light bg-opacity-50">
                      <tr>
                        <th style={{ minWidth: 220 }}>Item name</th>
                        <th style={{ width: 100 }}>Qty</th>
                        <th style={{ width: 120 }}>Unit</th>
                        <th style={{ width: 48 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <SupplyItemPicker
                              size="sm"
                              value={line.supplyName}
                              onChange={(name, unit) => selectItem(idx, name, unit)}
                            />
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              size="sm"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              value={line.unit}
                              onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                              placeholder="Unit"
                            />
                          </td>
                          <td className="text-center">
                            {lines.length > 1 && (
                              <Button
                                type="button"
                                variant="outline-danger"
                                size="sm"
                                className="px-2"
                                onClick={() => setLines((l) => l.filter((_, i) => i !== idx))}
                              >
                                ×
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="mb-3"
                  onClick={() => setLines((l) => [...l, emptyLine()])}
                >
                  <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                  Add item
                </Button>

                <Form.Group className="mb-3">
                  <Form.Label>Notes (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Urgency, ward location, special instructions..."
                  />
                </Form.Group>

                <Button type="submit" variant={submitVariant} size="lg" disabled={saving}>
                  <IconifyIcon icon="solar:plain-2-broken" className="me-1" />
                  {saving ? 'Sending...' : 'Submit to Pharmacy'}
                </Button>
              </Form>
            </CardBody>
          </Card>
        </Col>

        <Col xl={5}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody>
              <h5 className="mb-3">My requests</h5>
              {myRequests.length === 0 ? (
                <div className="text-center text-muted py-5 border rounded bg-light bg-opacity-50">
                  <IconifyIcon icon="solar:box-minimalistic-broken" className="fs-48 mb-2" />
                  <p className="mb-0">No supply requests yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="mb-0 align-middle">
                    <thead className="bg-light bg-opacity-50">
                      <tr>
                        <th>Date</th>
                        <th>Requester</th>
                        <th>Items</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.map((r) => (
                        <tr key={r.id}>
                          <td className="small">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="small">{r.requesterName ?? '—'}</td>
                          <td className="small">
                            {r.items
                              .map((i) => `${i.supplyName} ×${i.quantity} ${i.unit}`)
                              .join(', ')}
                          </td>
                          <td>
                            <StatusBadge status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default DepartmentSupplyRequestForm
