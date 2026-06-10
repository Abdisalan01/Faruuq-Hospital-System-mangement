import { useMemo, useState } from 'react'
import { Button, Card, CardBody, Form, Modal, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import PatientRegistrationSlip, {
  type PatientRegistrationSlipData,
} from '@/features/reception/components/PatientRegistrationSlip'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import { getPatientCareDisplayStatusFromPatient } from '@/shared/utils/visitConsultation'
import {
  getDisplayVisitForPatient,
  getStaffById,
  getStaffRegistrationFee,
  patients,
} from '@/shared/services/hmsStore'
import type { Patient } from '@/shared/types'

function buildSlipForPatient(patient: Patient): PatientRegistrationSlipData | null {
  const visit = getDisplayVisitForPatient(patient.id)
  if (!visit) return null

  const staff = visit.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
  const emergency = visit.isEmergency ?? staff?.role === 'emergency'
  const referredDoctorName = emergency
    ? 'Emergency'
    : staff
      ? `Dr. ${staff.firstName} ${staff.lastName}`
      : '—'
  const patientNumber = visit.patientNumber ?? visit.queueNumber ?? 0
  const fee = visit.assignedDoctorId ? getStaffRegistrationFee(visit.assignedDoctorId) : 0

  return {
    patientId: patient.id,
    patientNumber,
    isEmergency: emergency,
    fullName: patient.fullName,
    gender: patient.gender,
    age: patient.age,
    phone: patient.phone,
    referredDoctorName,
    registrationFee: fee,
    createdAt: visit.createdAt,
  }
}

function getPatientVisitSummary(patientId: string): { number: string; doctor: string } {
  const visit = getDisplayVisitForPatient(patientId)
  if (!visit) return { number: '—', doctor: '—' }

  const staff = visit.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
  const emergency = visit.isEmergency ?? staff?.role === 'emergency'
  const doctor = emergency
    ? 'Emergency'
    : staff
      ? `Dr. ${staff.firstName} ${staff.lastName}`
      : '—'
  const n = visit.patientNumber ?? visit.queueNumber
  return { number: n ? `#${n}` : '—', doctor }
}

const PatientListPage = () => {
  const { dataVersion } = useHmsStoreContext()
  const [search, setSearch] = useState('')
  const [slipData, setSlipData] = useState<PatientRegistrationSlipData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printError, setPrintError] = useState('')

  const handlePrint = (patient: Patient) => {
    setPrintError('')
    const slip = buildSlipForPatient(patient)
    if (!slip) {
      setPrintError(`No queue number for ${patient.fullName}. Use Edit Patient → New Number Today.`)
      return
    }
    setSlipData(slip)
    setShowPrintModal(true)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return patients
    return patients.filter((p) => {
      const { number, doctor } = getPatientVisitSummary(p.id)
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        number.toLowerCase().includes(q) ||
        doctor.toLowerCase().includes(q)
      )
    })
  }, [search, patients.length, dataVersion])

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title="All Patients" />
      <PageHeader
        title="All Patients"
        subtitle="Registered patient records"
        breadcrumbs={[
          { label: 'Patients', href: '/hms/patients' },
          { label: 'All Patients' },
        ]}
        actionLabel="Register Patient"
        actionHref="/hms/patients/create"
      />
      {printError && (
        <div className="alert alert-warning py-2 mb-3" role="alert">
          {printError}
          <button
            type="button"
            className="btn-close float-end"
            aria-label="Close"
            onClick={() => setPrintError('')}
          />
        </div>
      )}
      <Card className="mb-3">
        <CardBody className="py-2">
          <Form.Control
            type="search"
            placeholder="Search by phone, name, patient ID, number, or doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Last #</th>
                  <th>Referred Doctor</th>
                  <th>Status</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No patients found
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => {
                    const { number, doctor } = getPatientVisitSummary(patient.id)
                    return (
                    <tr key={patient.id}>
                      <td>
                        <Link to={`/hms/patients/${patient.id}`} className="fw-medium">
                          {patient.id}
                        </Link>
                      </td>
                      <td>{patient.fullName}</td>
                      <td className="fw-semibold">{number}</td>
                      <td>{doctor}</td>
                      <td>
                        <StatusBadge status={getPatientCareDisplayStatusFromPatient(patient)} />
                      </td>
                      <td>{patient.gender}</td>
                      <td>{patient.age}</td>
                      <td>{patient.phone}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link
                            to={`/hms/patients/${patient.id}/history`}
                            className="btn btn-sm btn-soft-info"
                            title="Patient history & PDF"
                          >
                            <IconifyIcon icon="solar:history-broken" />
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            className="btn-soft-primary"
                            title="Print registration slip"
                            onClick={() => handlePrint(patient)}
                          >
                            <IconifyIcon icon="solar:printer-broken" />
                          </Button>
                          <Link
                            to={`/hms/patients/${patient.id}/edit`}
                            className="btn btn-sm btn-soft-success"
                            title="Edit patient"
                          >
                            <IconifyIcon icon="solar:pen-broken" />
                          </Link>
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

export default PatientListPage
