import {
  admissionRequests,
  admissions,
  beds,
  clinicalNotes,
  diagnoses,
  generateId,
  generateNumber,
  getAdmissionById,
  getLatestOpenVisitForPatient,
  getPatientById,
  getVisitById,
  labRequests,
  patients,
  prescriptions,
  surgeryRequests,
  visits,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import { todayIsoLocal } from '@/shared/utils/dateUtils'
import type {
  AdmissionRequest,
  ClinicalNote,
  Diagnosis,
  LabRequest,
  Patient,
  PatientStatus,
  Prescription,
  SurgeryRequest,
  Visit,
  VisitStatus,
} from '@/shared/types'

const TERMINAL_VISIT_STATUSES = new Set<VisitStatus>(['Completed', 'Cancelled'])

/** Doctor follow-up window — reception can activate without a new patient number */
export const FOLLOW_UP_ACTIVATION_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

function getVisitReleaseTimestamp(visit: Visit): number {
  const fromModified = Date.parse(visit.lastModifiedAt ?? '')
  if (fromModified) return fromModified
  return Date.parse(`${visit.visitDate}T23:59:59`) || 0
}

/** Most recent released visit for this patient */
export function getLastCompletedVisitForPatient(patientId: string): Visit | undefined {
  return visits
    .filter((v) => v.patientId === patientId && v.status === 'Completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export type FollowUpActivationInfo = {
  eligible: boolean
  error?: string
  daysRemaining?: number
  deadlineDate?: string
  lastVisit?: Visit
  patient?: Patient
}

export function getFollowUpActivationInfo(patientId: string): FollowUpActivationInfo {
  const patient = getPatientById(patientId)
  if (!patient) return { eligible: false, error: 'Patient not found.' }

  const openVisit = getLatestOpenVisitForPatient(patientId)
  if (openVisit) {
    return {
      eligible: false,
      error: 'Patient already has an active visit. Send to the doctor or complete that visit first.',
      patient,
      lastVisit: openVisit,
    }
  }

  const lastCompleted = getLastCompletedVisitForPatient(patientId)
  if (!lastCompleted) {
    return {
      eligible: false,
      error: 'No previous visit found. Register the patient or assign a new patient number.',
      patient,
    }
  }

  const releasedAt = getVisitReleaseTimestamp(lastCompleted)
  const deadlineMs = releasedAt + FOLLOW_UP_ACTIVATION_DAYS * MS_PER_DAY
  const now = Date.now()

  if (now > deadlineMs) {
    const deadlineDate = new Date(deadlineMs).toLocaleDateString()
    return {
      eligible: false,
      error: `Follow-up window expired (${FOLLOW_UP_ACTIVATION_DAYS} days). Assign a new patient number.`,
      deadlineDate,
      lastVisit: lastCompleted,
      patient,
    }
  }

  const daysRemaining = Math.max(1, Math.ceil((deadlineMs - now) / MS_PER_DAY))
  const deadlineDate = new Date(deadlineMs).toLocaleDateString()

  return {
    eligible: true,
    daysRemaining,
    deadlineDate,
    lastVisit: lastCompleted,
    patient,
  }
}

/** Reception activates inactive patient for doctor follow-up — same number, no registration fee */
export function activatePatientForFollowUp(
  patientId: string,
): { ok: boolean; error?: string; visitId?: string } {
  const info = getFollowUpActivationInfo(patientId)
  if (!info.eligible || !info.lastVisit) {
    return { ok: false, error: info.error ?? 'Cannot activate patient.' }
  }

  const lastCompleted = info.lastVisit
  const visitDate = todayIsoLocal()

  const openVisitSameDoctorToday = visits.find(
    (v) =>
      v.patientId === patientId &&
      v.assignedDoctorId === lastCompleted.assignedDoctorId &&
      v.visitDate === visitDate &&
      !['Completed', 'Cancelled'].includes(v.status),
  )
  if (openVisitSameDoctorToday) {
    return {
      ok: false,
      error: 'Patient already has an active visit with this doctor today.',
    }
  }

  const now = new Date().toISOString()
  const patientNumber = lastCompleted.patientNumber ?? lastCompleted.queueNumber
  const visitId = generateId('vis')

  visits.push({
    id: visitId,
    visitNumber: generateNumber('V'),
    patientId,
    visitDate,
    assignedDoctorId: lastCompleted.assignedDoctorId,
    departmentId: lastCompleted.departmentId,
    status: 'Waiting',
    queueNumber: patientNumber,
    patientNumber,
    isEmergency: lastCompleted.isEmergency,
    isFollowUp: true,
    createdAt: now,
    lastModifiedAt: now,
  })

  onNewVisitCreated(patientId)
  touchHmsStore()

  return { ok: true, visitId }
}

export function touchVisit(visit: Visit): void {
  visit.lastModifiedAt = new Date().toISOString()
}

export function isTerminalVisitStatus(status: VisitStatus): boolean {
  return TERMINAL_VISIT_STATUSES.has(status)
}

function isSurgeryPaid(req: SurgeryRequest): boolean {
  return Boolean(req.paymentConfirmedAt) || req.status === 'Scheduled' || req.status === 'Completed'
}

/** Visit statuses that mean the doctor consultation is not finished yet */
export const PENDING_CONSULTATION_STATUSES: VisitStatus[] = [
  'Waiting',
  'In Consultation',
  'Lab Requested',
]

export function hasPendingLabForVisit(visitId: string): boolean {
  return labRequests.some(
    (l) =>
      l.visitId === visitId &&
      l.status !== 'Completed' &&
      l.status !== 'Awaiting Payment' &&
      l.status !== 'Cancelled',
  )
}

export function hasAwaitingPaymentLabForVisit(visitId: string): boolean {
  return labRequests.some((l) => l.visitId === visitId && l.status === 'Awaiting Payment')
}

export function hasLabRequestForVisit(visitId: string): boolean {
  return labRequests.some(
    (l) => l.visitId === visitId && l.status !== 'Completed' && l.status !== 'Cancelled',
  )
}

export function hasPendingAdmissionForVisit(visitId: string): boolean {
  return admissionRequests.some((a) => a.visitId === visitId && a.status === 'Pending')
}

export function hasUnpaidSurgeryForVisit(visitId: string): boolean {
  return surgeryRequests.some(
    (s) => s.visitId === visitId && s.status === 'Pending' && !isSurgeryPaid(s),
  )
}

export function hasActiveSurgeryForVisit(visitId: string): boolean {
  return surgeryRequests.some(
    (s) => s.visitId === visitId && s.status !== 'Completed' && s.status !== 'Cancelled',
  )
}

export function hasSurgeryRequestForVisit(visitId: string): boolean {
  return hasActiveSurgeryForVisit(visitId)
}

export function hasActiveAdmissionForVisit(visitId: string): boolean {
  return admissions.some((a) => a.visitId === visitId && a.status === 'Active')
}

export function isVisitInPatient(visit: Visit): boolean {
  if (visit.status === 'Admitted' || hasActiveAdmissionForVisit(visit.id)) return true
  return hasPendingAdmissionForVisit(visit.id)
}

export function hasOpenAdmissionRequestForVisit(visitId: string): boolean {
  return admissionRequests.some(
    (a) => a.visitId === visitId && !['Cancelled', 'Rejected'].includes(a.status),
  )
}

export function hasBlockingOrders(visitId: string): boolean {
  return (
    hasLabRequestForVisit(visitId) ||
    hasActiveSurgeryForVisit(visitId) ||
    hasOpenAdmissionRequestForVisit(visitId) ||
    hasActiveAdmissionForVisit(visitId)
  )
}

export type ReleaseBlocker = {
  type: 'lab' | 'surgery' | 'admission'
  label: string
  canCancel: boolean
}

/** Open lab / surgery / in-patient orders that must be cancelled (or completed) before Release */
export function getReleaseBlockers(visitId: string): ReleaseBlocker[] {
  const blockers: ReleaseBlocker[] = []

  for (const lab of labRequests.filter(
    (l) => l.visitId === visitId && l.status !== 'Completed' && l.status !== 'Cancelled',
  )) {
    blockers.push({
      type: 'lab',
      label: `Lab ${lab.requestNumber} (${lab.status})`,
      canCancel: canDoctorCancelLabRequest(lab),
    })
  }

  for (const surgery of surgeryRequests.filter(
    (s) => s.visitId === visitId && s.status !== 'Completed' && s.status !== 'Cancelled',
  )) {
    blockers.push({
      type: 'surgery',
      label: `Surgery ${surgery.surgeryName} (${surgery.status})`,
      canCancel: canDoctorCancelSurgeryRequest(surgery),
    })
  }

  for (const admission of admissionRequests.filter(
    (a) => a.visitId === visitId && !['Cancelled', 'Rejected'].includes(a.status),
  )) {
    blockers.push({
      type: 'admission',
      label: `In-patient order (${admission.status})`,
      canCancel: canDoctorCancelAdmissionRequest(admission),
    })
  }

  if (hasActiveAdmissionForVisit(visitId)) {
    blockers.push({
      type: 'admission',
      label: 'Patient is admitted (active inpatient)',
      canCancel: false,
    })
  }

  return blockers
}

export function canDoctorReleasePatient(visitId: string): { ok: boolean; error?: string } {
  const visit = getVisitById(visitId)
  if (!visit) return { ok: false, error: 'Visit not found.' }
  if (['Completed', 'Cancelled'].includes(visit.status)) {
    return { ok: false, error: 'Patient already released.' }
  }
  return { ok: true }
}

/** Cancel open lab / surgery / pending admission orders when doctor releases patient */
export function isVisitReleasedOrMissing(visitId: string): boolean {
  const visit = getVisitById(visitId)
  return !visit || ['Completed', 'Cancelled'].includes(visit.status)
}

/** Reception Lab Fees — hide cancelled orders and orders for released visits */
export function isReceptionLabFeeVisible(lab: LabRequest): boolean {
  if (lab.status === 'Cancelled') return false
  if (isVisitReleasedOrMissing(lab.visitId)) return false
  return true
}

/** Reception Surgery — hide cancelled orders and orders for released visits */
export function isReceptionSurgeryVisible(req: SurgeryRequest): boolean {
  if (req.status === 'Cancelled') return false
  if (isVisitReleasedOrMissing(req.visitId)) return false
  return true
}

/** Reception In-Patient Request — hide cancelled/rejected and orders for released visits */
export function isReceptionAdmissionVisible(req: AdmissionRequest): boolean {
  if (req.status === 'Cancelled' || req.status === 'Rejected') return false
  if (isVisitReleasedOrMissing(req.visitId)) return false
  return req.status === 'Pending' || req.status === 'Assigned'
}

export function cancelOpenOrdersForVisitRelease(visitId: string): void {
  const ts = new Date().toISOString()

  for (const lab of labRequests) {
    if (lab.visitId !== visitId) continue
    if (lab.status === 'Completed' || lab.status === 'Cancelled') continue
    lab.status = 'Cancelled'
    lab.cancelledAt = ts
    lab.lastModifiedAt = ts
  }

  for (const surgery of surgeryRequests) {
    if (surgery.visitId !== visitId) continue
    if (surgery.status === 'Completed' || surgery.status === 'Cancelled') continue
    surgery.status = 'Cancelled'
    surgery.lastModifiedAt = ts
  }

  for (const admission of admissionRequests) {
    if (admission.visitId !== visitId) continue
    if (['Cancelled', 'Rejected', 'Assigned'].includes(admission.status)) continue
    admission.status = 'Cancelled'
    admission.lastModifiedAt = ts
  }

  refreshVisitWorkflow(visitId)
  touchHmsStore()
}

/** Not yet seen by doctor (still in queue) */
export function isVisitUnConsulted(visit: Visit): boolean {
  return visit.status === 'Waiting'
}

/** Waiting, in consult, or any open order for this visit */
export function isVisitPendingConsultation(visit: Visit): boolean {
  if (['Completed', 'Cancelled'].includes(visit.status)) return false
  if (visit.status === 'Waiting' || visit.status === 'In Consultation') return true
  if (hasBlockingOrders(visit.id)) return true
  if (visit.status === 'Lab Requested') return true
  return false
}

/** Doctor queue: consultation finished and no open orders */
export function isVisitCompletedConsultation(visit: Visit): boolean {
  if (visit.status === 'Completed') return true
  if (visit.status === 'Admitted') return false
  if (hasBlockingOrders(visit.id)) return false
  return visit.status === 'Completed Consultation'
}

export function isVisitDoneForDoctor(visit: Visit): boolean {
  return isVisitCompletedConsultation(visit)
}

export type PatientCareDisplayStatus = 'Active' | 'Inactive' | 'Waiting'

/** UI: Waiting → Waiting; released → Inactive; in doctor care → Active */
export function getPatientCareDisplayStatus(visit: Visit): PatientCareDisplayStatus {
  if (visit.status === 'Waiting') return 'Waiting'
  if (['Completed', 'Cancelled'].includes(visit.status)) return 'Inactive'
  return 'Active'
}

/** Doctor All Patients table — respects release (visit Completed + patient Inactive) */
export function getDoctorQueuePatientStatus(
  visit: Visit,
  patient?: Pick<Patient, 'status'>,
): PatientCareDisplayStatus {
  if (['Completed', 'Cancelled'].includes(visit.status)) return 'Inactive'
  if (patient?.status === 'Inactive') return 'Inactive'
  return getPatientCareDisplayStatus(visit)
}

/** Active queue filter — waiting or currently in doctor care (not released) */
export function isDoctorQueuePatientActive(
  visit: Visit,
  patient?: Pick<Patient, 'status'>,
): boolean {
  const status = getDoctorQueuePatientStatus(visit, patient)
  return status === 'Active' || status === 'Waiting'
}

export function getPatientCareDisplayStatusFromPatient(
  patient: Pick<Patient, 'id' | 'status'>,
): PatientCareDisplayStatus {
  const patientVisits = visits.filter((v) => v.patientId === patient.id)
  if (patientVisits.length === 0) return 'Inactive'

  const openVisits = patientVisits.filter((v) => !['Completed', 'Cancelled'].includes(v.status))
  if (openVisits.length === 0) return 'Inactive'

  const latest = [...openVisits].sort(
    (a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt),
  )[0]
  return getPatientCareDisplayStatus(latest)
}

/** Active = waiting; In Active = in doctor care; Inactive = released (all visits completed) */
export function syncPatientStatus(patientId: string): void {
  const patient = getPatientById(patientId)
  if (!patient) return

  const patientVisits = visits.filter((v) => v.patientId === patientId)
  if (patientVisits.length === 0) {
    patient.status = 'Active'
    return
  }

  const openVisits = patientVisits.filter((v) => !['Completed', 'Cancelled'].includes(v.status))
  if (openVisits.length === 0) {
    patient.status = 'Inactive'
    touchHmsStore()
    return
  }

  const inDoctorCare = openVisits.some((v) => {
    if (v.status !== 'Waiting') return true
    return clinicalNotes.some((n) => n.visitId === v.id && n.note.trim())
  })

  patient.status = inDoctorCare ? 'In Active' : 'Active'
  touchHmsStore()
}

export function reconcileAllPatientStatuses(): void {
  for (const patient of patients) {
    syncPatientStatus(patient.id)
  }
}

export function onNewVisitCreated(patientId: string): void {
  syncPatientStatus(patientId)
}

export function startConsultation(visit: Visit): void {
  if (visit.status === 'Waiting') {
    visit.status = 'In Consultation'
    touchVisit(visit)
  }
  syncPatientStatus(visit.patientId)
}

/** Derive visit.status from linked orders (prescription, lab, admission, surgery) */
export function recalculateVisitStatus(visit: Visit): void {
  if (['Completed', 'Cancelled'].includes(visit.status)) return

  const previous = visit.status

  if (hasActiveAdmissionForVisit(visit.id)) {
    visit.status = 'Admitted'
  } else if (hasPendingLabForVisit(visit.id)) {
    visit.status = 'Lab Requested'
  } else if (
    hasAwaitingPaymentLabForVisit(visit.id) ||
    hasPendingAdmissionForVisit(visit.id) ||
    hasUnpaidSurgeryForVisit(visit.id)
  ) {
    if (visit.status === 'Waiting') visit.status = 'In Consultation'
    else if (visit.status !== 'In Consultation') visit.status = 'In Consultation'
  } else {
    const hasNote = clinicalNotes.some((n) => n.visitId === visit.id && n.note.trim())
    if (hasNote) {
      visit.status = 'Completed Consultation'
    } else if (!['Waiting', 'In Consultation'].includes(visit.status)) {
      visit.status = 'In Consultation'
    }
  }

  if (visit.status !== previous) touchVisit(visit)
}

export function tryFinalizeVisit(_visit: Visit): void {
  // Visit completes only when doctor clicks Release — no auto-complete
}

export function refreshVisitWorkflow(visitId: string): void {
  const visit = getVisitById(visitId)
  if (!visit) return
  recalculateVisitStatus(visit)
  tryFinalizeVisit(visit)
  syncPatientStatus(visit.patientId)
}

/** @deprecated use refreshVisitWorkflow after lab save */
export function applyLabRequestVisitStatus(visit: Visit): void {
  refreshVisitWorkflow(visit.id)
}

export function finishVisit(visitId: string): boolean {
  const visit = getVisitById(visitId)
  if (!visit) return false
  if (hasBlockingOrders(visitId)) return false
  visit.status = 'Completed'
  touchVisit(visit)
  syncPatientStatus(visit.patientId)
  return true
}

/** Doctor confirms patient is released — visit Completed, patient no longer in doctor care (UI: Inactive) */
export function confirmDoctorPatientRelease(visitId: string): { ok: boolean; error?: string } {
  const releaseCheck = canDoctorReleasePatient(visitId)
  if (!releaseCheck.ok) return releaseCheck

  cancelOpenOrdersForVisitRelease(visitId)

  const visit = getVisitById(visitId)
  if (!visit) return { ok: false, error: 'Visit not found.' }

  visit.status = 'Completed'
  touchVisit(visit)

  const patient = getPatientById(visit.patientId)
  if (patient) {
    patient.status = 'Inactive'
    patient.lastModifiedAt = new Date().toISOString()
  }

  syncPatientStatus(visit.patientId)
  touchHmsStore()
  return { ok: true }
}

export function canDoctorCancelLabRequest(lab: LabRequest): boolean {
  return lab.status === 'Awaiting Payment' || lab.status === 'Pending'
}

export function cancelLabRequestByDoctor(
  labId: string,
  doctorId: string,
): { ok: boolean; error?: string } {
  const lab = labRequests.find((l) => l.id === labId)
  if (!lab) return { ok: false, error: 'Lab request not found.' }
  if (lab.doctorId !== doctorId) return { ok: false, error: 'Not your lab request.' }
  if (lab.status === 'Cancelled') return { ok: false, error: 'Already cancelled.' }
  if (!canDoctorCancelLabRequest(lab)) {
    return { ok: false, error: 'Lab is in progress or completed — cannot cancel.' }
  }
  lab.status = 'Cancelled'
  lab.cancelledAt = new Date().toISOString()
  lab.lastModifiedAt = lab.cancelledAt
  refreshVisitWorkflow(lab.visitId)
  touchHmsStore()
  return { ok: true }
}

export function canDoctorCancelAdmissionRequest(req: AdmissionRequest): boolean {
  return req.status === 'Pending'
}

export function cancelAdmissionRequestByDoctor(
  requestId: string,
  doctorId: string,
): { ok: boolean; error?: string } {
  const req = admissionRequests.find((r) => r.id === requestId)
  if (!req) return { ok: false, error: 'In-patient request not found.' }
  if (req.doctorId !== doctorId) return { ok: false, error: 'Not your in-patient request.' }
  if (!canDoctorCancelAdmissionRequest(req)) {
    return { ok: false, error: 'Cannot cancel — room already assigned or request processed.' }
  }
  req.status = 'Cancelled'
  refreshVisitWorkflow(req.visitId)
  touchHmsStore()
  return { ok: true }
}

export function canDoctorCancelSurgeryRequest(req: SurgeryRequest): boolean {
  return req.status === 'Pending' && !isSurgeryPaid(req)
}

export function cancelSurgeryRequestByDoctor(
  requestId: string,
  doctorId: string,
): { ok: boolean; error?: string } {
  const req = surgeryRequests.find((s) => s.id === requestId)
  if (!req) return { ok: false, error: 'Surgery request not found.' }
  if (req.doctorId !== doctorId) return { ok: false, error: 'Not your surgery request.' }
  if (req.status === 'Cancelled') return { ok: false, error: 'Already cancelled.' }
  if (!canDoctorCancelSurgeryRequest(req)) {
    return {
      ok: false,
      error: 'Surgery is paid, scheduled, or completed — contact reception to cancel.',
    }
  }
  req.status = 'Cancelled'
  refreshVisitWorkflow(req.visitId)
  touchHmsStore()
  return { ok: true }
}

export type PatientHistoryEntry = {
  visitId: string
  visitDate: string
  visitNumber: string
  status: VisitStatus
  notes: ClinicalNote[]
  diagnoses: Diagnosis[]
  prescriptions: Prescription[]
  labs: LabRequest[]
  surgeries: SurgeryRequest[]
  admissionRequests: AdmissionRequest[]
}

function buildPatientHistoryEntry(v: Visit): PatientHistoryEntry {
  return {
    visitId: v.id,
    visitDate: v.visitDate,
    visitNumber: v.visitNumber,
    status: v.status,
    notes: clinicalNotes.filter((n) => n.visitId === v.id),
    diagnoses: diagnoses.filter((d) => d.visitId === v.id),
    prescriptions: prescriptions.filter((p) => p.visitId === v.id),
    labs: labRequests.filter((l) => l.visitId === v.id),
    surgeries: surgeryRequests.filter((s) => s.visitId === v.id),
    admissionRequests: admissionRequests.filter((a) => a.visitId === v.id),
  }
}

function hasClinicalData(entry: PatientHistoryEntry): boolean {
  return (
    entry.notes.length > 0 ||
    entry.diagnoses.length > 0 ||
    entry.prescriptions.length > 0 ||
    entry.labs.length > 0 ||
    entry.surgeries.length > 0 ||
    entry.admissionRequests.length > 0
  )
}

/** All prior visits for this patient — labs, prescriptions, notes, etc. */
export function getPatientClinicalHistory(
  patientId: string,
  excludeVisitId?: string,
): PatientHistoryEntry[] {
  return visits
    .filter((v) => v.patientId === patientId && v.id !== excludeVisitId)
    .sort(
      (a, b) =>
        b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt),
    )
    .map(buildPatientHistoryEntry)
    .filter(hasClinicalData)
}

/** Prior visits with the same doctor — for returning patients */
export function getPatientHistoryForDoctor(
  patientId: string,
  doctorId: string,
  excludeVisitId?: string,
): PatientHistoryEntry[] {
  return visits
    .filter(
      (v) =>
        v.patientId === patientId &&
        v.assignedDoctorId === doctorId &&
        v.id !== excludeVisitId,
    )
    .sort(
      (a, b) =>
        b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt),
    )
    .map(buildPatientHistoryEntry)
    .filter(hasClinicalData)
}

export function getPatientStatusLabel(status: PatientStatus): string {
  return status
}

/** Discharge inpatient — free bed, complete visit, patient becomes Active (at home) */
export function dischargeAdmission(admissionId: string): boolean {
  const admission = getAdmissionById(admissionId)
  if (!admission || admission.status !== 'Active') return false

  admission.status = 'Discharged'
  admission.dischargedAt = new Date().toISOString().split('T')[0]

  const bedRecord = beds.find((b) => b.id === admission.bedId)
  if (bedRecord) {
    bedRecord.isOccupied = false
    bedRecord.patientId = undefined
    bedRecord.admissionId = undefined
  }

  const visit = getVisitById(admission.visitId)
  if (visit) {
    visit.status = 'Completed'
    touchVisit(visit)
  }
  syncPatientStatus(admission.patientId)
  touchHmsStore()
  return true
}
