import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Nav, Row, Tab, Table } from 'react-bootstrap'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import A4PrintModal from '@/features/doctor/components/a4/A4PrintModal'
import LabRequestLetterA4, { type LabRequestLetterData } from '@/features/doctor/components/LabRequestLetterA4'
import PrescriptionLetterA4, {
  type PrescriptionLetterData,
} from '@/features/doctor/components/PrescriptionLetterA4'
import SurgeryRequestLetterA4, {
  type SurgeryRequestLetterData,
} from '@/features/doctor/components/SurgeryRequestLetterA4'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import LabTestSelect from '@/shared/components/LabTestPicker'
import MedicineSearchSelect from '@/shared/components/MedicineSearchSelect'
import SurgerySelect from '@/shared/components/SurgeryPicker'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  completeSurgeryRequest,
  createLabRequestForVisit,
  getActiveAdmissionForVisit,
  getAdmissionRequestForVisit,
  getClinicalNoteForVisit,
  getDoctorSurgeryStatusLabel,
  getLabRequestsForPatientHistory,
  getLabRequestsForVisit,
  getPatientById,
  getPrescriptionForVisit,
  getPrescriptionsForPatient,
  prescriptions as storePrescriptions,
  getStaffById,
  getSurgeryById,
  getSurgeryRequestForVisit,
  getVisitById,
  getActiveLabTests,
  getActiveSurgeries,
  labTestCatalog,
  isSurgeryFeePaid,
  labRequests,
  medicineCatalog,
  persistDoctorConsultationNowAsync,
  persistInpatientPaymentNowAsync,
  persistLabRequestNowAsync,
  persistReleasePatientNowAsync,
  persistSurgeryFeePaymentNowAsync,
  saveAdmissionRequestForVisit,
  saveClinicalNoteForVisit,
  savePrescriptionForVisit,
  saveSurgeryRequestForVisit,
  surgeryCatalog,
} from '@/shared/services/hmsStore'
import type { PrescriptionItem } from '@/shared/types'
import PatientHistoryPanel from '@/features/doctor/components/PatientHistoryPanel'
import {
  canDoctorCancelAdmissionRequest,
  canDoctorCancelLabRequest,
  canDoctorCancelSurgeryRequest,
  cancelAdmissionRequestByDoctor,
  cancelLabRequestByDoctor,
  cancelSurgeryRequestByDoctor,
  canDoctorReleasePatient,
  confirmDoctorPatientRelease,
  getPatientCareDisplayStatus,
  getPatientClinicalHistory,
  refreshVisitWorkflow,
  startConsultation,
} from '@/shared/utils/visitConsultation'

const emptyRxItem = (): PrescriptionItem => ({
  medicine: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
})

const formatHistoryDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const getDoctorLabel = (id: string) => {
  const staff = getStaffById(id)
  if (!staff) return '—'
  if (staff.role === 'emergency') return 'Emergency'
  return `Dr. ${staff.firstName} ${staff.lastName}`
}

