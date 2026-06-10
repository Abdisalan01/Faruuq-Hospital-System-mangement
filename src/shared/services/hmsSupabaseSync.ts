import { isSupabaseConfigured } from '@/shared/lib/supabase'
import type { Patient } from '@/shared/types'
import type { HmsStoreSnapshot } from './hmsStore'
import {
  fetchHmsFromTables,
  fetchHmsMetaIfUpdated,
  saveHmsToTables,
  saveLabCatalogSnapshotToSupabase as persistLabCatalogToTables,
  saveMedicalCatalogSnapshotToSupabase as persistMedicalCatalogToTables,
  saveRoomsBedsSnapshotToSupabase as persistRoomsBedsToTables,
  saveSurgeryCatalogSnapshotToSupabase as persistSurgeryCatalogToTables,
  saveDoctorConsultationSnapshotToSupabase as persistDoctorConsultationToTables,
  saveLabFeePaymentSnapshotToSupabase as persistLabFeePaymentToTables,
  saveLabRequestSnapshotToSupabase as persistLabRequestToTables,
  saveInpatientPaymentSnapshotToSupabase as persistInpatientPaymentToTables,
  savePatientDiscountSnapshotToSupabase as persistPatientDiscountToTables,
  saveSurgeryFeePaymentSnapshotToSupabase as persistSurgeryFeePaymentToTables,
  savePatientProfileToSupabase,
  saveRegistrationSnapshotToSupabase,
  saveStaffUsersToSupabase,
  saveSystemSettingsSnapshotToSupabase as persistSystemSettingsToTables,
  saveRegistrationFeesSnapshotToSupabase as persistRegistrationFeesToTables,
  saveAdmissionAssignmentSnapshotToSupabase as persistAdmissionAssignmentToTables,
  saveEmergencyCaseSnapshotToSupabase as persistEmergencyCaseToTables,
  savePharmacyDispenseSnapshotToSupabase as persistPharmacyDispenseToTables,
  saveInpatientMedicinePaymentSnapshotToSupabase as persistInpatientMedicinePaymentToTables,
  savePrescriptionSnapshotToSupabase as persistPrescriptionToTables,
  saveCreditPaymentSnapshotToSupabase as persistCreditPaymentToTables,
  saveSupplyRequestSnapshotToSupabase as persistSupplyRequestToTables,
  saveFullMirrorSnapshotToSupabase as persistFullMirrorToTables,
} from './hmsSupabaseTables'

export function isSupabaseBackendEnabled(): boolean {
  return isSupabaseConfigured
}

export async function fetchHmsSnapshotFromSupabase(): Promise<HmsStoreSnapshot | null> {
  if (!isSupabaseConfigured) return null
  const result = await fetchHmsFromTables()
  return result?.snapshot ?? null
}

export async function fetchHmsWithMetaFromSupabase(): Promise<{
  snapshot: HmsStoreSnapshot
  updatedAt: string
} | null> {
  if (!isSupabaseConfigured) return null
  return fetchHmsFromTables()
}

export async function pollHmsSnapshotFromSupabase(
  sinceUpdatedAt: string | null,
): Promise<{ updatedAt: string; snapshot: HmsStoreSnapshot } | null> {
  if (!isSupabaseConfigured) return null
  return fetchHmsMetaIfUpdated(sinceUpdatedAt)
}

export async function saveHmsSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string | void> {
  if (!isSupabaseConfigured) return
  return saveHmsToTables(snapshot)
}

/** Faster path for user create/edit — avoids extra table scans */
export async function saveStaffSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return saveStaffUsersToSupabase(snapshot)
}

/** Fast path for patient register / edit — patients, visits, payments, receipts */
export async function savePatientsSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return saveRegistrationSnapshotToSupabase(snapshot)
}

/** Fast path for lab tests catalog — tests table + Test ID settings in meta */
export async function saveLabCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistLabCatalogToTables(snapshot)
}

/** Fast path for medical catalog — medicines + inventory tables + meta */
export async function saveMedicalCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistMedicalCatalogToTables(snapshot)
}

/** Fast path for surgery catalog */
export async function saveSurgeryCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistSurgeryCatalogToTables(snapshot)
}

/** Fast path for wards, rooms, and beds */
export async function saveRoomsBedsSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistRoomsBedsToTables(snapshot)
}

/** Fast path for doctor consultation — notes, prescriptions, labs, surgery, admissions, nurse orders */
export async function saveDoctorConsultationSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  focus?: { visitId?: string; patientId?: string },
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistDoctorConsultationToTables(snapshot, focus)
}

/** Direct single-patient profile save (Edit Patient → Update existing record) */
export async function savePatientProfileSnapshotToSupabase(patient: Patient): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return savePatientProfileToSupabase(patient)
}

/** Fast path for admin discount limits and system settings */
export async function saveSystemSettingsSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistSystemSettingsToTables(snapshot)
}

/** Fast path for registration / patient number fees (per-doctor serviceFee + defaults) */
export async function saveRegistrationFeesSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistRegistrationFeesToTables(snapshot)
}

/** Fast path for reception lab fee payment collection */
export async function saveLabFeePaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  labRequestId: string,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistLabFeePaymentToTables(snapshot, labRequestId)
}

/** Fast path for lab workflow status updates */
export async function saveLabRequestSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  labRequestId: string,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistLabRequestToTables(snapshot, labRequestId)
}

/** Fast path for reception surgery fee payment collection */
export async function saveSurgeryFeePaymentSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistSurgeryFeePaymentToTables(snapshot)
}

/** Fast path for inpatient charge / checkout payment collection */
export async function saveInpatientPaymentSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistInpatientPaymentToTables(snapshot)
}

/** Fast path for patient discount collection */
export async function savePatientDiscountSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistPatientDiscountToTables(snapshot)
}

export async function saveAdmissionAssignmentSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistAdmissionAssignmentToTables(snapshot)
}

export async function saveEmergencyCaseSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistEmergencyCaseToTables(snapshot)
}

export async function savePharmacyDispenseSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistPharmacyDispenseToTables(snapshot)
}

export async function saveInpatientMedicinePaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistInpatientMedicinePaymentToTables(snapshot)
}

export async function savePrescriptionSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistPrescriptionToTables(snapshot)
}

export async function saveCreditPaymentSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistCreditPaymentToTables(snapshot)
}

export async function saveSupplyRequestSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistSupplyRequestToTables(snapshot)
}

export async function saveFullMirrorSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  return persistFullMirrorToTables(snapshot)
}
