import { useMemo, useState } from 'react'
import { Button, Col, Form, Modal, Row } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import SupplyItemPicker from '@/shared/components/SupplyItemPicker'
import {
  departmentSupplyRequests,
  generateId,
  persistSupplyRequestNowAsync,
  staffUsers,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import type { SupplyRequestDepartment } from '@/shared/types'

type SupplyLine = { supplyName: string; quantity: number; unit: string }

const DEPARTMENTS: SupplyRequestDepartment[] = ['Doctor', 'Emergency', 'Laboratory', 'Nursing']

const emptyLine = (): SupplyLine => ({ supplyName: '', quantity: 1, unit: 'Unit' })

type AddSupplyRequestModalProps = {
  show: boolean
  onHide: () => void
  onSaved: () => void
}

const AddSupplyRequestModal = ({ show, onHide, onSaved }: AddSupplyRequestModalProps) => {
  const { isSupabase } = useHmsStoreContext()
  const [department, setDepartment] = useState<SupplyRequestDepartment>('Doctor')
  const [requesterId, setRequesterId] = useState('')
  const [lines, setLines] = useState<SupplyLine[]>([emptyLine()])
  const [notes, setNotes] = useState('')

  const doctors = useMemo(
    () =>
      staffUsers
        .filter((s) => s.isActive && s.role === 'doctor')
        .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [staffUsers.length],
  )

  const reset = () => {
    setDepartment('Doctor')
    setRequesterId('')
    setLines([emptyLine()])
    setNotes('')
  }

  const handleClose = () => {
    reset()
    onHide()
  }

  const updateLine = (index: number, field: keyof SupplyLine, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  const updateSupplyLine = (index: number, name: string, unit?: string) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              supplyName: name,
              unit: unit ?? l.unit,
            }
          : l,
      ),
    )
  }

  const handleSave = async () => {
    const valid = lines.filter((l) => l.supplyName.trim())
    if (valid.length === 0) return
    if (department === 'Doctor' && !requesterId) return

    departmentSupplyRequests.push({
      id: generateId('dsr'),
      department,
      requesterId: department === 'Doctor' ? requesterId : '',
      items: valid.map((l) => ({
        supplyName: l.supplyName.trim(),
        quantity: l.quantity,
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
      return
    }

    reset()
    onSaved()
    onHide()
  }

  const canSave =
    lines.some((l) => l.supplyName.trim()) && (department !== 'Doctor' || Boolean(requesterId))

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add Supply Request</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2 mb-3">
          <Col md={department === 'Doctor' ? 6 : 12}>
            <Form.Group>
              <Form.Label>Department</Form.Label>
              <Form.Select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value as SupplyRequestDepartment)
                  setRequesterId('')
                }}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          {department === 'Doctor' && (
            <Col md={6}>
              <Form.Group>
                <Form.Label>Doctor</Form.Label>
                <Form.Select value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                  <option value="">Select doctor...</option>
                  {doctors.map((s) => (
                    <option key={s.id} value={s.id}>
                      Dr. {s.firstName} {s.lastName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          )}
        </Row>

        {lines.map((line, idx) => (
          <Row key={idx} className="g-2 mb-2 align-items-end">
            <Col md={5}>
              <Form.Group>
                <Form.Label className="small text-muted">Supply item</Form.Label>
                <SupplyItemPicker
                  value={line.supplyName}
                  onChange={(name, unit) => updateSupplyLine(idx, name, unit)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted">Qty</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted">Unit</Form.Label>
                <Form.Control
                  value={line.unit}
                  onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={1}>
              {lines.length > 1 && (
                <Button
                  type="button"
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setLines((l) => l.filter((_, i) => i !== idx))}
                >
                  ×
                </Button>
              )}
            </Col>
          </Row>
        ))}

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

        <Form.Group>
          <Form.Label>Notes</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Urgency, ward location..."
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave} disabled={!canSave}>
          <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
          Save request
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default AddSupplyRequestModal
