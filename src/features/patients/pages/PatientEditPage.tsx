import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Modal, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PatientRegistrationSlip, {
  type PatientRegistrationSlipData,
} from '@/features/reception/components/PatientRegistrationSlip'
import AutoPatientNumberDisplay from '@/features/reception/components/AutoPatientNumberDisplay'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  clampDiscountPercent,
  departments,
  generateId,
  generateNumber,
  getAutoPatientNumberForStaff,
  getDisplayVisitForPatient,
  getLatestOpenVisitForPatient,
  getMaxDiscountPercent,
  getNextEmergencyNumber,
  getNextPatientNumberForDoctor,
  getPatientById,
  getStaffById,
  getStaffByRole,
  getStaffRegistrationFee,
  persistPatientProfileNowAsync,
  persistPatientsNowAsync,
  receptionReceipts,
  recordRegistrationPayment,
  updatePatientRecord,
  visits,
} from '@/shared/services/hmsStore'
import { todayIsoLocal } from '@/shared/utils/dateUtils'
import { discountAmountFromPercent } from '@/shared/utils/discountLimits'
import {
  FOLLOW_UP_ACTIVATION_DAYS,
  getFollowUpActivationInfo,
  getPatientCareDisplayStatusFromPatient,
  onNewVisitCreated,
  touchVisit,
} from '@/shared/utils/visitConsultation'

type ReturnMode = 'update' | 'new_number'

const parseDiscountPercent = (raw: string) => {
  const n = parseFloat(raw.replace(/,/g, '').replace(/%/g, '').trim())
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 100)
}

function getRegistrationDiscountForVisit(visitId?: string): string {
  if (!visitId) return ''
  const receipt = [...receptionReceipts]
    .filter((r) => r.visitId === visitId && r.type === 'registration')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return receipt?.discountPercent ? String(receipt.discountPercent) : ''
}

const PatientEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { dataVersion, isReady } = useHmsStoreContext()
  void dataVersion

  const patient = id ? getPatientById(id) : undefined
  const latestVisit = patient ? getDisplayVisitForPatient(patient.id) : undefined

  const doctors = getStaffByRole('doctor').filter((s) => s.isActive)
  const emergencyStaff = getStaffByRole('emergency').filter((s) => s.isActive)

  const userRole = user?.role ?? 'reception_cashier'
  const maxRegistrationDiscount = getMaxDiscountPercent(userRole, 'registration')
  const appliedDiscountPercent = (raw: string) =>
    clampDiscountPercent(userRole, 'registration', parseDiscountPercent(raw))

  const [returnMode, setReturnMode] = useState<ReturnMode>('update')
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female'>('Male')
  const [age, setAge] = useState<number | ''>('')
  const [phone, setPhone] = useState('')
  const [referredStaffId, setReferredStaffId] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const hydratedFor = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [slipData, setSlipData] = useState<PatientRegistrationSlipData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [canPrintSlip, setCanPrintSlip] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    hydratedFor.current = null
  }, [id])

  useEffect(() => {
    if (!patient || saving) return
    const key = `${patient.id}:${dataVersion}`
    if (hydratedFor.current === key) return

    const visit = getDisplayVisitForPatient(patient.id)
    setFullName(patient.fullName)
    setGender(patient.gender === 'Female' ? 'Female' : 'Male')
    setAge(patient.age)
    setPhone(patient.phone)
    setReferredStaffId(
      visit?.assignedDoctorId ?? doctors[0]?.id ?? emergencyStaff[0]?.id ?? '',
    )
    setDiscountInput(getRegistrationDiscountForVisit(visit?.id))
    if (getPatientCareDisplayStatusFromPatient(patient) === 'Inactive') {
      setReturnMode('new_number')
    }
    hydratedFor.current = key
  }, [patient, dataVersion, saving, doctors, emergencyStaff])

  const selectedStaff = referredStaffId ? getStaffById(referredStaffId) : undefined
  const isEmergency = selectedStaff?.role === 'emergency'
  const numberLabel = isEmergency ? 'Emergency Number' : 'Patient Number'
  const registrationFee = referredStaffId ? getStaffRegistrationFee(referredStaffId) : 0
  const discountPercent = appliedDiscountPercent(discountInput)
  const discountAmount = discountAmountFromPercent(registrationFee, discountPercent)
  const totalDue = Math.max(0, registrationFee - discountAmount)

  const nextAvailable = useMemo(() => {
    if (!referredStaffId || returnMode !== 'new_number') return null
    return isEmergency ? getNextEmergencyNumber() : getNextPatientNumberForDoctor(referredStaffId)
  }, [referredStaffId, isEmergency, returnMode, dataVersion])

  const referredDisplayName = useMemo(() => {
    if (!selectedStaff) return '—'
    if (isEmergency) return 'Emergency'
    return `Dr. ${selectedStaff.firstName} ${selectedStaff.lastName}`
  }, [selectedStaff, isEmergency])

  const lastNumberLabel = useMemo(() => {
    if (!latestVisit) return null
    const n = latestVisit.patientNumber ?? latestVisit.queueNumber
    const label = latestVisit.isEmergency ? 'Emergency' : 'Patient'
    return `${label} #${n} · ${latestVisit.visitDate}`
  }, [latestVisit])

  const followUpInfo = useMemo(
    () => (patient ? getFollowUpActivationInfo(patient.id) : null),
    [patient, dataVersion],
  )

  if (!isReady) {
    return (
      <PermissionGuard permissions={['register_patients']}>
        <PageMetaData title="Edit Patient" />
        <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
          <p className="text-muted mb-0 small">Loading patient data…</p>
        </div>
      </PermissionGuard>
    )
  }

  if (!patient) {
    return (
      <PermissionGuard permissions={['register_patients']}>
        <PageMetaData title="Patient Not Found" />
        <div className="alert alert-warning">Patient not found.</div>
        <Link to="/hms/patients">Back to Patients</Link>
      </PermissionGuard>
    )
  }

  const savePatientFields = () =>
    updatePatientRecord(patient.id, {
      fullName: fullName.trim(),
      gender,
      age: Number(age),
      phone: phone.trim(),
      address: patient.address?.trim() || '—',
    })

  const handleUpdateOnly = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!fullName.trim() || !phone.trim() || age === '') {
      setError('Full Name, Age, and Phone are required.')
      return
    }
    if (!referredStaffId) {
      setError('Select a referred doctor.')
      return
    }

    const staff = getStaffById(referredStaffId)
    if (!staff) {
      setError('Invalid doctor selection.')
      return
    }

    const updated = savePatientFields()
    if (!updated) {
      setError('Patient not found.')
      return
    }

    const openVisit = getLatestOpenVisitForPatient(patient.id)
    const doctorChanged =
      openVisit && openVisit.assignedDoctorId !== referredStaffId

    if (!openVisit && latestVisit && latestVisit.assignedDoctorId !== referredStaffId) {
      setError(
        'Patient has no active visit — use Activate Patient or Assign a new patient number to change referred doctor.',
      )
      return
    }

    if (openVisit) {
      const emergency = staff.role === 'emergency'
      const emergencyDept = departments.find((d) => d.name === 'Emergency')?.id ?? 'dept-003'
      openVisit.assignedDoctorId = referredStaffId
      openVisit.departmentId = emergency
        ? emergencyDept
        : staff.departmentId ?? departments[0]?.id ?? 'dept-001'
      openVisit.isEmergency = emergency
      if (doctorChanged) touchVisit(openVisit)
    }

    setSaving(true)
    try {
      if (openVisit) {
        await persistPatientsNowAsync()
      } else {
        await persistPatientProfileNowAsync(patient.id)
      }
      hydratedFor.current = null
      const doctorNote = doctorChanged ? ' Referred doctor updated.' : ''
      setSuccess(`Patient record updated successfully.${doctorNote} Saved to database.`)
      setTimeout(() => navigate('/hms/patients'), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes to database.')
    } finally {
      setSaving(false)
    }
  }

  const handleNewNumberToday = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCanPrintSlip(false)
    if (!fullName.trim() || !phone.trim() || age === '') {
      setError('Full Name, Age, and Phone are required.')
      return
    }
    if (!referredStaffId) {
      setError('Select a referred doctor for a new number today.')
      return
    }

    const staff = getStaffById(referredStaffId)
    if (!staff) {
      setError('Invalid doctor selection.')
      return
    }

    const emergency = staff.role === 'emergency'
    const doctorName = emergency ? 'Emergency' : `Dr. ${staff.firstName} ${staff.lastName}`
    const visitDate = todayIsoLocal()

    const openVisitSameDoctorToday = visits.find(
      (v) =>
        v.patientId === patient.id &&
        v.assignedDoctorId === referredStaffId &&
        v.visitDate === visitDate &&
        !['Completed', 'Cancelled'].includes(v.status),
    )
    if (openVisitSameDoctorToday) {
      setError(
        `This patient already has an active visit with ${doctorName} today. Choose a different doctor, or complete that visit first.`,
      )
      return
    }

    const num = getAutoPatientNumberForStaff(referredStaffId)
    const fee = getStaffRegistrationFee(referredStaffId)
    const finalPercent = appliedDiscountPercent(discountInput)
    const finalDiscount = discountAmountFromPercent(fee, finalPercent)
    const finalTotal = Math.max(0, fee - finalDiscount)
    const emergencyDept = departments.find((d) => d.name === 'Emergency')?.id ?? 'dept-003'
    const departmentId = emergency ? emergencyDept : staff.departmentId ?? departments[0]?.id ?? 'dept-001'
    const now = new Date().toISOString()

    savePatientFields()

    const visitId = generateId('vis')
    visits.push({
      id: visitId,
      visitNumber: generateNumber('V'),
      patientId: patient.id,
      visitDate,
      assignedDoctorId: referredStaffId,
      departmentId,
      status: 'Waiting',
      queueNumber: num,
      patientNumber: num,
      isEmergency: emergency,
      createdAt: now,
      lastModifiedAt: now,
    })

    onNewVisitCreated(patient.id)

    if (finalTotal > 0) {
      recordRegistrationPayment({
        patientId: patient.id,
        visitId,
        amount: finalTotal,
        receivedBy: user?.id ?? 'staff-002',
        doctorId: referredStaffId,
        doctorName,
        patientNumber: num,
        isEmergency: emergency,
        subtotal: fee,
        discountPercent: finalPercent > 0 ? finalPercent : undefined,
        discountAmount: finalDiscount,
      })
    }

    setSaving(true)
    try {
      await persistPatientsNowAsync()
      setSlipData({
        patientId: patient.id,
        patientNumber: num,
        isEmergency: emergency,
        fullName: patient.fullName,
        gender: patient.gender,
        age: patient.age,
        phone: patient.phone,
        referredDoctorName: doctorName,
        registrationFee: finalTotal,
        createdAt: now,
      })
      setCanPrintSlip(true)
      setShowPrintModal(true)
      setSuccess(`New number #${num} assigned. Patient ID ${patient.id} unchanged.`)
    } catch {
      setError('Visit created locally but failed to save to database. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    if (returnMode === 'update') void handleUpdateOnly(e)
    else void handleNewNumberToday(e)
  }

  const openVisitForEdit = getLatestOpenVisitForPatient(patient.id)
  const doctorFieldDisabled = returnMode === 'update' && !openVisitForEdit
  const discountFieldDisabled = returnMode === 'update'

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title={`Edit Patient: ${patient.fullName}`} />
      <PageHeader
        title="Edit Patient"
        subtitle="Update patient details or assign a new queue number for today"
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: 'All Patients', href: '/hms/patients' },
          { label: patient.fullName, href: `/hms/patients/${patient.id}` },
          { label: 'Edit' },
        ]}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="mb-3 border-0 shadow-sm">
        <CardBody className="py-3">
          <Row className="g-3 align-items-center">
            <Col md={3} sm={6}>
              <span className="text-muted small d-block">Patient ID</span>
              <span className="fw-semibold">{patient.id}</span>
            </Col>
            <Col md={3} sm={6}>
              <span className="text-muted small d-block">Registered</span>
              <span className="fw-semibold">{patient.createdAt.split('T')[0]}</span>
            </Col>
            <Col md={3} sm={6}>
              <span className="text-muted small d-block">Current Doctor</span>
              <span className="fw-semibold">{referredDisplayName}</span>
            </Col>
            <Col md={3} sm={6}>
              <span className="text-muted small d-block">Last Number</span>
              <span className="fw-semibold">{lastNumberLabel ?? '—'}</span>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {followUpInfo?.eligible && (
        <Alert variant="success" className="py-2 mb-3">
          Follow-up within {FOLLOW_UP_ACTIVATION_DAYS} days ({followUpInfo.daysRemaining} days left). Use{' '}
          <Link to="/hms/reception/activate-patient">Activate Patient</Link> — same number, no registration
          fee. Use <strong>New patient number</strong> below only after {FOLLOW_UP_ACTIVATION_DAYS} days or
          for a new registration.
        </Alert>
      )}
      {followUpInfo && !followUpInfo.eligible && getPatientCareDisplayStatusFromPatient(patient) === 'Inactive' && (
        <Alert variant="warning" className="py-2 mb-3">
          {followUpInfo.error?.includes('expired')
            ? `Follow-up window ended — assign a new ${numberLabel.toLowerCase()} below.`
            : followUpInfo.error}
        </Alert>
      )}

      <Card className="mb-3 border-primary border-opacity-25">
        <CardBody className="py-3">
          <div className="d-flex flex-wrap gap-2">
            <Button
              type="button"
              variant={returnMode === 'update' ? 'primary' : 'outline-primary'}
              onClick={() => {
                setReturnMode('update')
                setCanPrintSlip(false)
                setSuccess('')
              }}
            >
              <IconifyIcon icon="solar:pen-broken" className="me-1" />
              Update existing record
            </Button>
            <Button
              type="button"
              variant={returnMode === 'new_number' ? 'success' : 'outline-success'}
              onClick={() => {
                setReturnMode('new_number')
                setCanPrintSlip(false)
                setSuccess('')
                setDiscountInput('')
              }}
            >
              <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
              Assign a new patient number
            </Button>
          </div>
          <p className="text-muted small mb-0 mt-2">
            {returnMode === 'update'
              ? openVisitForEdit
                ? 'Update name, phone, age, gender, and referred doctor for the active visit — same patient number.'
                : 'Update name, phone, age, and gender. To change doctor use Activate Patient or Assign a new patient number.'
              : `Returning patient: assign a new ${numberLabel.toLowerCase()} — Patient ID ${patient.id} stays the same, status becomes Waiting for the doctor.`}
          </p>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardBody>
          <Form onSubmit={handleSubmit}>
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
                      if (returnMode === 'new_number') setDiscountInput('')
                    }}
                    required
                    disabled={doctorFieldDisabled}
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
                  {doctorFieldDisabled && (
                    <Form.Text className="text-muted">
                      Patient released — use <strong>Activate Patient</strong> or{' '}
                      <strong>Assign a new patient number</strong> to change doctor.
                    </Form.Text>
                  )}
                  {returnMode === 'update' && openVisitForEdit && (
                    <Form.Text className="text-muted">
                      Change referred doctor — patient stays in the new doctor&apos;s queue with the same number.
                    </Form.Text>
                  )}
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
                        id={`edit-gender-${g}`}
                        name="gender"
                        label={g}
                        checked={gender === g}
                        onChange={() => setGender(g)}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>

              {returnMode === 'new_number' && referredStaffId && (
                <AutoPatientNumberDisplay
                  number={nextAvailable}
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
                          disabled={discountFieldDisabled}
                        />
                        <span className="input-group-text">%</span>
                      </div>
                      {discountFieldDisabled ? (
                        <Form.Text className="text-muted">
                          Last registration discount shown. Use <strong>New Number Today</strong> to apply a new discount.
                        </Form.Text>
                      ) : (
                        <Form.Text className="text-muted">
                          Maximum allowed: <strong>{maxRegistrationDiscount}%</strong>
                        </Form.Text>
                      )}
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
                        <span>{returnMode === 'update' ? 'Last paid' : 'Total due'}</span>
                        <span>
                          {currency}
                          {(returnMode === 'update'
                            ? Math.max(0, registrationFee - discountAmount)
                            : totalDue
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Col>
                </>
              )}
            </Row>

            <div className="d-flex flex-wrap gap-2 pt-1">
              {returnMode === 'update' ? (
                <Button type="submit" variant="primary" size="lg" disabled={saving}>
                  <IconifyIcon icon="solar:diskette-broken" className="me-1" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              ) : (
                <>
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
                </>
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
          <Link to="/hms/patients" className="btn btn-outline-secondary">
            Back to Patients
          </Link>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default PatientEditPage