const ConsultationPage = () => {
  const { visitId } = useParams<{ visitId: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const doctorId = user?.id ?? 'staff-003'
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const refresh = () => setTick((t) => t + 1)

  const visit = visitId ? getVisitById(visitId) : undefined
  const patient = visit ? getPatientById(visit.patientId) : undefined
  const isReadOnly = visit ? ['Completed', 'Cancelled'].includes(visit.status) : false

  const existingNote = visitId ? getClinicalNoteForVisit(visitId) : undefined
  const existingRx = visitId ? getPrescriptionForVisit(visitId) : undefined
  const existingAdmission = visitId ? getAdmissionRequestForVisit(visitId) : undefined
  const existingSurgery = visitId ? getSurgeryRequestForVisit(visitId) : undefined

  const activeMedicines = useMemo(
    () => medicineCatalog.filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [medicineCatalog.length, dataVersion],
  )

  const activeLabTestCount = useMemo(
    () => getActiveLabTests().length,
    [labTestCatalog.length, dataVersion],
  )

  const referredDoctorName = useMemo(() => {
    if (!visit?.assignedDoctorId) return '—'
    const staff = getStaffById(visit.assignedDoctorId)
    if (!staff) return '—'
    if (staff.role === 'emergency') return 'Emergency'
    return `Dr. ${staff.firstName} ${staff.lastName}`
  }, [visit?.assignedDoctorId])

  const [consultantNote, setConsultantNote] = useState(existingNote?.note ?? '')
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>(existingRx?.items ?? [emptyRxItem()])
  const [followUpNote, setFollowUpNote] = useState('Soo laabshadu waa muddo 2 isbuuc ah.')
  const [newLabTests, setNewLabTests] = useState<string[]>([''])

  const visitLabs = useMemo(
    () => (visitId ? getLabRequestsForVisit(visitId) : []),
    [visitId, labRequests.length, tick],
  )
  const [admissionReason, setAdmissionReason] = useState(existingAdmission?.reason ?? '')
  const [surgeryCatalogId, setSurgeryCatalogId] = useState(existingSurgery?.surgeryCatalogId ?? '')
  const [surgeryNotes, setSurgeryNotes] = useState(existingSurgery?.notes ?? '')
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState('notes')
  const [rxPrintData, setRxPrintData] = useState<PrescriptionLetterData | null>(null)
  const [showRxPrintModal, setShowRxPrintModal] = useState(false)
  const [labPrintData, setLabPrintData] = useState<LabRequestLetterData | null>(null)
  const [showLabPrintModal, setShowLabPrintModal] = useState(false)
  const [surgeryPrintData, setSurgeryPrintData] = useState<SurgeryRequestLetterData | null>(null)
  const [showSurgeryPrintModal, setShowSurgeryPrintModal] = useState(false)
  const [canPrintRx, setCanPrintRx] = useState(!!existingRx)
  const [canPrintLab, setCanPrintLab] = useState(false)
  const [canPrintSurgery, setCanPrintSurgery] = useState(!!existingSurgery)
  const [lastLabRequestId, setLastLabRequestId] = useState<string | null>(null)

  useEffect(() => {
    if (visit && !isReadOnly) {
      startConsultation(visit)
      refresh()
      if (isSupabase) {
        void persistDoctorConsultationNowAsync({
          visitId: visit.id,
          patientId: visit.patientId,
        }).catch((err) => {
          console.warn('[Consultation] Failed to persist consultation start', err)
        })
      }
    }
  }, [visitId, isReadOnly, isSupabase])

  useEffect(() => {
    if (!visitId) return
    const note = getClinicalNoteForVisit(visitId)
    setConsultantNote(note?.note ?? '')
    const rx = getPrescriptionForVisit(visitId)
    if (rx) {
      setRxItems(rx.items.length ? rx.items : [emptyRxItem()])
      setCanPrintRx(true)
    }
    const adm = getAdmissionRequestForVisit(visitId)
    if (adm) setAdmissionReason(adm.reason)
    const srg = getSurgeryRequestForVisit(visitId)
    if (srg) {
      setSurgeryCatalogId(srg.surgeryCatalogId ?? '')
      setSurgeryNotes(srg.notes ?? '')
      setCanPrintSurgery(true)
    }
  }, [visitId, dataVersion])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['notes', 'prescription', 'rx', 'lab', 'admission', 'surgery'].includes(tab)) {
      setActiveTab(tab === 'rx' ? 'prescription' : tab)
    }
  }, [searchParams])

  const priorHistory = useMemo(
    () => (patient && visit ? getPatientClinicalHistory(patient.id, visit.id) : []),
    [patient?.id, visit?.id, tick, dataVersion],
  )

  const patientRxHistory = useMemo(
    () => (patient ? getPrescriptionsForPatient(patient.id) : []),
    [patient?.id, tick, dataVersion, storePrescriptions.length],
  )

  const priorLabHistory = useMemo(
    () =>
      patient && visit
        ? getLabRequestsForPatientHistory(patient.id, { excludeVisitId: visit.id })
        : [],
    [patient?.id, visit?.id, tick, dataVersion, labRequests.length],
  )

  const activeSurgeryCount = useMemo(
    () => getActiveSurgeries().length,
    [surgeryCatalog.length, dataVersion],
  )

  const canRelease = useMemo(
    () => (visitId ? canDoctorReleasePatient(visitId).ok : false),
    [visitId, tick, dataVersion],
  )

  const showMsg = (text: string, type: 'success' | 'danger' = 'success') => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const persistToDatabase = async (successMessage: string) => {
    if (!isSupabase) {
      showMsg(`${successMessage} (local only — enable VITE_USE_SUPABASE in .env)`)
      return
    }
    setSaving(true)
    try {
      await persistDoctorConsultationNowAsync({
        visitId: visit?.id,
        patientId: patient?.id ?? visit?.patientId,
      })
      showMsg(`${successMessage} Saved to database.`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      showMsg(`Database save failed: ${detail}`, 'danger')
    } finally {
      setSaving(false)
    }
  }

  const saveConsultantNote = async () => {
    if (!visit || !consultantNote.trim()) return
    try {
      saveClinicalNoteForVisit({
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId,
        note: consultantNote,
      })
      refreshVisitWorkflow(visit.id)
      await persistToDatabase('Consultant note saved.')
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not save note', 'danger')
    }
  }

  const buildPrescriptionPrintData = (): PrescriptionLetterData | null => {
    if (!visit || !patient) return null
    const validItems = rxItems.filter((i) => i.medicine.trim())
    if (validItems.length === 0) return null
    return {
      patientId: patient.id,
      patientName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      referredDoctorName,
      items: validItems,
      followUpNote: followUpNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
  }

  const savePrescription = async () => {
    if (!visit) return
    const validItems = rxItems.filter((i) => i.medicine.trim())
    if (validItems.length === 0) {
      showMsg('Add at least one medicine', 'danger')
      return
    }
    try {
      const adm = getActiveAdmissionForVisit(visit.id)
      savePrescriptionForVisit({
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId,
        items: validItems,
      })
      refreshVisitWorkflow(visit.id)
      if (adm) {
        setCanPrintRx(false)
        await persistToDatabase(
          'Inpatient prescription sent to Pharmacy — patient pays there or at reception cashier.',
        )
      } else {
        setCanPrintRx(true)
        await persistToDatabase('Prescription saved.')
        const printData = buildPrescriptionPrintData()
        if (printData) {
          setRxPrintData(printData)
          setShowRxPrintModal(true)
        }
      }
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not save prescription', 'danger')
    }
  }

  const handleConfirmRelease = async () => {
    if (!visit) return
    const result = confirmDoctorPatientRelease(visit.id)
    if (!result.ok) {
      showMsg(result.error ?? 'Could not release patient', 'danger')
      return
    }
    if (isSupabase) {
      setSaving(true)
      try {
        await persistReleasePatientNowAsync(visit.id)
        showMsg('Patient released — visit Completed, status Inactive. Saved to database.')
      } catch (err) {
        showMsg(err instanceof Error ? err.message : 'Released locally but database save failed', 'danger')
      } finally {
        setSaving(false)
      }
    } else {
      showMsg('Patient released — visit Completed, status Inactive.')
    }
    refresh()
  }

  const openPrescriptionPrint = () => {
    const data = buildPrescriptionPrintData()
    if (!data) {
      showMsg('Add at least one medicine before printing', 'danger')
      return
    }
    setRxPrintData(data)
    setShowRxPrintModal(true)
  }

  const buildLabPrintData = (req?: { requestNumber: string; tests: { testName: string }[]; createdAt: string }): LabRequestLetterData | null => {
    if (!visit || !patient) return null
    const testNames = req
      ? req.tests.map((t) => t.testName)
      : newLabTests.filter((n) => n.trim())
    if (testNames.length === 0) return null
    return {
      patientId: patient.id,
      patientName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      referredDoctorName,
      requestNumber: req?.requestNumber ?? 'DRAFT',
      testNames,
      createdAt: req?.createdAt ?? new Date().toISOString(),
    }
  }

  const openLabPrint = () => {
    const saved = lastLabRequestId ? labRequests.find((l) => l.id === lastLabRequestId) : undefined
    const data = buildLabPrintData(saved)
    if (!data) {
      showMsg('Submit a lab request before printing', 'danger')
      return
    }
    setLabPrintData(data)
    setShowLabPrintModal(true)
  }

  const saveLabRequest = async () => {
    if (!visit) return
    const testNames = newLabTests.filter((n) => n.trim())
    if (testNames.length === 0) {
      showMsg('Add at least one test', 'danger')
      return
    }
    try {
      const lab = createLabRequestForVisit({
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId,
        testNames,
      })
      setLastLabRequestId(lab.id)
      setNewLabTests([''])
      refreshVisitWorkflow(visit.id)
      setCanPrintLab(true)
      await persistToDatabase(
        'Lab request sent to reception (Lab Fees). After payment, lab staff will process results.',
      )
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not save lab request', 'danger')
    }
  }

  const saveAdmissionRequest = async () => {
    if (!visit) return
    try {
      saveAdmissionRequestForVisit({
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId,
        reason: admissionReason,
      })
      refreshVisitWorkflow(visit.id)
      await persistToDatabase('In-patient order sent to reception — In Patient Request.')
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not save admission request', 'danger')
    }
  }

  const buildSurgeryPrintData = (): SurgeryRequestLetterData | null => {
    if (!visit || !patient || !surgeryCatalogId) return null
    const catalog = getSurgeryById(surgeryCatalogId)
    if (!catalog) return null
    return {
      patientId: patient.id,
      patientName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      referredDoctorName,
      surgeryId: catalog.surgeryId,
      surgeryName: catalog.name,
      category: catalog.category,
      duration: catalog.duration,
      anesthesiaType: catalog.anesthesiaType,
      riskLevel: catalog.riskLevel,
      description: catalog.description,
      requiredEquipment: catalog.requiredEquipment,
      preOpInstructions: catalog.preOpInstructions,
      postOpCare: catalog.postOpCare,
      notes: surgeryNotes.trim() || undefined,
      scheduledNotes: existingSurgery?.scheduledNotes,
      createdAt: new Date().toISOString(),
    }
  }

  const openSurgeryPrint = () => {
    const data = buildSurgeryPrintData()
    if (!data) {
      showMsg('Select a surgery before printing', 'danger')
      return
    }
    setSurgeryPrintData(data)
    setShowSurgeryPrintModal(true)
  }

  const saveSurgeryRequest = async () => {
    if (!visit || !surgeryCatalogId) {
      showMsg('Select a surgery', 'danger')
      return
    }

    try {
      const surgeryReq = saveSurgeryRequestForVisit({
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId,
        surgeryCatalogId,
        notes: surgeryNotes,
      })
      refreshVisitWorkflow(visit.id)
      setCanPrintSurgery(true)

      const creditAttached = surgeryReq.paymentMethod === 'Credit Book'
      if (isSupabase) {
        setSaving(true)
        try {
          await persistDoctorConsultationNowAsync({
            visitId: visit.id,
            patientId: visit.patientId,
          })
          if (creditAttached) await persistInpatientPaymentNowAsync()
          showMsg(
            creditAttached
              ? 'Surgery ordered — fee attached to inpatient credit book. Reception will schedule.'
              : 'Surgery request sent — patient pays at Reception Surgery. Saved to database.',
          )
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Unknown error'
          showMsg(`Database save failed: ${detail}`, 'danger')
        } finally {
          setSaving(false)
        }
      } else {
        showMsg(
          creditAttached
            ? 'Surgery ordered — fee attached to inpatient credit book. Reception will schedule.'
            : 'Surgery request sent — patient pays at Reception Surgery.',
        )
      }
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not save surgery request', 'danger')
    }
  }

  const updateRxItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    setRxItems((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const selectMedicine = (index: number, medicineName: string) => {
    const med = activeMedicines.find((m) => m.name === medicineName)
    setRxItems((items) =>
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              medicine: medicineName,
              dosage: item.dosage || (med?.unit ? `1 ${med.unit}` : ''),
            }
          : item,
      ),
    )
  }

  const addRxItem = () => setRxItems((items) => [...items, emptyRxItem()])
  const removeRxItem = (index: number) => setRxItems((items) => items.filter((_, i) => i !== index))

  const updateLabTest = (index: number, value: string) => {
    setNewLabTests((tests) => tests.map((name, i) => (i === index ? value : name)))
  }
  const addLabTest = () => setNewLabTests((tests) => [...tests, ''])
  const removeLabTest = (index: number) => setNewLabTests((tests) => tests.filter((_, i) => i !== index))

  const handleCancelLab = async (labId: string) => {
    const result = cancelLabRequestByDoctor(labId, doctorId)
    if (!result.ok) {
      showMsg(result.error ?? 'Could not cancel lab request', 'danger')
      return
    }
    refresh()
    if (!isSupabase) {
      showMsg('Lab request cancelled.')
      return
    }
    setSaving(true)
    try {
      await persistLabRequestNowAsync(labId)
      showMsg('Lab request cancelled — reception Lab Fees updated.')
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Cancelled locally but database save failed', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelAdmission = async () => {
    if (!existingAdmission) return
    const result = cancelAdmissionRequestByDoctor(existingAdmission.id, doctorId)
    if (!result.ok) {
      showMsg(result.error ?? 'Could not cancel in-patient request', 'danger')
      return
    }
    setAdmissionReason('')
    await persistToDatabase('In-patient request cancelled.')
    refresh()
  }

  const handleCancelSurgery = async () => {
    if (!existingSurgery) return
    const result = cancelSurgeryRequestByDoctor(existingSurgery.id, doctorId)
    if (!result.ok) {
      showMsg(result.error ?? 'Could not cancel surgery request', 'danger')
      return
    }
    setSurgeryCatalogId('')
    setSurgeryNotes('')
    setCanPrintSurgery(false)
    await persistToDatabase('Surgery request cancelled.')
    refresh()
  }

  const handleMarkSurgeryCompleted = async () => {
    if (!existingSurgery || !visit) return
    try {
      completeSurgeryRequest(existingSurgery.id, doctorId)
      refreshVisitWorkflow(visit.id)
      if (isSupabase) await persistSurgeryFeePaymentNowAsync()
      showMsg('Surgery marked completed. Order in-patient or release the patient when ready.')
      refresh()
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Could not mark surgery completed', 'danger')
    }
  }

  if (!visit || !patient) {
    return (
      <PermissionGuard permissions={['view_assigned_patients']}>
        <PageMetaData title="Consultation" />
        <Alert variant="danger">Visit not found.</Alert>
        <Link to="/hms/doctor/patients">Back to All Patients</Link>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['view_assigned_patients']}>
      <div className="consultation-page">
      <PageMetaData title={`Consultation — ${patient.fullName}`} />
      <PageHeader
        title={`Consultation: ${patient.fullName}`}
        subtitle={`Visit ${visit.visitNumber} · Queue #${visit.queueNumber}`}
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'All Patients', href: '/hms/doctor/patients' },
          { label: 'Consultation' },
        ]}
      />

      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {isReadOnly && (
        <Alert variant="secondary" className="py-2">
          <IconifyIcon icon="solar:eye-broken" className="me-1" />
          Patient released (Inactive) — view-only. Notes, prescriptions, labs, and surgery from this visit
          and prior visits are shown below.
        </Alert>
      )}

      <PatientHistoryPanel history={priorHistory} />

      <Card className="consultation-patient-banner">
        <CardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <p className="consultation-meta-label mb-0">Patient</p>
              <h5 className="consultation-patient-name">{patient.fullName}</h5>
              <div className="d-flex flex-wrap gap-1 align-items-center mt-1">
                <StatusBadge status={getPatientCareDisplayStatus(visit)} />
                {['Completed', 'Cancelled'].includes(visit.status) && (
                  <StatusBadge status="Completed" />
                )}
              </div>
            </div>
            {!['Completed', 'Cancelled', 'Waiting'].includes(visit.status) && (
              <Button
                size="sm"
                variant="success"
                onClick={handleConfirmRelease}
                disabled={saving || !canRelease}
              >
                <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                {saving ? 'Releasing...' : 'Release patient'}
              </Button>
            )}
          </div>
          <div className="consultation-meta-grid">
            <div className="consultation-meta-item">
              <span className="consultation-meta-icon">
                <IconifyIcon icon="solar:user-broken" />
              </span>
              <div>
                <p className="consultation-meta-label">Age / Gender</p>
                <p className="consultation-meta-value">
                  {patient.age} / {patient.gender}
                </p>
              </div>
            </div>
            <div className="consultation-meta-item">
              <span className="consultation-meta-icon">
                <IconifyIcon icon="solar:phone-broken" />
              </span>
              <div>
                <p className="consultation-meta-label">Phone</p>
                <p className="consultation-meta-value">{patient.phone}</p>
              </div>
            </div>
            <div className="consultation-meta-item">
              <span className="consultation-meta-icon">
                <IconifyIcon icon="solar:calendar-broken" />
              </span>
              <div>
                <p className="consultation-meta-label">Visit</p>
                <p className="consultation-meta-value">
                  {visit.visitNumber} · {visit.visitDate}
                </p>
              </div>
            </div>
            <div className="consultation-meta-item">
              <span className="consultation-meta-icon">
                <IconifyIcon icon="solar:stethoscope-broken" />
              </span>
              <div>
                <p className="consultation-meta-label">Doctor</p>
                <p className="consultation-meta-value">{referredDoctorName}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k ?? 'notes')}>
        <Nav variant="pills" className="consultation-tab-nav">
          <Nav.Item>
            <Nav.Link eventKey="notes">
              <IconifyIcon icon="solar:document-text-broken" />
              Consultation Notes
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="prescription">
              <IconifyIcon icon="solar:pill-broken" />
              Prescription
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="lab">
              <IconifyIcon icon="solar:test-tube-broken" />
              Lab Request
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="admission">
              <IconifyIcon icon="solar:bed-broken" />
              Order In-Patient
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="surgery">
              <IconifyIcon icon="solar:scalpel-broken" />
              Surgery
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="notes">
            <Card className="consultation-section-card">
              <CardBody>
                <div className="consultation-section-title">
                  <IconifyIcon icon="solar:document-text-broken" />
                  Consultation Notes
                </div>
                <p className="consultation-section-hint">
                  Record clinical findings, diagnosis, and treatment plan for this visit.
                </p>
                <Form.Group className="mb-3">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={consultantNote}
                    onChange={(e) => setConsultantNote(e.target.value)}
                    placeholder="Enter consultation notes..."
                    readOnly={isReadOnly}
                    disabled={isReadOnly}
                  />
                </Form.Group>
                <div className="consultation-action-bar">
                  <Button
                    variant="primary"
                    onClick={saveConsultantNote}
                    disabled={saving || isReadOnly}
                  >
                    <IconifyIcon icon="solar:diskette-broken" className="me-1" />
                    {saving ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Tab.Pane>

          <Tab.Pane eventKey="prescription">
            {patientRxHistory.length > 0 && (
              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-3">Prescription history — {patient.fullName}</h6>
                  <p className="text-muted small">
                    Every prescription this patient received (from database), with date.
                  </p>
                  {patientRxHistory.map((rx) => {
                    const rxVisit = getVisitById(rx.visitId)
                    return (
                      <div
                        key={rx.id}
                        className={`border rounded p-3 mb-3 ${
                          rx.visitId === visit.id ? 'border-primary border-opacity-50' : 'bg-light bg-opacity-50'
                        }`}
                      >
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <div className="fw-semibold">
                              {formatHistoryDate(rx.createdAt)}
                              {rx.visitId === visit.id && (
                                <span className="text-primary small ms-2">(this visit)</span>
                              )}
                            </div>
                            <div className="text-muted small">
                              {getDoctorLabel(rx.doctorId)}
                              {rxVisit && (
                                <span>
                                  {' '}
                                  · Visit {rxVisit.visitNumber} · {rxVisit.visitDate}
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={rx.status} />
                        </div>
                        <Table bordered size="sm" className="mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Medicine</th>
                              <th>Dosage</th>
                              <th>Frequency</th>
                              <th>Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rx.items.map((item, i) => (
                              <tr key={i}>
                                <td>{item.medicine}</td>
                                <td>{item.dosage || '—'}</td>
                                <td>{item.frequency || '—'}</td>
                                <td>{item.duration || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )
                  })}
                </CardBody>
              </Card>
            )}
            {!isReadOnly && (
            <Card className="consultation-section-card">
              <CardBody>
                <div className="consultation-section-title">
                  <IconifyIcon icon="solar:pill-broken" />
                  New Prescription
                </div>
                <p className="consultation-section-hint">
                  Search and select medicines from the hospital catalog ({activeMedicines.length} available).
                  Print on A4 prescription letter.
                </p>
                {rxItems.map((item, idx) => (
                  <div key={idx} className="consultation-rx-row">
                    <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Medicine</Form.Label>
                        <MedicineSearchSelect
                          value={item.medicine}
                          onChange={(value) => selectMedicine(idx, value)}
                          excludeNames={rxItems.filter((_, i) => i !== idx).map((r) => r.medicine)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Dosage</Form.Label>
                        <Form.Control
                          value={item.dosage}
                          onChange={(e) => updateRxItem(idx, 'dosage', e.target.value)}
                          placeholder="e.g. 1 tablet"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Frequency</Form.Label>
                        <Form.Control
                          value={item.frequency}
                          onChange={(e) => updateRxItem(idx, 'frequency', e.target.value)}
                          placeholder="e.g. 3x daily"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Duration</Form.Label>
                        <Form.Control
                          value={item.duration}
                          onChange={(e) => updateRxItem(idx, 'duration', e.target.value)}
                          placeholder="e.g. 7 days"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Instruction</Form.Label>
                        <Form.Control
                          value={item.instructions}
                          onChange={(e) => updateRxItem(idx, 'instructions', e.target.value)}
                          placeholder="After meals"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={1} className="d-flex align-items-end">
                      {rxItems.length > 1 && (
                        <Button variant="outline-danger" size="sm" onClick={() => removeRxItem(idx)}>
                          <IconifyIcon icon="solar:trash-bin-trash-broken" />
                        </Button>
                      )}
                    </Col>
                    </Row>
                  </div>
                ))}
                <Form.Group className="mb-3">
                  <Form.Label>Follow-up note (on printed letter)</Form.Label>
                  <Form.Control
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="Soo laabshadu waa muddo 2 isbuuc ah."
                  />
                </Form.Group>
                <div className="consultation-action-bar">
                  <Button variant="outline-secondary" onClick={addRxItem}>
                    <IconifyIcon icon="bx:plus" className="me-1" />
                    Add Medicine
                  </Button>
                  <Button variant="primary" onClick={savePrescription} disabled={saving}>
                    <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                    {saving ? 'Saving...' : 'Submit'}
                  </Button>
                  {canPrintRx && (
                    <Button variant="outline-primary" onClick={openPrescriptionPrint}>
                      <IconifyIcon icon="solar:printer-broken" className="me-1" />
                      Print A4 Letter
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
            )}
          </Tab.Pane>

          <Tab.Pane eventKey="lab">
            {priorLabHistory.length > 0 && (
              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-3">Lab history — {patient.fullName}</h6>
                  <p className="text-muted small">
                    All labs previously ordered (includes cancelled), with dates and results from database.
                  </p>
                  {priorLabHistory.map((lab) => {
                    const labVisit = getVisitById(lab.visitId)
                    const isCancelled = lab.status === 'Cancelled'
                    return (
                      <div
                        key={lab.id}
                        className={`border rounded p-3 mb-3 ${
                          isCancelled ? 'border-danger border-opacity-25 bg-danger bg-opacity-10' : 'bg-light bg-opacity-50'
                        }`}
                      >
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <span className="fw-semibold">{lab.requestNumber}</span>
                            <div className="text-muted small">
                              Ordered {formatHistoryDate(lab.createdAt)}
                              {labVisit && (
                                <span>
                                  {' '}
                                  · Visit {labVisit.visitNumber} · {labVisit.visitDate}
                                </span>
                              )}
                            </div>
                            <div className="text-muted small">{getDoctorLabel(lab.doctorId)}</div>
                            {isCancelled && (
                              <div className="text-danger small mt-1">
                                Cancelled{' '}
                                {formatHistoryDate(lab.cancelledAt ?? lab.lastModifiedAt ?? lab.createdAt)}
                              </div>
                            )}
                            {lab.status === 'Completed' && lab.completedAt && (
                              <div className="text-success small mt-1">
                                Completed {formatHistoryDate(lab.completedAt)}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={lab.status} />
                        </div>
                        {lab.status === 'Completed' ? (
                          <Table bordered size="sm" className="mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Test</th>
                                <th>Result</th>
                                <th>Reference</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lab.tests.map((t, i) => (
                                <tr key={i}>
                                  <td>{t.testName}</td>
                                  <td className="fw-semibold">{t.result ?? '—'}</td>
                                  <td>{t.referenceValue ?? '—'}</td>
                                  <td>{t.remarks ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        ) : (
                          <p className="text-muted small mb-0">
                            Tests: {lab.tests.map((t) => t.testName).join(', ')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </CardBody>
              </Card>
            )}
            {visitLabs.length > 0 && (
              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-3">Lab history — this visit</h6>
                  {visitLabs.map((lab) => (
                    <div key={lab.id} className="border rounded p-3 mb-3">
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                        <span className="fw-semibold">{lab.requestNumber}</span>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <StatusBadge status={lab.status} />
                          {!isReadOnly && canDoctorCancelLabRequest(lab) && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleCancelLab(lab.id)}
                            >
                              <IconifyIcon icon="solar:close-circle-broken" className="me-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                      {lab.status === 'Completed' ? (
                        <Table bordered size="sm" className="mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Test</th>
                              <th>Result</th>
                              <th>Reference</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lab.tests.map((t, i) => (
                              <tr key={i}>
                                <td>{t.testName}</td>
                                <td className="fw-semibold">{t.result ?? '—'}</td>
                                <td>{t.referenceValue ?? '—'}</td>
                                <td>{t.remarks ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <p className="text-muted small mb-0">
                          Tests: {lab.tests.map((t) => t.testName).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
            {!isReadOnly && (
            <Card className="consultation-section-card">
              <CardBody>
                <div className="consultation-section-title">
                  <IconifyIcon icon="solar:test-tube-broken" />
                  {visitLabs.length > 0 ? 'New Lab Request' : 'Lab Request'}
                </div>
                <p className="consultation-section-hint">
                  Search and select tests from the hospital catalog ({activeLabTestCount} available).
                  Each save creates a separate lab order sent to reception for payment.
                </p>
                {newLabTests.map((testName, idx) => (
                  <Row key={idx} className="mb-3 align-items-end">
                    <Col md={10}>
                      <Form.Group>
                        <Form.Label>Test</Form.Label>
                        <LabTestSelect
                          value={testName}
                          onChange={(value) => updateLabTest(idx, value)}
                          excludeNames={newLabTests.filter((_, i) => i !== idx)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      {newLabTests.length > 1 && (
                        <Button variant="outline-danger" size="sm" onClick={() => removeLabTest(idx)}>
                          <IconifyIcon icon="solar:trash-bin-trash-broken" />
                        </Button>
                      )}
                    </Col>
                  </Row>
                ))}
                <div className="consultation-action-bar">
                  <Button variant="outline-secondary" onClick={addLabTest}>
                    <IconifyIcon icon="bx:plus" className="me-1" />
                    Add Test
                  </Button>
                  <Button variant="primary" onClick={saveLabRequest} disabled={saving}>
                    <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                    {saving ? 'Saving...' : 'Submit'}
                  </Button>
                  {canPrintLab && (
                    <Button variant="outline-primary" onClick={openLabPrint}>
                      <IconifyIcon icon="solar:printer-broken" className="me-1" />
                      Print A4 Letter
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
            )}
          </Tab.Pane>

          <Tab.Pane eventKey="admission">
            <Card className="consultation-section-card">
              <CardBody>
                <div className="consultation-section-title">
                  <IconifyIcon icon="solar:bed-broken" />
                  Order In-Patient
                </div>
                {existingAdmission && (
                  <Alert
                    variant={existingAdmission.status === 'Assigned' ? 'success' : 'info'}
                    className="py-2 mb-3"
                  >
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <span>
                        In-patient request: <strong>{existingAdmission.status}</strong>
                        {existingAdmission.status === 'Assigned' && (
                          <span className="ms-1 text-muted">— room assigned at reception</span>
                        )}
                      </span>
                      {!isReadOnly && canDoctorCancelAdmissionRequest(existingAdmission) && (
                        <Button size="sm" variant="outline-danger" onClick={handleCancelAdmission}>
                          <IconifyIcon icon="solar:close-circle-broken" className="me-1" />
                          Cancel request
                        </Button>
                      )}
                    </div>
                  </Alert>
                )}
                {isReadOnly ? (
                  !existingAdmission && (
                    <p className="text-muted small mb-0">No in-patient request for this visit.</p>
                  )
                ) : (
                  <>
                    <p className="text-muted small mb-3">
                      Ward, room, and bed are assigned by reception after your order is submitted.
                    </p>
                    <Form.Group className="mb-3">
                      <Form.Label>Reason for Admission</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={admissionReason}
                        onChange={(e) => setAdmissionReason(e.target.value)}
                        placeholder="Clinical reason for inpatient care..."
                        disabled={existingAdmission?.status === 'Assigned'}
                      />
                    </Form.Group>
                    {existingAdmission?.status !== 'Assigned' && (
                      <Button variant="primary" onClick={saveAdmissionRequest} disabled={saving}>
                        <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                        {saving ? 'Saving...' : existingAdmission ? 'Update & Submit' : 'Submit'}
                      </Button>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </Tab.Pane>

          <Tab.Pane eventKey="surgery">
            <Card className="consultation-section-card">
              <CardBody>
                <div className="consultation-section-title">
                  <IconifyIcon icon="solar:scalpel-broken" />
                  Surgery Request
                </div>
                {existingSurgery?.status === 'Completed' ? (
                  <>
                    <Alert variant="success" className="mb-3">
                      <strong>Surgery completed</strong>
                      {existingSurgery.completedAt && (
                        <span className="ms-2">
                          · {new Date(existingSurgery.completedAt).toLocaleDateString()}
                        </span>
                      )}
                      {existingSurgery.scheduledDate && (
                        <div className="small mt-1">Scheduled date: {existingSurgery.scheduledDate}</div>
                      )}
                    </Alert>
                    {!isReadOnly && !['Completed', 'Cancelled'].includes(visit.status) && (
                      <Alert variant="light" className="border mb-3">
                        <strong>Next step:</strong> If the patient needs admission, use{' '}
                        <Button
                          size="sm"
                          variant="link"
                          className="p-0 align-baseline"
                          onClick={() => setActiveTab('admission')}
                        >
                          Order In-Patient
                        </Button>
                        . Otherwise use <strong>Release patient</strong> at the top of this page.
                      </Alert>
                    )}
                  </>
                ) : existingSurgery?.status === 'Scheduled' ? (
                  <Alert variant="info" className="mb-3">
                    Status: <strong>Scheduled</strong>
                    {existingSurgery.scheduledDate && (
                      <span className="ms-2">· Date: {existingSurgery.scheduledDate}</span>
                    )}
                    {!isReadOnly && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => void handleMarkSurgeryCompleted()}
                          disabled={saving}
                        >
                          <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                          {saving ? 'Saving...' : 'Confirm surgery completed'}
                        </Button>
                      </div>
                    )}
                  </Alert>
                ) : existingSurgery && isSurgeryFeePaid(existingSurgery) ? (
                  <Alert variant="info" className="mb-3">
                    Status: <strong>{getDoctorSurgeryStatusLabel(existingSurgery)}</strong>
                    <div className="small mt-1 text-muted">
                      Reception must set the surgery date on the Surgery page.
                    </div>
                  </Alert>
                ) : isReadOnly ? (
                  !existingSurgery && (
                    <p className="text-muted small mb-0">No surgery request for this visit.</p>
                  )
                ) : (
                  <>
                    {getActiveAdmissionForVisit(visit.id)?.billingMode === 'credit_book' && (
                      <Alert variant="warning" className="small py-2">
                        Inpatient credit book — surgery fee is attached to the patient&apos;s credit
                        account automatically. Reception only needs to schedule the date.
                      </Alert>
                    )}
                    <p className="consultation-section-hint">
                      Search and select from catalog ({activeSurgeryCount} active) — grouped by category.
                    </p>
                    <Form.Group className="mb-3">
                      <Form.Label>Surgery</Form.Label>
                      <SurgerySelect value={surgeryCatalogId} onChange={setSurgeryCatalogId} />
                    </Form.Group>
                    {surgeryCatalogId && (() => {
                      const catalog = getSurgeryById(surgeryCatalogId)
                      if (!catalog) return null
                      return (
                        <div className="small text-muted mb-3 border rounded p-2 bg-light">
                          <div>
                            <strong>{catalog.category}</strong>
                            {catalog.duration && ` · ${catalog.duration}`}
                            {catalog.anesthesiaType && ` · ${catalog.anesthesiaType} anesthesia`}
                            {catalog.riskLevel && ` · ${catalog.riskLevel} risk`}
                          </div>
                          {catalog.preOpInstructions && (
                            <div className="mt-1">Pre-op: {catalog.preOpInstructions}</div>
                          )}
                        </div>
                      )
                    })()}
                    <Form.Group className="mb-3">
                      <Form.Label>Notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={surgeryNotes}
                        onChange={(e) => setSurgeryNotes(e.target.value)}
                        placeholder="Scheduling notes, urgency..."
                      />
                    </Form.Group>
                    {existingSurgery && (
                      <p className="small text-muted mb-2">
                        Current status: <strong>{getDoctorSurgeryStatusLabel(existingSurgery)}</strong>
                      </p>
                    )}
                    <div className="consultation-action-bar">
                      <Button variant="primary" onClick={saveSurgeryRequest} disabled={saving}>
                        <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                        {saving ? 'Saving...' : 'Submit'}
                      </Button>
                      {existingSurgery && canDoctorCancelSurgeryRequest(existingSurgery) && (
                        <Button variant="outline-danger" onClick={handleCancelSurgery}>
                          <IconifyIcon icon="solar:close-circle-broken" className="me-1" />
                          Cancel request
                        </Button>
                      )}
                      {canPrintSurgery && (
                        <Button variant="outline-primary" onClick={openSurgeryPrint}>
                          <IconifyIcon icon="solar:printer-broken" className="me-1" />
                          Print A4 Letter
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      <A4PrintModal
        show={showRxPrintModal}
        onHide={() => setShowRxPrintModal(false)}
        title="Prescription Letter — A4 / PDF"
      >
        {rxPrintData && <PrescriptionLetterA4 data={rxPrintData} />}
      </A4PrintModal>

      <A4PrintModal
        show={showLabPrintModal}
        onHide={() => setShowLabPrintModal(false)}
        title="Lab Request Letter — A4 / PDF"
      >
        {labPrintData && <LabRequestLetterA4 data={labPrintData} />}
      </A4PrintModal>

      <A4PrintModal
        show={showSurgeryPrintModal}
        onHide={() => setShowSurgeryPrintModal(false)}
        title="Surgery Request Letter — A4 / PDF"
      >
        {surgeryPrintData && <SurgeryRequestLetterA4 data={surgeryPrintData} />}
      </A4PrintModal>
      </div>
    </PermissionGuard>
  )
}

export default ConsultationPage
