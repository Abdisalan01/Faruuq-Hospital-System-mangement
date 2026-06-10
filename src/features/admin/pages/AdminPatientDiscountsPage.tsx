import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  Modal,
  Row,
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  clampDiscountPercent,
  generateId,
  getPatientById,
  getStaffById,
  getStaffByRole,
  patientDiscounts,
  persistPatientDiscountNowAsync,
  patients,
  sendPatientDiscountToReception,
} from '@/shared/services/hmsStore'
import type { PatientDiscountFeeType, PatientDiscountStatus } from '@/shared/types'
import { discountAmountFromPercent, FEE_TYPE_LABELS } from '@/shared/utils/discountLimits'

type StatusFilter = 'all' | PatientDiscountStatus

const AdminPatientDiscountsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const [, setRefresh] = useState(0)
  const refresh = () => setRefresh((r) => r + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [feeType, setFeeType] = useState<PatientDiscountFeeType>('registration')
  const [feeAmount, setFeeAmount] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')

  const doctors = useMemo(() => getStaffByRole('doctor').filter((d) => d.isActive), [])

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim()
    return patientDiscounts
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => {
        if (!q) return true
        const patient = getPatientById(p.patientId)
        const doctor = getStaffById(p.doctorId)
        const hay = `${p.patientId} ${patient?.fullName ?? ''} ${doctor?.firstName ?? ''} ${doctor?.lastName ?? ''} ${p.feeType}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [search, statusFilter, patientDiscounts.length])

  const resetForm = () => {
    setPatientId('')
    setDoctorId(doctors[0]?.id ?? '')
    setFeeType('registration')
    setFeeAmount(0)
    setDiscountPercent(0)
    setNotes('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!patientId || !doctorId || feeAmount <= 0) {
      setMessage('Select patient, doctor, and enter a valid fee amount.')
      return
    }

    const cappedPercent = clampDiscountPercent(user?.role ?? 'admin', feeType, discountPercent)
    const discountAmount = discountAmountFromPercent(feeAmount, cappedPercent)
    setSaving(true)
    setError('')
    try {
      patientDiscounts.push({
        id: generateId('pdisc'),
        patientId,
        doctorId,
        feeType,
        feeAmount,
        discountPercent: cappedPercent,
        discountAmount,
        netAmount: Math.max(0, feeAmount - discountAmount),
        status: 'Active',
        sentToReception: false,
        paymentCollected: false,
        appliedBy: user?.id ?? 'staff-001',
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      })

      if (isSupabase) await persistPatientDiscountNowAsync()

      setShowModal(false)
      setMessage(
        isSupabase ? 'Patient discount created and saved to database.' : 'Patient discount created.',
      )
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to database')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string) => {
    const row = patientDiscounts.find((p) => p.id === id)
    if (!row || row.paymentCollected) return
    row.status = row.status === 'Active' ? 'Inactive' : 'Active'
    try {
      if (isSupabase) await persistPatientDiscountNowAsync()
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to database')
    }
  }

  const sendToReception = async (id: string) => {
    if (!sendPatientDiscountToReception(id)) return
    setError('')
    try {
      if (isSupabase) await persistPatientDiscountNowAsync()
      setMessage('Sent to reception for payment collection.')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to database')
    }
  }

  const getDoctorName = (id: string) => {
    const d = getStaffById(id)
    return d ? `Dr. ${d.firstName} ${d.lastName}` : '—'
  }

  return (
    <PermissionGuard permissions={['system_settings', 'user_management']}>
      <PageMetaData title="Patient Discounts" />
      <PageHeader
        title="Patient Discounts"
        subtitle="Approve patient-specific discounts and send to reception for payment"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Patient Discounts' },
        ]}
        actionLabel="Add Patient Discount"
        actionIcon="solar:add-circle-broken"
        onAction={openCreate}
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

      <Card className="mb-3 border-0 shadow-sm">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search patient ID, name, doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['Active', 'Active'],
                    ['Inactive', 'Inactive'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Doctor</th>
                  <th>Fee Type</th>
                  <th className="text-end">Fee</th>
                  <th className="text-end">Discount</th>
                  <th className="text-end">Net</th>
                  <th>Status</th>
                  <th>Reception</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-5">
                      No patient discounts match your search or filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const patient = getPatientById(row.patientId)
                    return (
                      <tr key={row.id}>
                        <td className="text-muted">{patient?.id ?? row.patientId}</td>
                        <td className="fw-medium">{patient?.fullName ?? '—'}</td>
                        <td>{getDoctorName(row.doctorId)}</td>
                        <td>
                          <Badge bg="secondary-subtle" text="secondary">
                            {FEE_TYPE_LABELS[row.feeType]}
                          </Badge>
                        </td>
                        <td className="text-end">
                          {currency}
                          {row.feeAmount.toFixed(2)}
                        </td>
                        <td className="text-end text-danger">
                          -{currency}
                          {row.discountAmount.toFixed(2)}
                          {row.discountPercent > 0 && (
                            <span className="text-muted small"> ({row.discountPercent}%)</span>
                          )}
                        </td>
                        <td className="text-end fw-semibold">
                          {currency}
                          {row.netAmount.toFixed(2)}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          {row.paymentCollected ? (
                            <Badge bg="success-subtle" text="success">Paid</Badge>
                          ) : row.sentToReception ? (
                            <Badge bg="warning-subtle" text="warning">Pending payment</Badge>
                          ) : (
                            <Badge bg="secondary-subtle" text="secondary">Not sent</Badge>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {!row.paymentCollected && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                disabled={row.status !== 'Active' || row.sentToReception}
                                onClick={() => sendToReception(row.id)}
                              >
                                Send
                              </Button>
                            )}
                            {!row.paymentCollected && (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => toggleStatus(row.id)}
                              >
                                {row.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Patient Discount</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-2">
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Patient</Form.Label>
                <Form.Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.fullName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Doctor</Form.Label>
                <Form.Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  <option value="">Select doctor...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Fee type</Form.Label>
                <Form.Select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as PatientDiscountFeeType)}
                >
                  {Object.entries(FEE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Fee amount ({currency})</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Discount (%)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Net amount</Form.Label>
                <Form.Control
                  value={`${currency}${Math.max(0, feeAmount - discountAmountFromPercent(feeAmount, discountPercent)).toFixed(2)}`}
                  disabled
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Notes (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Discount'}
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default AdminPatientDiscountsPage
