import { getPatientById, getStaffById } from '@/shared/services/hmsStore'
import type { LabRequest } from '@/shared/types'
import type { LabResultReportData } from '@/features/laboratory/components/LabResultReportA4'

export function buildLabResultReportData(req: LabRequest): LabResultReportData | null {
  const patient = getPatientById(req.patientId)
  if (!patient) return null
  const doctor = getStaffById(req.doctorId)
  const referredDoctorName = doctor
    ? doctor.role === 'emergency'
      ? 'Emergency'
      : `Dr. ${doctor.firstName} ${doctor.lastName}`
    : '—'
  return {
    patientId: patient.id,
    patientName: patient.fullName,
    age: patient.age,
    gender: patient.gender,
    referredDoctorName,
    requestNumber: req.requestNumber,
    tests: req.tests,
    completedAt: req.completedAt ?? new Date().toISOString(),
  }
}

export function isLabPendingStatus(status: LabRequest['status']) {
  return status === 'Pending' || status === 'In Progress'
}
