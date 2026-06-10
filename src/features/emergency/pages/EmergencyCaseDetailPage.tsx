import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageMetaData from '@/components/PageTitle'
import { Alert, Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import LabTestSelect from '@/shared/components/LabTestPicker'
import StatusBadge from '@/shared/components/StatusBadge'
import type { EmergencyOutcome, LabRequest, Prescription } from '@/shared/types'
import {
  calculateLabRequestSubtotal,
  emergencyCases,
  generateId,
  generateNumber,
  getPatientById,
  labRequests,
  prescriptions,
  persistDoctorConsultationNowAsync,
  persistEmergencyCaseNowAsync,
} from '@/shared/services/hmsStore'

const EmergencyCaseDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const clinicianId = user?.id ?? 'staff-007'
  const [, setRefresh] = useState(0)

  const emgCase = emergencyCases.find((c) => c.id === id)
  const patient = emgCase ? getPatientById(emgCase.patientId) : undefined

  const [triageNotes, setTriageNotes] = useState(emgCase?.triageNotes ?? '')
  const [diagnosis, setDiagnosis] = useState(emgCase?.diagnosis ?? '')
  const [prescriptionForm, setPrescriptionForm] = useState({ medicine: '', dosage: '', frequency: 'Twice daily' })
  const [labTest, setLabTest] = useState('')

  if (!emgCase || !patient) {
    return (
      <>
        <PageMetaData title="Case Not Found" />
        <Alert variant="danger">Emergency case not found.</Alert>
      </>
    )
  }

  const casePrescriptions = prescriptions.filter((p) => p.visitId === `emg-${emgCase.id}`)
  const caseLabRequests = labRequests.filter((l) => l.visitId === `emg-${emgCase.id}`)

  const saveEmergency = async () => {
    if (isSupabase) await persistEmergencyCaseNowAsync()
    setRefresh((n) => n + 1)
  }

  const saveClinical = async () => {
    if (isSupabase) {
      await persistDoctorConsultationNowAsync({ patientId: emgCase.patientId })
    }
    setRefresh((n) => n + 1)
  }

  const handleSaveTriage = () => {
    emgCase.triageNotes = triageNotes.trim()
    void saveEmergency()
  }

  const handleSaveDiagnosis = () => {
    emgCase.diagnosis = diagnosis.trim()
    void saveEmergency()
  }

  const handleAddPrescription = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prescriptionForm.medicine.trim()) return

    const rx: Prescription = {
      id: generateId('rx'),
      visitId: `emg-${emgCase.id}`,
      patientId: emgCase.patientId,
      doctorId: clinicianId,
      items: [
        {
          medicine: prescriptionForm.medicine.trim(),
          dosage: prescriptionForm.dosage.trim() || '500mg',
          frequency: prescriptionForm.frequency,
          duration: '7 days',
          instructions: 'Take as directed',
        },
      ],
      status: 'Pending',
      createdAt: new Date().toISOString(),
    }
    prescriptions.push(rx)
    setPrescriptionForm({ medicine: '', dosage: '', frequency: 'Twice daily' })
    void saveClinical()
  }

  const handleAddLabRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!labTest.trim()) return

    const tests = [{ testName: labTest.trim() }]
    const lab: LabRequest = {
      id: generateId('lab'),
      requestNumber: generateNumber('LR'),
      visitId: `emg-${emgCase.id}`,
      patientId: emgCase.patientId,
      doctorId: clinicianId,
      tests,
      status: 'Awaiting Payment',
      totalFee: calculateLabRequestSubtotal(tests),
      createdAt: new Date().toISOString(),
    }
    labRequests.push(lab)
    setLabTest('Complete Blood Count')
    void saveClinical()
  }

  const handleOutcome = (outcome: EmergencyOutcome) => {
    emgCase.outcome = outcome
    emgCase.status = 'Completed'
    void saveEmergency().then(() => navigate('/hms/emergency/cases'))
  }

  return (
    <PermissionGuard permissions={['emergency_treatment', 'triage']}>
      <PageMetaData title={`Emergency - ${emgCase.emgNumber}`} />
      <PageHeader
        title={emgCase.emgNumber}
        subtitle={`Patient: ${patient.fullName}`}
        breadcrumbs={[
          { label: 'Emergency', href: '/hms/emergency/dashboard' },
          { label: 'Cases', href: '/hms/emergency/cases' },
          { label: emgCase.emgNumber },
        ]}
      >
        <Link to={`/hms/emergency/cases/${emgCase.id}/edit`} className="btn btn-soft-secondary">
          <IconifyIcon icon="bx:edit" className="me-1" />
          Edit
        </Link>
      </PageHeader>

      <Row>
        <Col lg={4}>
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Case Details</h5>
              <p className="mb-1">
                <strong>Patient:</strong> {patient.fullName}
              </p>
              <p className="mb-1">
                <strong>Age/Gender:</strong> {patient.age} / {patient.gender}
              </p>
              <p className="mb-1">
                <strong>Phone:</strong> {patient.phone}
              </p>
              <p className="mb-1">
                <strong>Arrival:</strong> {new Date(emgCase.arrivalTime).toLocaleString()}
              </p>
              <p className="mb-1">
                <strong>Severity:</strong> <StatusBadge status={emgCase.severity} />
              </p>
              <p className="mb-0">
                <strong>Status:</strong> <StatusBadge status={emgCase.status} />
              </p>
            </CardBody>
          </Card>

          {emgCase.status === 'Active' && (
            <Card>
              <CardBody>
                <h5 className="mb-3">Outcome</h5>
                <div className="d-grid gap-2">
                  <Button variant="success" onClick={() => handleOutcome('Discharge')}>
                    <IconifyIcon icon="solar:logout-2-broken" className="me-1" />
                    Discharge
                  </Button>
                  <Button variant="primary" onClick={() => handleOutcome('Admit')}>
                    <IconifyIcon icon="solar:bed-broken" className="me-1" />
                    Admit to Ward
                  </Button>
                  <Button variant="warning" onClick={() => handleOutcome('Transfer')}>
                    <IconifyIcon icon="solar:transfer-horizontal-broken" className="me-1" />
                    Transfer
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </Col>

        <Col lg={8}>
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Triage Notes</h5>
              <Form.Group className="mb-2">
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Initial assessment, vitals, chief complaint..."
                  disabled={emgCase.status === 'Completed'}
                />
              </Form.Group>
              {emgCase.status === 'Active' && (
                <Button variant="primary" size="sm" onClick={handleSaveTriage}>
                  Save Triage Notes
                </Button>
              )}
            </CardBody>
          </Card>

          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Diagnosis</h5>
              <Form.Group className="mb-2">
                <Form.Control
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter diagnosis..."
                  disabled={emgCase.status === 'Completed'}
                />
              </Form.Group>
              {emgCase.status === 'Active' && (
                <Button variant="primary" size="sm" onClick={handleSaveDiagnosis}>
                  Save Diagnosis
                </Button>
              )}
            </CardBody>
          </Card>

          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-3">Prescription</h5>
              {emgCase.status === 'Active' && (
                <Form onSubmit={handleAddPrescription} className="mb-3">
                  <Row>
                    <Col md={4}>
                      <Form.Control
                        placeholder="Medicine"
                        value={prescriptionForm.medicine}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicine: e.target.value })}
                        required
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Control
                        placeholder="Dosage"
                        value={prescriptionForm.dosage}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Control
                        placeholder="Frequency"
                        value={prescriptionForm.frequency}
                        onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                      />
                    </Col>
                    <Col md={2}>
                      <Button type="submit" variant="success" size="sm" className="w-100">
                        Add
                      </Button>
                    </Col>
                  </Row>
                </Form>
              )}
              {casePrescriptions.length === 0 ? (
                <p className="text-muted mb-0">No prescriptions</p>
              ) : (
                casePrescriptions.map((rx) => (
                  <div key={rx.id} className="border-bottom pb-2 mb-2">
                    {rx.items.map((item, i) => (
                      <div key={i}>
                        <strong>{item.medicine}</strong> — {item.dosage}, {item.frequency}
                        <StatusBadge status={rx.status} className="ms-2" />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h5 className="mb-3">Lab Request</h5>
              {emgCase.status === 'Active' && (
                <Form onSubmit={handleAddLabRequest} className="mb-3">
                  <Row>
                    <Col md={10}>
                      <LabTestSelect value={labTest} onChange={setLabTest} />
                    </Col>
                    <Col md={2}>
                      <Button type="submit" variant="success" size="sm" className="w-100">
                        Request
                      </Button>
                    </Col>
                  </Row>
                </Form>
              )}
              {caseLabRequests.length === 0 ? (
                <p className="text-muted mb-0">No lab requests</p>
              ) : (
                caseLabRequests.map((lab) => (
                  <div key={lab.id} className="border-bottom pb-2 mb-2">
                    <strong>{lab.requestNumber}</strong> — {lab.tests.map((t) => t.testName).join(', ')}
                    <StatusBadge status={lab.status} className="ms-2" />
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </PermissionGuard>
  )
}

export default EmergencyCaseDetailPage
