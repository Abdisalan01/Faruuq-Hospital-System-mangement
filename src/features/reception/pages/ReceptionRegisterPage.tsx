import { useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Modal, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import PatientRegistrationSlip, {
  type PatientRegistrationSlipData,
} from '@/features/reception/components/PatientRegistrationSlip'
import AutoPatientNumberDisplay from '@/features/reception/components/AutoPatientNumberDisplay'
import {
  clampDiscountPercent,
  departments,
  generateId,
  generateNumber,
  getAutoPatientNumberForStaff,
  getMaxDiscountPercent,
  getNextEmergencyNumber,
  getNextPatientNumberForDoctor,
  getStaffById,
  getStaffByRole,
  getStaffRegistrationFee,
  patients,
  persistPatientsNowAsync,
  recordRegistrationPayment,
  visits,
} from '@/shared/services/hmsStore'
import { todayIsoLocal } from '@/shared/utils/dateUtils'
import { discountAmountFromPercent } from '@/shared/utils/discountLimits'
import { onNewVisitCreated } from '@/shared/utils/visitConsultation'

const parseDiscountPercent = (raw: string) => {
  const n = parseFloat(raw.replace(/,/g, '').replace(/%/g, '').trim())
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 100)
}

const ReceptionRegisterPage = () => {
  const { user } = useAuthContext()
  const userRole = user?.role ?? 'reception_cashier'
  const maxRegistrationDiscount = getMaxDiscountPercent(userRole, 'registration')
  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'registration', parseDiscountPercent(raw))
  const doctors = getStaffByRole('doctor').filter((s) => s.isActive)
  const emergencyStaff = getStaffByRole('emergency').filter((s) => s.isActive)
  const defaultReferralId = doctors[0]?.id ?? emergencyStaff[0]?.id ?? ''

  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female'>('Male')
  const [age, setAge] = useState<number | ''>('')
  const [phone, setPhone] = useState('')
  const [referredStaffId, setReferredStaffId] = useState(defaultReferralId)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [slipData, setSlipData] = useState<PatientRegistrationSlipData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [canPrintSlip, setCanPrintSlip] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedStaff = referredStaffId ? getStaffById(referredStaffId) : undefined
  const isEmergency = selectedStaff?.role === 'emergency'

  const registrationFee = referredStaffId ? getStaffRegistrationFee(referredStaffId) : 0
  const discountPercent = appliedDiscountPercent(discountInput)
  const discountAmount = discountAmountFromPercent(registrationFee, discountPercent)
  const totalDue = Math.max(0, registrationFee - discountAmount)

  const nextNumberPreview = useMemo(() => {
    if (!referredStaffId) return null
    if (isEmergency) return getNextEmergencyNumber()
    return getNextPatientNumberForDoctor(referredStaffId)
  }, [referredStaffId, isEmergency])

  const referredDisplayName = useMemo(() => {
    if (!selectedStaff) return '—'
    if (isEmergency) return 'Emergency'
    return `Dr. ${selectedStaff.firstName} ${selectedStaff.lastName}`
  }, [selectedStaff, isEmergency])

  const resetForm = () => {
    setFullName('')
    setAge('')
    setPhone('')
    setGender('Male')
    setDiscountInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCanPrintSlip(false)
    if (!fullName.trim() || !phone.trim() || age === '' || !referredStaffId) {
      setError('Full Name, Age, Phone, and Referred Doctor are required.')
      return
    }

    const staff = getStaffById(referredStaffId)
    if (!staff) {
      setError('Invalid doctor selection.')
      return
    }

    setSaving(true)
    try {
      const emergency = staff.role === 'emergency'
      const patientId = generateId('pat')
      const patientNumber = getAutoPatientNumberForStaff(referredStaffId)
      const fee = getStaffRegistrationFee(referredStaffId)
      const finalPercent = appliedDiscountPercent(discountInput)
      const finalDiscount = discountAmountFromPercent(fee, finalPercent)
      const finalTotal = Math.max(0, fee - finalDiscount)
      const emergencyDept = departments.find((d) => d.name === 'Emergency')?.id ?? 'dept-003'
      const departmentId = emergency ? emergencyDept : staff.departmentId ?? departments[0]?.id ?? 'dept-001'
      const doctorName = emergency ? 'Emergency' : `Dr. ${staff.firstName} ${staff.lastName}`
      const visitDate = todayIsoLocal()

      patients.push({
        id: patientId,
        fullName: fullName.trim(),
        gender,
        age: Number(age),
        phone: phone.trim(),
        address: '—',
        paymentType: 'cash',
        status: 'Active',
        createdAt: visitDate,
      })

      const visitId = generateId('vis')
      const createdAt = new Date().toISOString()
      visits.push({
        id: visitId,
        visitNumber: generateNumber('V'),
        patientId,
        visitDate,
        assignedDoctorId: referredStaffId,
        departmentId,
        status: 'Waiting',
        queueNumber: patientNumber,
        patientNumber,
        isEmergency: emergency,
        createdAt,
        lastModifiedAt: createdAt,
      })

      onNewVisitCreated(patientId)

      if (finalTotal > 0) {
        recordRegistrationPayment({
          patientId,
          visitId,
          amount: finalTotal,
          receivedBy: user?.id ?? 'staff-002',
          doctorId: referredStaffId,
          doctorName: doctorName,
          patientNumber,
          isEmergency: emergency,
          subtotal: fee,
          discountPercent: finalPercent > 0 ? finalPercent : undefined,
          discountAmount: finalDiscount,
        })
      }

      try {
        await persistPatientsNowAsync()
      } catch {
        setError('Patient registered locally but failed to save to database. Please try again.')
        return
      }

      const slip: PatientRegistrationSlipData = {
        patientId,
        patientNumber,
        isEmergency: emergency,
        fullName: fullName.trim(),
        gender,
        age: Number(age),
        phone: phone.trim(),
        referredDoctorName: doctorName,
        registrationFee: finalTotal,
        createdAt: new Date().toISOString(),
      }
      setSlipData(slip)
      setCanPrintSlip(true)
      setShowPrintModal(true)
      const numLabel = emergency ? 'Emergency Number' : 'Patient Number'
      setSuccess(`Patient registered — ${numLabel} #${patientNumber}.`)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title="Register Patient" />
      <PageHeader
        title="Register Patient"
        subtitle="Doctors & Emergency — registration fee from admin"
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: 'Register Patient' },
        ]}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <CardBody>
          <Form onSubmit={(e) => void handleSubmit(e)}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter patient's full name"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +252-61-1234567"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Age</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={150}
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter age"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Referred Doctor</Form.Label>
                  <Form.Select
                    value={referredStaffId}
                    onChange={(e) => {
                      setReferredStaffId(e.target.value)
                      setDiscountInput('')
                    }}
                    required
                  >
                    <option value="">Select...</option>
                    {doctors.length > 0 && (
                      <optgroup label="Doctors">
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            Dr. {d.firstName} {d.lastName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {emergencyStaff.length > 0 && (
                      <optgroup label="Emergency">
                        {emergencyStaff.map((d) => (
                          <option key={d.id} value={d.id}>
                            Emergency
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Form.Select>
                  {referredStaffId && (
                    <div className="mt-2 p-2 bg-light rounded small">
                      <div>
                        <strong>Registration Fee:</strong> {currency}
                        {registrationFee.toLocaleString()}
                      </div>
                      <div className="mt-1 text-muted">Assigned: {referredDisplayName}</div>
                    </div>
                  )}
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label className="d-block mb-2">Gender</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    {(['Male', 'Female'] as const).map((g) => (
                      <Form.Check
                        key={g}
                        type="radio"
                        id={`gender-${g}`}
                        name="gender"
                        label={g}
                        checked={gender === g}
                        onChange={() => setGender(g)}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>
              {referredStaffId && (
                <AutoPatientNumberDisplay
                  number={nextNumberPreview}
                  isEmergency={isEmergency}
                  doctorName={referredDisplayName}
                />
              )}
              {referredStaffId && registrationFee > 0 && (
                <>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Discount (%) — optional</Form.Label>
                      <div className="input-group">
                        <Form.Control
                          type="number"
                          min={0}
                          max={maxRegistrationDiscount}
                          step={0.01}
                          placeholder="0"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                        />
                        <span className="input-group-text">%</span>
                      </div>
                      <Form.Text className="text-muted">
                        Maximum allowed: <strong>{maxRegistrationDiscount}%</strong>
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3 p-3 bg-primary bg-opacity-10 rounded border border-primary border-opacity-25">
                      <div className="d-flex justify-content-between small">
                        <span>Subtotal</span>
                        <span>
                          {currency}
                          {registrationFee.toLocaleString()}
                        </span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="d-flex justify-content-between small text-success">
                          <span>Discount ({discountPercent}%)</span>
                          <span>
                            −{currency}
                            {discountAmount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between fw-semibold mt-2 pt-2 border-top">
                        <span>Total due</span>
                        <span>
                          {currency}
                          {totalDue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Col>
                </>
              )}
            </Row>
            <div className="d-flex flex-wrap gap-2">
              <Button type="submit" variant="success" size="lg" disabled={!referredStaffId || saving}>
                <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                {saving ? 'Saving…' : 'Submit'}
              </Button>
              {canPrintSlip && slipData && (
                <Button
                  type="button"
                  variant="outline-primary"
                  size="lg"
                  onClick={() => setShowPrintModal(true)}
                >
                  <IconifyIcon icon="solar:printer-broken" className="me-1" />
                  Print Slip
                </Button>
              )}
              <Link to="/hms/patients" className="btn btn-light btn-lg">
                Cancel
              </Link>
            </div>
          </Form>
        </CardBody>
      </Card>

      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        centered
        className="thermal-print-modal"
        dialogClassName="thermal-print-dialog"
      >
        <Modal.Header closeButton className="no-print">
          <Modal.Title>Print — 80mm Thermal Paper</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex justify-content-center p-0 bg-white">
          {slipData && <PatientRegistrationSlip data={slipData} />}
        </Modal.Body>
        <Modal.Footer className="no-print">
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

export default ReceptionRegisterPage
