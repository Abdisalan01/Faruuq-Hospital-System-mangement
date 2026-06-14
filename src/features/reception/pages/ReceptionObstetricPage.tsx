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
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PrintableReceipt from '@/features/reception/components/PrintableReceipt'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  confirmObstetricDeliveryPayment,
  createObstetricDelivery,
  deleteObstetricDelivery,
  getObstetricDeliveries,
  getObstetricDoctors,
  getObstetricianFee,
  getObstetricReceiptByDeliveryId,
  getStaffById,
  persistObstetricDeliveryNowAsync,
  updateObstetricDelivery,
} from '@/shared/services/hmsStore'
import type { ObstetricChildGender, ObstetricDelivery, ReceptionReceipt } from '@/shared/types'

type FormState = {
  motherFullName: string
  motherAge: string
  motherPhone: string
  childGender: ObstetricChildGender
  doctorId: string
}

const emptyForm = (): FormState => ({
  motherFullName: '',
  motherAge: '',
  motherPhone: '',
  childGender: 'Female',
  doctorId: '',
})

const getDoctorLabel = (doctorId: string) => {
  const doctor = getStaffById(doctorId)
  if (!doctor) return '—'
  return `Dr. ${doctor.firstName} ${doctor.lastName}`
}

const ReceptionObstetricPage = () => {
  const { user } = useAuthContext()
  const { dataVersion, isSupabase } = useHmsStoreContext()

  const doctors = useMemo(() => getObstetricDoctors(), [dataVersion])
  const defaultDoctorId = doctors[0]?.id ?? ''

  const [search, setSearch] = useState('')
  const [babyGenderFilter, setBabyGenderFilter] = useState<'all' | 'Female' | 'Male'>('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [collectOnSave, setCollectOnSave] = useState(true)

  const [showPayModal, setShowPayModal] = useState(false)
  const [payTarget, setPayTarget] = useState<ObstetricDelivery | null>(null)

  const [printReceipt, setPrintReceipt] = useState<ReceptionReceipt | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ObstetricDelivery | null>(null)

  const obstetricFee = getObstetricianFee()

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return getObstetricDeliveries()
      .filter((row) => {
        if (babyGenderFilter !== 'all' && row.childGender !== babyGenderFilter) return false
        if (!q) return true
        return (
          row.motherFullName.toLowerCase().includes(q) ||
          row.motherPhone.includes(q) ||
          row.registrationNumber.toLowerCase().includes(q) ||
          getDoctorLabel(row.doctorId).toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [search, babyGenderFilter, dataVersion])

  const pagination = useTablePagination(rows, 10, [rows.length, dataVersion])

  const pendingCount = useMemo(
    () => getObstetricDeliveries().filter((r) => r.status === 'Pending').length,
    [dataVersion],
  )
  const paidCount = useMemo(
    () => getObstetricDeliveries().filter((r) => r.status === 'Paid').length,
    [dataVersion],
  )

  const flash = (text: string, isError = false) => {
    if (isError) {
      setError(text)
      setMessage('')
      setTimeout(() => setError(''), 4000)
    } else {
      setMessage(text)
      setError('')
      setTimeout(() => setMessage(''), 3500)
    }
  }

  const persist = async (deliveryId?: string, successText?: string) => {
    if (!isSupabase) {
      if (successText) flash(successText)
      return
    }
    setSaving(true)
    try {
      await persistObstetricDeliveryNowAsync(deliveryId)
      if (successText) flash(`${successText} Saved to database.`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      flash(`Database save failed: ${detail}`, true)
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm(), doctorId: defaultDoctorId })
    setCollectOnSave(true)
    setShowFormModal(true)
  }

  const openEdit = (row: ObstetricDelivery) => {
    setEditingId(row.id)
    setForm({
      motherFullName: row.motherFullName,
      motherAge: String(row.motherAge),
      motherPhone: row.motherPhone,
      childGender: row.childGender,
      doctorId: row.doctorId,
    })
    setCollectOnSave(false)
    setShowFormModal(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (obstetricFee <= 0) {
      flash('Obstetrician fee is not set. Ask admin to configure it first.', true)
      return
    }

    const age = parseInt(form.motherAge, 10)
    if (!form.motherFullName.trim() || !form.motherPhone.trim() || !form.doctorId || age < 1) {
      flash('Fill in all required fields correctly.', true)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const ok = updateObstetricDelivery(editingId, {
          motherFullName: form.motherFullName,
          motherAge: age,
          motherPhone: form.motherPhone,
          childGender: form.childGender,
          doctorId: form.doctorId,
        })
        if (!ok) {
          flash('Could not update — record may already be paid.', true)
          return
        }
        await persist(editingId, 'Registration updated.')
        setShowFormModal(false)
        return
      }

      const created = createObstetricDelivery({
        motherFullName: form.motherFullName,
        motherAge: age,
        motherPhone: form.motherPhone,
        childGender: form.childGender,
        doctorId: form.doctorId,
        createdBy: user?.id ?? 'staff-002',
      })
      if (!created) {
        flash('Could not create registration.', true)
        return
      }

      if (collectOnSave) {
        const receipt = confirmObstetricDeliveryPayment(created.id, user?.id ?? 'staff-002')
        if (!receipt) {
          flash('Registration saved but payment failed.', true)
          await persist(created.id)
          setShowFormModal(false)
          return
        }
        await persist(created.id, 'Registration saved and payment collected.')
        setShowFormModal(false)
        setPrintReceipt(receipt)
        setShowPrintModal(true)
        return
      }

      await persist(created.id, 'Registration saved — collect payment when ready.')
      setShowFormModal(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCollectPayment = async () => {
    if (!payTarget) return
    if (obstetricFee <= 0) {
      flash('Obstetrician fee is not set. Ask admin to configure it first.', true)
      return
    }
    setSaving(true)
    try {
      const receipt = confirmObstetricDeliveryPayment(payTarget.id, user?.id ?? 'staff-002')
      if (!receipt) {
        flash('Payment could not be collected.', true)
        return
      }
      await persist(payTarget.id, 'Payment collected.')
      setShowPayModal(false)
      setPayTarget(null)
      setPrintReceipt(receipt)
      setShowPrintModal(true)
    } finally {
      setSaving(false)
    }
  }

  const handleReprint = (row: ObstetricDelivery) => {
    const receipt = getObstetricReceiptByDeliveryId(row.id)
    if (!receipt) {
      flash('Receipt not found for this registration.', true)
      return
    }
    setPrintReceipt(receipt)
    setShowPrintModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      if (!deleteObstetricDelivery(deleteTarget.id)) {
        flash('Cannot delete — record may already be paid.', true)
        return
      }
      await persist(undefined, 'Registration deleted.')
      setShowDeleteModal(false)
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Obstetric / Delivery Registration" />
      <PageHeader
        title="Obstetric / Delivery Registration"
        subtitle="Register mothers who have delivered and collect the obstetrician fee"
        breadcrumbs={[
          { label: 'Reception Dashboard', href: '/hms/reception/dashboard' },
          { label: 'Obstetric Registration' },
        ]}
        actionLabel="New registration"
        onAction={openCreate}
      />

      {message && <Alert variant="success" className="py-2">{message}</Alert>}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      {obstetricFee <= 0 && (
        <Alert variant="warning" className="py-2">
          Obstetrician fee is not configured. Admin must set the fee under{' '}
          <strong>Obstetrician Fee</strong> before payments can be collected.
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                <IconifyIcon icon="solar:wallet-money-broken" className="text-primary fs-24" />
              </div>
              <div>
                <p className="text-muted mb-0 small">Obstetrician fee</p>
                <h4 className="mb-0">
                  {currency}
                  {obstetricFee.toLocaleString()}
                </h4>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-warning bg-opacity-10 p-3">
                <IconifyIcon icon="solar:clock-circle-broken" className="text-warning fs-24" />
              </div>
              <div>
                <p className="text-muted mb-0 small">Pending payment</p>
                <h4 className="mb-0">{pendingCount}</h4>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-success bg-opacity-10 p-3">
                <IconifyIcon icon="solar:check-circle-broken" className="text-success fs-24" />
              </div>
              <div>
                <p className="text-muted mb-0 small">Paid registrations</p>
                <h4 className="mb-0">{paidCount}</h4>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <Row className="g-2 mb-3">
            <Col md={6}>
              <Form.Control
                placeholder="Search name, phone, reg #, doctor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={babyGenderFilter}
                onChange={(e) =>
                  setBabyGenderFilter(e.target.value as typeof babyGenderFilter)
                }>
                <option value="all">All babies</option>
                <option value="Female">Baby Female</option>
                <option value="Male">Baby Male</option>
              </Form.Select>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Reg #</th>
                  <th>Mother</th>
                  <th>Age</th>
                  <th>Phone</th>
                  <th>Baby</th>
                  <th>Doctor</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No delivery registrations yet. Click &quot;New registration&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  pagination.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td className="fw-medium">{row.registrationNumber}</td>
                      <td>{row.motherFullName}</td>
                      <td>{row.motherAge}</td>
                      <td>{row.motherPhone}</td>
                      <td>
                        <Badge bg={row.childGender === 'Male' ? 'primary' : 'info'}>
                          {row.childGender}
                        </Badge>
                      </td>
                      <td>{getDoctorLabel(row.doctorId)}</td>
                      <td>
                        {currency}
                        {(row.obstetricianFee || obstetricFee).toLocaleString()}
                      </td>
                      <td>
                        <Badge bg={row.status === 'Paid' ? 'success' : 'warning'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1 flex-wrap">
                          {row.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => openEdit(row)}
                                disabled={saving}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => {
                                  setPayTarget(row)
                                  setShowPayModal(true)
                                }}
                                disabled={saving || obstetricFee <= 0}>
                                Collect &amp; Print
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => {
                                  setDeleteTarget(row)
                                  setShowDeleteModal(true)
                                }}
                                disabled={saving}>
                                Delete
                              </Button>
                            </>
                          )}
                          {row.status === 'Paid' && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleReprint(row)}>
                              <IconifyIcon icon="solar:printer-broken" className="me-1" />
                              Reprint
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            safePage={pagination.safePage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
          />
        </CardBody>
      </Card>

      <Modal show={showFormModal} onHide={() => setShowFormModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? 'Edit delivery registration' : 'New delivery registration'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => void handleFormSubmit(e)}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Mother full name *</Form.Label>
                  <Form.Control
                    value={form.motherFullName}
                    onChange={(e) => setForm((f) => ({ ...f, motherFullName: e.target.value }))}
                    required
                    placeholder="Full name"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Age *</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={120}
                    value={form.motherAge}
                    onChange={(e) => setForm((f) => ({ ...f, motherAge: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Phone *</Form.Label>
                  <Form.Control
                    value={form.motherPhone}
                    onChange={(e) => setForm((f) => ({ ...f, motherPhone: e.target.value }))}
                    required
                    placeholder="+252…"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Baby gender *</Form.Label>
                  <Form.Select
                    value={form.childGender}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        childGender: e.target.value as ObstetricChildGender,
                      }))
                    }>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Delivering doctor (Obstetrician) *</Form.Label>
                  <Form.Select
                    value={form.doctorId}
                    onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
                    required>
                    <option value="">Choose doctor…</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName}
                      </option>
                    ))}
                  </Form.Select>
                  {doctors.length === 0 && (
                    <Form.Text className="text-danger">
                      No active doctors. Add doctor users in admin first.
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              {!editingId && (
                <Col xs={12}>
                  <Form.Check
                    type="checkbox"
                    id="collect-on-save"
                    label={`Collect payment now (${currency}${obstetricFee.toLocaleString()}) and print receipt`}
                    checked={collectOnSave}
                    onChange={(e) => setCollectOnSave(e.target.checked)}
                  />
                </Col>
              )}
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowFormModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={saving || doctors.length === 0}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : collectOnSave ? 'Save & collect' : 'Save registration'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showPayModal} onHide={() => setShowPayModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Collect obstetrician fee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {payTarget && (
            <>
              <p className="mb-1">
                <strong>{payTarget.motherFullName}</strong> — {payTarget.registrationNumber}
              </p>
              <p className="text-muted mb-2">
                Doctor: {getDoctorLabel(payTarget.doctorId)} · Baby: {payTarget.childGender}
              </p>
              <p className="fs-5 mb-0">
                Amount:{' '}
                <strong>
                  {currency}
                  {(payTarget.obstetricianFee || obstetricFee).toLocaleString()}
                </strong>
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowPayModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => void handleCollectPayment()} disabled={saving}>
            {saving ? 'Processing…' : 'Confirm payment & print'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete registration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete registration for <strong>{deleteTarget?.motherFullName}</strong>? This cannot be
          undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDeleteModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        size="sm"
        centered
        className="thermal-print-modal">
        <Modal.Header closeButton>
          <Modal.Title>Obstetrician receipt</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2">{printReceipt && <PrintableReceipt receipt={printReceipt} />}</Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowPrintModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <IconifyIcon icon="solar:printer-broken" className="me-1" />
            Print
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default ReceptionObstetricPage
