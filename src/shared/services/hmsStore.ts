import type {
  AccountTransaction,
  Admission,
  AdmissionRequest,
  InpatientChargeRow,
  InpatientUnpaidAlert,
  Bed,
  ChargeType,
  ClinicalNote,
  Department,
  Diagnosis,
  Discount,
  DoctorOrder,
  DoctorOrderType,
  LabSupplyRequest,
  DepartmentSupplyRequest,
  PharmacySupplyRequest,
  SurgeryRequest,
  EmergencyCase,
  ExpenseRecord,
  IncomeRecord,
  InventoryItem,
  LabRequest,
  LabTestCatalog,
  LabTestCategory,
  LabTestItem,
  MedicineCatalogItem,
  MedicationAdministration,
  NursingNote,
  ObstetricDelivery,
  ObstetricChildGender,
  DoctorCommissionPayout,
  DoctorFinancialReport,
  Patient,
  PatientAccount,
  PatientHistoryEntry,
  PatientHistoryPaymentStatus,
  PatientHistorySummary,
  PatientDiscount,
  PatientDiscountFeeType,
  DiscountLimitsSettings,
  Payment,
  Prescription,
  PrescriptionItem,
  InpatientMedicinePaymentStatus,
  ReceptionReceipt,
  Room,
  StaffUser,
  StockTransaction,
  SurgeryCatalog,
  SurgeryCategory,
  AnesthesiaType,
  SurgeryRiskLevel,
  SystemSettings,
  Visit,
  Ward,
} from '@/shared/types'
import type { UserRole } from '@/shared/types/roles'

import {
  beginFastSave,
  clearHmsLocalStorage,
  clearPendingPersist,
  createPersistableArray,
  endFastSave,
  createPersistableObject,
  flushPersist,
  flushPersistAsync,
  HMS_STORE_VERSION,
  loadHmsStoreSnapshot,
  registerHmsStorePersistence,
  registerSupabasePersistHandler,
  schedulePersist,
} from './hmsStorePersistence'
import {
  createEmptyHmsSnapshot,
  DEFAULT_SYSTEM_SETTINGS,
  mergeSystemSettingsDeep,
  ensureBootstrapStaffInSnapshot,
  EMPTY_ACCOUNT_TRANSACTIONS,
  EMPTY_ADMISSION_REQUESTS,
  EMPTY_ADMISSIONS,
  EMPTY_BEDS,
  EMPTY_CLINICAL_NOTES,
  EMPTY_DEPARTMENT_SUPPLY_REQUESTS,
  EMPTY_DEPARTMENTS,
  EMPTY_DIAGNOSES,
  EMPTY_DISCOUNTS,
  EMPTY_DOCTOR_ORDERS,
  EMPTY_DOCTOR_COMMISSION_PAYOUTS,
  EMPTY_EMERGENCY_CASES,
  EMPTY_EXPENSE_RECORDS,
  EMPTY_INCOME_RECORDS,
  EMPTY_INVENTORY_ITEMS,
  EMPTY_LAB_REQUESTS,
  EMPTY_LAB_SUPPLY_REQUESTS,
  EMPTY_LAB_TEST_CATALOG,
  EMPTY_MEDICATION_ADMINISTRATIONS,
  EMPTY_MEDICINE_CATALOG,
  EMPTY_NURSING_NOTES,
  EMPTY_PATIENT_ACCOUNTS,
  EMPTY_PATIENT_DISCOUNTS,
  EMPTY_OBSTETRIC_DELIVERIES,
  EMPTY_PATIENTS,
  EMPTY_PAYMENTS,
  EMPTY_PHARMACY_SUPPLY_REQUESTS,
  EMPTY_PRESCRIPTIONS,
  EMPTY_RECEPTION_RECEIPTS,
  EMPTY_ROOMS,
  EMPTY_STAFF_USERS,
  EMPTY_STOCK_TRANSACTIONS,
  EMPTY_SURGERY_CATALOG,
  EMPTY_SURGERY_REQUESTS,
  EMPTY_VISITS,
  EMPTY_WARDS,
} from './hmsEmptyState'
import { isSupabaseConfigured } from '@/shared/lib/supabase'
import {
  saveDoctorConsultationSnapshotToSupabase,
  saveLabCatalogSnapshotToSupabase,
  saveLabFeePaymentSnapshotToSupabase,
  saveLabRequestSnapshotToSupabase,
  savePatientReleaseSnapshotToSupabase,
  saveInpatientPaymentSnapshotToSupabase,
  savePatientDiscountSnapshotToSupabase,
  saveSurgeryFeePaymentSnapshotToSupabase,
  saveMedicalCatalogSnapshotToSupabase,
  saveRoomsBedsSnapshotToSupabase,
  saveSurgeryCatalogSnapshotToSupabase,
  savePatientProfileSnapshotToSupabase,
  savePatientsSnapshotToSupabase,
  saveStaffSnapshotToSupabase,
  saveSystemSettingsSnapshotToSupabase,
  saveRegistrationFeesSnapshotToSupabase,
  saveAdmissionAssignmentSnapshotToSupabase,
  saveEmergencyCaseSnapshotToSupabase,
  savePharmacyDispenseSnapshotToSupabase,
  saveInpatientMedicinePaymentSnapshotToSupabase,
  savePrescriptionSnapshotToSupabase,
  saveCreditPaymentSnapshotToSupabase,
  saveSupplyRequestSnapshotToSupabase,
  saveFullMirrorSnapshotToSupabase,
  saveObstetricDeliverySnapshotToSupabase,
  saveDoctorCommissionPayoutSnapshotToSupabase,
} from './hmsSupabaseSync'
import { normalizeStaffUserEmail } from './passwordUtils'

import { todayIsoLocal } from '@/shared/utils/dateUtils'

const now = () => new Date().toISOString()
const today = () => todayIsoLocal()

let hmsStoreRevision = 0
let onSupabaseSaved: ((savedAt: string) => void) | null = null
let onStoreChanged: (() => void) | null = null

/** HmsStoreContext uses this to avoid poll overwriting a just-saved write */
export function registerSupabaseSaveNotifier(fn: (savedAt: string) => void): void {
  onSupabaseSaved = fn
}

/** React dashboards re-render when in-memory store mutates (cancel lab, etc.) */
export function registerStoreChangeNotifier(fn: () => void): void {
  onStoreChanged = fn
}

/** Bumps when snapshot is applied from Supabase — use to trigger UI refresh */
export function getHmsStoreRevision(): number {
  return hmsStoreRevision
}

let idCounter = 100

const SKIP_PERSIST_ID_PREFIXES = new Set(['staff', 'pat', 'vis', 'pay', 'inc', 'rcpt'])

export function generateId(prefix: string): string {
  idCounter += 1
  if (!SKIP_PERSIST_ID_PREFIXES.has(prefix)) schedulePersist()
  return `${prefix}-${String(idCounter).padStart(4, '0')}`
}

export function generateNumber(prefix: string): string {
  const num = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}${num}`
}

export function formatMedicineCode(number: number): string {
  const prefix = systemSettings.medicineCodePrefix.trim().toUpperCase() || 'MED'
  const pad = Math.max(1, systemSettings.medicineCodePadLength || 3)
  return `${prefix}-${String(number).padStart(pad, '0')}`
}

export function peekNextMedicineCode(): string {
  return formatMedicineCode(systemSettings.medicineCodeNextNumber)
}

export function generateMedicineCode(): string {
  syncMedicineCodeCounterFromCatalog()
  const code = formatMedicineCode(systemSettings.medicineCodeNextNumber)
  systemSettings.medicineCodeNextNumber += 1
  return code
}

export function syncMedicineCodeCounterFromCatalog(): void {
  const prefix = systemSettings.medicineCodePrefix.trim().toUpperCase() || 'MED'
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}-(\\d+)$`, 'i')
  let max = systemSettings.medicineCodeStartNumber - 1

  for (const item of medicineCatalog) {
    const match = item.medicineId.match(pattern)
    if (match) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }

  systemSettings.medicineCodeNextNumber = Math.max(systemSettings.medicineCodeNextNumber, max + 1)
}

export function updateMedicineCodeSettings(prefix: string, startNumber: number): void {
  systemSettings.medicineCodePrefix = prefix.trim().toUpperCase() || 'MED'
  systemSettings.medicineCodeStartNumber = Math.max(1, startNumber)
  syncMedicineCodeCounterFromCatalog()
  systemSettings.medicineCodeNextNumber = Math.max(
    systemSettings.medicineCodeNextNumber,
    systemSettings.medicineCodeStartNumber,
  )
}

export function formatLabTestCode(number: number): string {
  const prefix = systemSettings.labTestCodePrefix.trim().toUpperCase() || 'LAB'
  const pad = Math.max(1, systemSettings.labTestCodePadLength || 3)
  return `${prefix}-${String(number).padStart(pad, '0')}`
}

export function peekNextLabTestCode(): string {
  return formatLabTestCode(systemSettings.labTestCodeNextNumber)
}

export function generateLabTestCode(): string {
  syncLabTestCodeCounterFromCatalog()
  const code = formatLabTestCode(systemSettings.labTestCodeNextNumber)
  systemSettings.labTestCodeNextNumber += 1
  return code
}

export function syncLabTestCodeCounterFromCatalog(): void {
  const prefix = systemSettings.labTestCodePrefix.trim().toUpperCase() || 'LAB'
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}-(\\d+)$`, 'i')
  let max = systemSettings.labTestCodeStartNumber - 1

  for (const item of labTestCatalog) {
    const match = item.testId.match(pattern)
    if (match) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }

  systemSettings.labTestCodeNextNumber = Math.max(systemSettings.labTestCodeNextNumber, max + 1)
}

export function updateLabTestCodeSettings(prefix: string, startNumber: number): void {
  systemSettings.labTestCodePrefix = prefix.trim().toUpperCase() || 'LAB'
  systemSettings.labTestCodeStartNumber = Math.max(1, startNumber)
  syncLabTestCodeCounterFromCatalog()
  systemSettings.labTestCodeNextNumber = Math.max(
    systemSettings.labTestCodeNextNumber,
    systemSettings.labTestCodeStartNumber,
  )
  schedulePersist()
}

export function getLabTestByTestId(testId: string): LabTestCatalog | undefined {
  return labTestCatalog.find((t) => t.testId.toLowerCase() === testId.toLowerCase())
}

export function getActiveLabTests(category?: LabTestCategory): LabTestCatalog[] {
  return labTestCatalog
    .filter((t) => t.isActive && (category == null || t.category === category))
    .sort((a, b) => a.category.localeCompare(b.category) || a.testName.localeCompare(b.testName))
}

function normalizeLabTestCatalogItem(item: LabTestCatalog): LabTestCatalog {
  const unitReference =
    item.unitReference?.trim() ||
    item.normalRange?.trim() ||
    item.unit?.trim() ||
    undefined
  return {
    ...item,
    unitReference,
    isActive: item.isActive ?? true,
  }
}

export function saveLabTestCatalogEntry(
  data: {
    id?: string
    testId: string
    testName: string
    category: LabTestCategory
    price: number
    isActive?: boolean
    unitReference?: string
  },
): LabTestCatalog {
  const testId = data.testId.trim() || generateLabTestCode()
  const testName = data.testName.trim()
  if (!testName) throw new Error('Test name is required')
  if (data.price < 0 || Number.isNaN(data.price)) throw new Error('Price must be a valid non-negative number')

  const duplicateId = labTestCatalog.find(
    (t) => t.testId.toLowerCase() === testId.toLowerCase() && t.id !== data.id,
  )
  if (duplicateId) throw new Error(`Test ID "${testId}" already exists`)

  const unitReference = data.unitReference?.trim() || undefined
  const now = new Date().toISOString()

  if (data.id) {
    const existing = labTestCatalog.find((t) => t.id === data.id)
    if (existing) {
      existing.testId = testId
      existing.testName = testName
      existing.category = data.category
      existing.price = data.price
      existing.isActive = data.isActive ?? true
      existing.unitReference = unitReference
      existing.lastModifiedAt = now
      syncLabTestCodeCounterFromCatalog()
      schedulePersist()
      return existing
    }
  }

  const entry: LabTestCatalog = {
    id: generateId('ltc'),
    testId,
    testName,
    category: data.category,
    price: data.price,
    isActive: data.isActive ?? true,
    unitReference,
    createdAt: now.split('T')[0],
    lastModifiedAt: now,
  }
  labTestCatalog.push(entry)
  syncLabTestCodeCounterFromCatalog()
  schedulePersist()
  return entry
}

export function deleteLabTestCatalogEntry(id: string): void {
  const index = labTestCatalog.findIndex((t) => t.id === id)
  if (index < 0) throw new Error('Lab test not found')
  labTestCatalog.splice(index, 1)
  syncLabTestCodeCounterFromCatalog()
  hmsStoreRevision += 1
  schedulePersist()
}

export function formatSurgeryCode(number: number): string {
  const prefix = systemSettings.surgeryCodePrefix.trim().toUpperCase() || 'SUR'
  const pad = Math.max(1, systemSettings.surgeryCodePadLength || 3)
  return `${prefix}-${String(number).padStart(pad, '0')}`
}

export function peekNextSurgeryCode(): string {
  return formatSurgeryCode(systemSettings.surgeryCodeNextNumber)
}

export function generateSurgeryCode(): string {
  syncSurgeryCodeCounterFromCatalog()
  const code = formatSurgeryCode(systemSettings.surgeryCodeNextNumber)
  systemSettings.surgeryCodeNextNumber += 1
  return code
}

export function syncSurgeryCodeCounterFromCatalog(): void {
  const prefix = systemSettings.surgeryCodePrefix.trim().toUpperCase() || 'SUR'
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}-(\\d+)$`, 'i')
  let max = systemSettings.surgeryCodeStartNumber - 1

  for (const item of surgeryCatalog) {
    const match = item.surgeryId.match(pattern)
    if (match) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }

  systemSettings.surgeryCodeNextNumber = Math.max(systemSettings.surgeryCodeNextNumber, max + 1)
}

export function updateSurgeryCodeSettings(prefix: string, startNumber: number): void {
  systemSettings.surgeryCodePrefix = prefix.trim().toUpperCase() || 'SUR'
  systemSettings.surgeryCodeStartNumber = Math.max(1, startNumber)
  syncSurgeryCodeCounterFromCatalog()
  systemSettings.surgeryCodeNextNumber = Math.max(
    systemSettings.surgeryCodeNextNumber,
    systemSettings.surgeryCodeStartNumber,
  )
}

export function getSurgeryBySurgeryId(surgeryId: string): SurgeryCatalog | undefined {
  return surgeryCatalog.find((s) => s.surgeryId.toLowerCase() === surgeryId.toLowerCase())
}

export function getActiveSurgeries(category?: SurgeryCategory): SurgeryCatalog[] {
  return surgeryCatalog
    .filter((s) => s.isActive && (category == null || s.category === category))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export function saveSurgeryCatalogEntry(
  data: {
    id?: string
    surgeryId: string
    name: string
    category: SurgeryCategory
    price: number
    isActive: boolean
    duration?: string
    anesthesiaType?: AnesthesiaType
    riskLevel?: SurgeryRiskLevel
    description?: string
    requiredEquipment?: string
    preOpInstructions?: string
    postOpCare?: string
  },
): SurgeryCatalog {
  const surgeryId = data.surgeryId.trim() || generateSurgeryCode()
  const name = data.name.trim()
  if (!name) throw new Error('Surgery name is required')

  const duplicateId = surgeryCatalog.find(
    (s) => s.surgeryId.toLowerCase() === surgeryId.toLowerCase() && s.id !== data.id,
  )
  if (duplicateId) throw new Error(`Surgery ID "${surgeryId}" already exists`)

  const now = new Date().toISOString()

  if (data.id) {
    const existing = surgeryCatalog.find((s) => s.id === data.id)
    if (existing) {
      existing.surgeryId = surgeryId
      existing.name = name
      existing.category = data.category
      existing.price = data.price
      existing.isActive = data.isActive
      existing.duration = data.duration?.trim() || undefined
      existing.anesthesiaType = data.anesthesiaType
      existing.riskLevel = data.riskLevel
      existing.description = data.description?.trim() || undefined
      existing.requiredEquipment = data.requiredEquipment?.trim() || undefined
      existing.preOpInstructions = data.preOpInstructions?.trim() || undefined
      existing.postOpCare = data.postOpCare?.trim() || undefined
      existing.lastModifiedAt = now
      syncSurgeryCodeCounterFromCatalog()
      schedulePersist()
      return existing
    }
  }

  const entry: SurgeryCatalog = {
    id: generateId('surg'),
    surgeryId,
    name,
    category: data.category,
    price: data.price,
    isActive: data.isActive,
    duration: data.duration?.trim() || undefined,
    anesthesiaType: data.anesthesiaType,
    riskLevel: data.riskLevel,
    description: data.description?.trim() || undefined,
    requiredEquipment: data.requiredEquipment?.trim() || undefined,
    preOpInstructions: data.preOpInstructions?.trim() || undefined,
    postOpCare: data.postOpCare?.trim() || undefined,
    createdAt: now.split('T')[0],
    lastModifiedAt: now,
  }
  surgeryCatalog.push(entry)
  syncSurgeryCodeCounterFromCatalog()
  schedulePersist()
  return entry
}

export function deleteSurgeryCatalogEntry(id: string): void {
  const item = surgeryCatalog.find((s) => s.id === id)
  if (!item) throw new Error('Surgery not found')
  const index = surgeryCatalog.findIndex((s) => s.id === id)
  if (index >= 0) surgeryCatalog.splice(index, 1)
  syncSurgeryCodeCounterFromCatalog()
  hmsStoreRevision += 1
  schedulePersist()
}

export function getMedicineCatalogByMedicineId(medicineId: string): MedicineCatalogItem | undefined {
  return medicineCatalog.find((m) => m.medicineId.toLowerCase() === medicineId.toLowerCase())
}

export function getInventoryForMedicine(catalogItem: MedicineCatalogItem): InventoryItem | undefined {
  return (
    inventoryItems.find((i) => i.medicineId?.toLowerCase() === catalogItem.medicineId.toLowerCase()) ??
    inventoryItems.find((i) => i.name.toLowerCase() === catalogItem.name.toLowerCase())
  )
}

export function deriveMedicineActiveStatus(quantity: number): boolean {
  return quantity > 0
}

export function syncMedicineActiveStatus(catalogItem: MedicineCatalogItem): void {
  const stock = getInventoryForMedicine(catalogItem)
  catalogItem.isActive = deriveMedicineActiveStatus(stock?.quantity ?? 0)
}

export function syncAllMedicineActiveStatuses(): void {
  for (const item of medicineCatalog) {
    syncMedicineActiveStatus(item)
  }
}

export type SaveMedicineCatalogInput = {
  id?: string
  name: string
  unit: string
  category: string
  strength?: string
  purchasePrice?: number
  sellingPrice: number
  quantityInStock: number
  reorderLevel: number
  medicineId?: string
}

export function saveMedicineCatalogEntry(
  input: SaveMedicineCatalogInput,
  options?: { skipSchedulePersist?: boolean },
): MedicineCatalogItem {
  const trimmedName = input.name.trim()
  if (!trimmedName) throw new Error('Medicine name is required')

  const byId = input.id ? medicineCatalog.find((m) => m.id === input.id) : undefined
  const code =
    input.medicineId?.trim() ||
    byId?.medicineId ||
    medicineCatalog.find((m) => m.name.toLowerCase() === trimmedName.toLowerCase())?.medicineId ||
    generateMedicineCode()

  let catalog =
    byId ??
    getMedicineCatalogByMedicineId(code) ??
    medicineCatalog.find((m) => m.name.toLowerCase() === trimmedName.toLowerCase())

  const duplicateCode = medicineCatalog.find(
    (m) => m.medicineId.toLowerCase() === code.toLowerCase() && m.id !== catalog?.id,
  )
  if (duplicateCode) throw new Error(`Medicine code "${code}" already exists`)

  const isActive = deriveMedicineActiveStatus(input.quantityInStock)
  const now = new Date().toISOString()

  if (catalog) {
    catalog.medicineId = code
    catalog.name = trimmedName
    catalog.unit = input.unit
    catalog.strength = input.strength
    catalog.price = input.sellingPrice
    catalog.purchasePrice = input.purchasePrice
    catalog.category = input.category
    catalog.isActive = isActive
    catalog.lastModifiedAt = now
  } else {
    catalog = {
      id: generateId('med'),
      medicineId: code,
      name: trimmedName,
      unit: input.unit,
      strength: input.strength,
      price: input.sellingPrice,
      purchasePrice: input.purchasePrice,
      category: input.category,
      isActive,
      createdAt: now.split('T')[0],
      lastModifiedAt: now,
    }
    medicineCatalog.push(catalog)
  }

  let stock = getInventoryForMedicine(catalog)
  if (stock) {
    stock.name = trimmedName
    stock.medicineId = code
    stock.category = input.category
    stock.unit = input.unit
    stock.quantity = input.quantityInStock
    stock.reorderLevel = input.reorderLevel
    stock.unitPrice = input.sellingPrice
    stock.purchasePrice = input.purchasePrice
    stock.lastModifiedAt = now
  } else {
    inventoryItems.push({
      id: generateId('inv'),
      name: trimmedName,
      medicineId: code,
      category: input.category,
      unit: input.unit,
      quantity: input.quantityInStock,
      reorderLevel: input.reorderLevel,
      unitPrice: input.sellingPrice,
      purchasePrice: input.purchasePrice,
      createdAt: now.split('T')[0],
      lastModifiedAt: now,
    })
  }

  syncMedicineActiveStatus(catalog)
  if (!options?.skipSchedulePersist) schedulePersist()
  return catalog
}

export function deleteMedicineCatalogEntry(
  id: string,
  options?: { skipSchedulePersist?: boolean },
): void {
  const catalog = medicineCatalog.find((m) => m.id === id)
  if (!catalog) throw new Error('Medicine not found')

  const medIndex = medicineCatalog.findIndex((m) => m.id === id)
  if (medIndex >= 0) medicineCatalog.splice(medIndex, 1)

  const stock = getInventoryForMedicine(catalog)
  if (stock) {
    const invIndex = inventoryItems.findIndex((i) => i.id === stock.id)
    if (invIndex >= 0) inventoryItems.splice(invIndex, 1)
  }

  hmsStoreRevision += 1
  if (!options?.skipSchedulePersist) schedulePersist()
}

export type RestockMedicineInput = {
  medicineId: string
  addQuantity: number
  purchasePrice?: number
  sellingPrice?: number
  reorderLevel?: number
}

export function restockMedicine(
  input: RestockMedicineInput,
  options?: { skipSchedulePersist?: boolean },
): MedicineCatalogItem | undefined {
  const catalog = getMedicineCatalogByMedicineId(input.medicineId)
  if (!catalog || input.addQuantity <= 0) return undefined

  const stock = getInventoryForMedicine(catalog)
  if (!stock) return undefined

  stock.quantity += input.addQuantity
  if (input.purchasePrice != null) {
    stock.purchasePrice = input.purchasePrice
    catalog.purchasePrice = input.purchasePrice
  }
  if (input.sellingPrice != null) {
    stock.unitPrice = input.sellingPrice
    catalog.price = input.sellingPrice
  }
  if (input.reorderLevel != null) {
    stock.reorderLevel = input.reorderLevel
  }

  syncMedicineActiveStatus(catalog)
  if (!options?.skipSchedulePersist) schedulePersist()
  return catalog
}

export function syncMedicineStatusForInventoryItem(inventoryItem: InventoryItem): void {
  const catalog =
    (inventoryItem.medicineId ? getMedicineCatalogByMedicineId(inventoryItem.medicineId) : undefined) ??
    medicineCatalog.find((m) => m.name.toLowerCase() === inventoryItem.name.toLowerCase())

  if (catalog) {
    syncMedicineActiveStatus(catalog)
  }
}

// ─── Initial state (empty — all data from Supabase backend tables) ───────────

export let departments: Department[] = [...EMPTY_DEPARTMENTS]
export let staffUsers: StaffUser[] = [...EMPTY_STAFF_USERS]
export let patients: Patient[] = [...EMPTY_PATIENTS]
export let patientAccounts: PatientAccount[] = [...EMPTY_PATIENT_ACCOUNTS]
export let accountTransactions: AccountTransaction[] = [...EMPTY_ACCOUNT_TRANSACTIONS]
export let receptionReceipts: ReceptionReceipt[] = [...EMPTY_RECEPTION_RECEIPTS]
export let visits: Visit[] = [...EMPTY_VISITS]
export let clinicalNotes: ClinicalNote[] = [...EMPTY_CLINICAL_NOTES]
export let diagnoses: Diagnosis[] = [...EMPTY_DIAGNOSES]
export let prescriptions: Prescription[] = [...EMPTY_PRESCRIPTIONS]
export let labRequests: LabRequest[] = [...EMPTY_LAB_REQUESTS]
export let surgeryRequests: SurgeryRequest[] = [...EMPTY_SURGERY_REQUESTS]
export let departmentSupplyRequests: DepartmentSupplyRequest[] = [...EMPTY_DEPARTMENT_SUPPLY_REQUESTS]

/** @deprecated Use departmentSupplyRequests */
export let pharmacySupplyRequests: PharmacySupplyRequest[] = [...EMPTY_PHARMACY_SUPPLY_REQUESTS]

/** @deprecated Use departmentSupplyRequests */
export let labSupplyRequests: LabSupplyRequest[] = [...EMPTY_LAB_SUPPLY_REQUESTS]

export let admissionRequests: AdmissionRequest[] = [...EMPTY_ADMISSION_REQUESTS]
export let wards: Ward[] = [...EMPTY_WARDS]
export let rooms: Room[] = [...EMPTY_ROOMS]
export let beds: Bed[] = [...EMPTY_BEDS]
export let labTestCatalog: LabTestCatalog[] = [...EMPTY_LAB_TEST_CATALOG]
export let medicineCatalog: MedicineCatalogItem[] = [...EMPTY_MEDICINE_CATALOG]
export let surgeryCatalog: SurgeryCatalog[] = [...EMPTY_SURGERY_CATALOG]
export let discounts: Discount[] = [...EMPTY_DISCOUNTS]
export let patientDiscounts: PatientDiscount[] = [...EMPTY_PATIENT_DISCOUNTS]
export let obstetricDeliveries: ObstetricDelivery[] = [...EMPTY_OBSTETRIC_DELIVERIES]
export let doctorCommissionPayouts: DoctorCommissionPayout[] = [...EMPTY_DOCTOR_COMMISSION_PAYOUTS]
export let admissions: Admission[] = [...EMPTY_ADMISSIONS]
export let medicationAdministrations: MedicationAdministration[] = [...EMPTY_MEDICATION_ADMINISTRATIONS]
export let nursingNotes: NursingNote[] = [...EMPTY_NURSING_NOTES]
export let doctorOrders: DoctorOrder[] = [...EMPTY_DOCTOR_ORDERS]
export let inventoryItems: InventoryItem[] = [...EMPTY_INVENTORY_ITEMS]
export let stockTransactions: StockTransaction[] = [...EMPTY_STOCK_TRANSACTIONS]
export let payments: Payment[] = [...EMPTY_PAYMENTS]
export let emergencyCases: EmergencyCase[] = [...EMPTY_EMERGENCY_CASES]
export let incomeRecords: IncomeRecord[] = [...EMPTY_INCOME_RECORDS]
export let expenseRecords: ExpenseRecord[] = [...EMPTY_EXPENSE_RECORDS]
export function clearPatientDataResetFlag(): void {
  delete systemSettings.patientDataClearedAt
  systemSettings.lastModifiedAt = now()
  schedulePersist()
}

export let systemSettings: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS)) as SystemSettings

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getStaffById(id: string): StaffUser | undefined {
  return staffUsers.find((s) => s.id === id)
}

export function getStaffByRole(role: UserRole): StaffUser[] {
  return staffUsers.filter((s) => s.role === role)
}

export function getDepartmentById(id: string): Department | undefined {
  return departments.find((d) => d.id === id)
}

export function getPatientById(id: string): Patient | undefined {
  return patients.find((p) => p.id === id)
}

export type PatientProfilePatch = Pick<Patient, 'fullName' | 'gender' | 'age' | 'phone' | 'address'>

/** Replace patient in store (ensures Supabase snapshot gets updated fields) */
export function updatePatientRecord(id: string, patch: PatientProfilePatch): Patient | undefined {
  const index = patients.findIndex((p) => p.id === id)
  if (index === -1) return undefined
  patients[index] = {
    ...patients[index],
    ...patch,
    lastModifiedAt: new Date().toISOString(),
  }
  hmsStoreRevision += 1
  return patients[index]
}

export function getVisitById(id: string): Visit | undefined {
  return visits.find((v) => v.id === id)
}

/** Most recent visit for a patient (registration / queue info) */
export function getLatestVisitForPatient(patientId: string): Visit | undefined {
  const patientVisits = visits.filter((v) => v.patientId === patientId)
  if (patientVisits.length === 0) return undefined
  return [...patientVisits].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Open (not released) visit — used for duplicate checks and queue display */
export function getLatestOpenVisitForPatient(patientId: string): Visit | undefined {
  const open = visits.filter(
    (v) => v.patientId === patientId && !['Completed', 'Cancelled'].includes(v.status),
  )
  if (open.length === 0) return undefined
  return [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Prefer open visit for UI; fall back to most recent completed visit */
export function getDisplayVisitForPatient(patientId: string): Visit | undefined {
  return getLatestOpenVisitForPatient(patientId) ?? getLatestVisitForPatient(patientId)
}

/** Pick one visit to represent a patient — open visit wins, else newest */
function pickRepresentativeVisitForPatient(patientVisits: Visit[]): Visit {
  const byNewest = [...patientVisits].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const open = byNewest.find((v) => !['Completed', 'Cancelled'].includes(v.status))
  return open ?? byNewest[0]
}

/** One row per patient ID — no duplicate patients in doctor lists */
function dedupeVisitsByPatient(visitList: Visit[]): Visit[] {
  const groups = new Map<string, Visit[]>()
  for (const visit of visitList) {
    const list = groups.get(visit.patientId) ?? []
    list.push(visit)
    groups.set(visit.patientId, list)
  }
  return Array.from(groups.values()).map(pickRepresentativeVisitForPatient)
}

function sortDoctorQueueVisits(a: Visit, b: Visit): number {
  const byDate = b.visitDate.localeCompare(a.visitDate)
  if (byDate !== 0) return byDate
  return (a.patientNumber ?? a.queueNumber) - (b.patientNumber ?? b.queueNumber)
}

export function getVisitsForDoctorToday(doctorId: string): Visit[] {
  const todayStr = today()
  const todayForDoctor = visits.filter(
    (v) => v.visitDate === todayStr && v.assignedDoctorId === doctorId,
  )
  return dedupeVisitsByPatient(todayForDoctor).sort(sortDoctorQueueVisits)
}

/** Doctor All Patients — one row per patient; today's queue + any open visit from prior days */
export function getDoctorPatientQueue(doctorId: string): Visit[] {
  const todayStr = today()
  const relevant = visits.filter((v) => {
    if (v.assignedDoctorId !== doctorId) return false
    if (v.visitDate === todayStr) return true
    return !['Completed', 'Cancelled'].includes(v.status)
  })

  return dedupeVisitsByPatient(relevant).sort(sortDoctorQueueVisits)
}

export function getActiveAdmissionsForDoctor(doctorId: string): Admission[] {
  return admissions.filter((a) => {
    if (a.status !== 'Active') return false
    const visit = getVisitById(a.visitId)
    return visit?.assignedDoctorId === doctorId
  })
}

/** Admissions where this doctor submitted the in-patient request */
export function getInpatientsForDoctor(doctorId: string): Admission[] {
  const doctorVisitIds = new Set(
    admissionRequests
      .filter((r) => r.doctorId === doctorId && r.status === 'Assigned')
      .map((r) => r.visitId),
  )
  return admissions
    .filter((a) => doctorVisitIds.has(a.visitId))
    .sort((a, b) => b.admittedAt.localeCompare(a.admittedAt))
}

export function getAllInpatientAdmissions(): Admission[] {
  return [...admissions].sort((a, b) => b.admittedAt.localeCompare(a.admittedAt))
}

export function getPendingAdmissionRequests(): AdmissionRequest[] {
  return admissionRequests
    .filter((r) => r.status === 'Pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAdmissionById(id: string): Admission | undefined {
  return admissions.find((a) => a.id === id)
}

export function getAdmissionForBed(bedId: string): Admission | undefined {
  const bed = beds.find((b) => b.id === bedId)
  if (!bed?.admissionId) return undefined
  return getAdmissionById(bed.admissionId)
}

export function getBedsInRoom(roomId: string): Bed[] {
  return beds.filter((b) => b.roomId === roomId)
}

/** True when an active admission holds this bed (source of truth over bed.isOccupied) */
export function isBedCurrentlyOccupied(bedId: string, excludeAdmissionId?: string): boolean {
  const heldByAdmission = admissions.some(
    (a) => a.bedId === bedId && a.status === 'Active' && a.id !== excludeAdmissionId,
  )
  if (heldByAdmission) return true
  const bed = beds.find((b) => b.id === bedId)
  return bed?.isOccupied ?? false
}

export function getAvailableBedsInRoom(roomId: string, excludeAdmissionId?: string): Bed[] {
  return getBedsInRoom(roomId).filter((b) => !isBedCurrentlyOccupied(b.id, excludeAdmissionId))
}

export function getAvailableBedCountInRoom(roomId: string, excludeAdmissionId?: string): number {
  return getAvailableBedsInRoom(roomId, excludeAdmissionId).length
}

/** Vacant beds plus the patient's current bed (for editing assignment) */
export function getSelectableBedsInRoom(
  roomId: string,
  currentBedId?: string,
  excludeAdmissionId?: string,
): Bed[] {
  return getBedsInRoom(roomId).filter(
    (b) => b.id === currentBedId || !isBedCurrentlyOccupied(b.id, excludeAdmissionId),
  )
}

/** Align bed flags with active admissions after load from database */
export function syncBedOccupancyFromAdmissions(): void {
  for (const bed of beds) {
    bed.isOccupied = false
    bed.patientId = undefined
    bed.admissionId = undefined
  }
  for (const adm of admissions) {
    if (adm.status !== 'Active') continue
    const bed = beds.find((b) => b.id === adm.bedId)
    if (!bed) continue
    bed.isOccupied = true
    bed.patientId = adm.patientId
    bed.admissionId = adm.id
  }
}

export function getAdmissionForRequest(req: AdmissionRequest): Admission | undefined {
  const activeForPatient = admissions.filter(
    (a) => a.patientId === req.patientId && a.status === 'Active',
  )
  const byVisit = activeForPatient.find((a) => a.visitId === req.visitId)
  if (byVisit) return byVisit
  if (req.bedId) {
    const byBed = activeForPatient.find((a) => a.bedId === req.bedId)
    if (byBed) return byBed
  }
  if (activeForPatient.length === 1) return activeForPatient[0]
  return activeForPatient.sort((a, b) => b.admittedAt.localeCompare(a.admittedAt))[0]
}

function releaseBedIfNoActiveAdmissions(bedId: string, exceptAdmissionId?: string): void {
  const stillUsed = admissions.some(
    (a) => a.status === 'Active' && a.bedId === bedId && a.id !== exceptAdmissionId,
  )
  if (stillUsed) return
  const bed = beds.find((b) => b.id === bedId)
  if (!bed) return
  bed.isOccupied = false
  bed.patientId = undefined
  bed.admissionId = undefined
}

/** Discharge after full payment when doctor already released the patient */
export function dischargeInpatientAfterFullPayment(admissionId: string): boolean {
  const adm = getAdmissionById(admissionId)
  if (!adm || adm.status !== 'Active') return false
  if (getInpatientOutstandingTotal(admissionId) > 0.001) return false

  const visit = getVisitById(adm.visitId)
  if (visit?.status !== 'Completed') return false

  adm.status = 'Discharged'
  adm.dischargedAt = adm.dischargedAt ?? today()
  adm.bookOpen = false
  releaseBedIfNoActiveAdmissions(adm.bedId, adm.id)
  touchHmsStore()
  return true
}

/** Heal assigned requests that have room/bed but no active admission record */
export function ensureAdmissionForAssignedRequest(req: AdmissionRequest): Admission | undefined {
  const existing = getAdmissionForRequest(req)
  if (existing) return existing
  if (req.status !== 'Assigned' || !req.roomId || !req.bedId) return undefined

  const bed = beds.find((b) => b.id === req.bedId && b.roomId === req.roomId)
  if (!bed) return undefined

  const billingMode = req.billingMode ?? 'credit_book'
  const admission: Admission = {
    id: generateId('adm'),
    patientId: req.patientId,
    visitId: req.visitId,
    wardId: bed.wardId,
    roomId: req.roomId,
    bedId: req.bedId,
    admittedAt: today(),
    status: 'Active',
    billingMode,
    bookOpen: billingMode === 'credit_book',
  }
  admissions.push(admission)
  bed.isOccupied = true
  bed.patientId = req.patientId
  bed.admissionId = admission.id

  const visit = getVisitById(req.visitId)
  if (visit) visit.status = 'Admitted'

  touchHmsStore()
  return admission
}

export function getAssignedAdmissionRequestForAdmission(
  admission: Admission,
): AdmissionRequest | undefined {
  return (
    admissionRequests.find(
      (r) => r.visitId === admission.visitId && r.status === 'Assigned',
    ) ??
    admissionRequests.find(
      (r) => r.patientId === admission.patientId && r.status === 'Assigned',
    )
  )
}

/** Edit room/bed from All Inpatients or In Patient Request */
export function updateInpatientRoomBedByAdmission(
  admissionId: string,
  roomId: string,
  bedId: string,
): { ok: boolean; error?: string; admission?: Admission } {
  const admission = getAdmissionById(admissionId)
  if (!admission || admission.status !== 'Active') {
    return { ok: false, error: 'Only active inpatients can be moved.' }
  }

  const req = getAssignedAdmissionRequestForAdmission(admission)
  if (req) {
    return updateAdmissionAssignment(req.id, roomId, bedId)
  }

  const newBed = beds.find((b) => b.id === bedId && b.roomId === roomId)
  if (!newBed) return { ok: false, error: 'Bed not found.' }
  if (isBedCurrentlyOccupied(bedId, admission.id) && newBed.id !== admission.bedId) {
    return { ok: false, error: 'Selected bed is already occupied.' }
  }

  if (admission.bedId !== bedId) {
    releaseBedIfNoActiveAdmissions(admission.bedId, admission.id)
    newBed.isOccupied = true
    newBed.patientId = admission.patientId
    newBed.admissionId = admission.id
  } else if (newBed.admissionId !== admission.id) {
    newBed.isOccupied = true
    newBed.patientId = admission.patientId
    newBed.admissionId = admission.id
  }

  admission.roomId = roomId
  admission.bedId = bedId
  admission.wardId = newBed.wardId
  admission.billingMode = 'credit_book'
  admission.bookOpen = true

  touchHmsStore()
  return { ok: true, admission }
}

export function updateAdmissionAssignment(
  requestId: string,
  roomId: string,
  bedId: string,
): { ok: boolean; error?: string; admission?: Admission } {
  const req = admissionRequests.find((r) => r.id === requestId)
  if (!req || req.status !== 'Assigned') {
    return { ok: false, error: 'Only assigned patients can be edited.' }
  }

  const admission = ensureAdmissionForAssignedRequest(req)
  if (!admission) {
    return { ok: false, error: 'Active admission not found for this patient.' }
  }

  const newBed = beds.find((b) => b.id === bedId && b.roomId === roomId)
  if (!newBed) return { ok: false, error: 'Bed not found.' }
  if (isBedCurrentlyOccupied(bedId, admission.id) && newBed.id !== admission.bedId) {
    return { ok: false, error: 'Selected bed is already occupied.' }
  }

  if (admission.bedId !== bedId) {
    releaseBedIfNoActiveAdmissions(admission.bedId, admission.id)
    newBed.isOccupied = true
    newBed.patientId = admission.patientId
    newBed.admissionId = admission.id
  } else if (newBed.admissionId !== admission.id) {
    newBed.isOccupied = true
    newBed.patientId = admission.patientId
    newBed.admissionId = admission.id
  }

  admission.roomId = roomId
  admission.bedId = bedId
  admission.wardId = newBed.wardId
  admission.billingMode = 'credit_book'
  admission.bookOpen = true

  req.roomId = roomId
  req.bedId = bedId
  req.billingMode = 'credit_book'

  touchHmsStore()
  return { ok: true, admission }
}

export function assignAdmissionRequest(
  requestId: string,
  roomId: string,
  bedId: string,
  receptionId: string,
): Admission {
  const req = admissionRequests.find((r) => r.id === requestId)
  if (!req || req.status !== 'Pending') throw new Error('Invalid request')

  const bed = beds.find((b) => b.id === bedId && b.roomId === roomId)
  if (!bed || isBedCurrentlyOccupied(bedId)) throw new Error('Bed not available')

  const admission: Admission = {
    id: generateId('adm'),
    patientId: req.patientId,
    visitId: req.visitId,
    wardId: bed.wardId,
    roomId,
    bedId,
    admittedAt: today(),
    status: 'Active',
    billingMode: 'credit_book',
    bookOpen: true,
  }
  admissions.push(admission)

  bed.isOccupied = true
  bed.patientId = req.patientId
  bed.admissionId = admission.id

  const visit = getVisitById(req.visitId)
  if (visit) visit.status = 'Admitted'

  req.status = 'Assigned'
  req.roomId = roomId
  req.bedId = bedId
  req.billingMode = 'credit_book'

  const now = new Date().toISOString()
  if (visit) {
    visit.lastModifiedAt = now
  }

  touchHmsStore()
  syncInpatientBedNightlyCharges(admission.id, receptionId)

  return admission
}

/** List calendar nights from admission date through end date (inclusive) */
function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function listAdmissionBedNights(admittedAt: string, endDate: string): string[] {
  const startKey = admittedAt.slice(0, 10)
  const endKey = endDate.slice(0, 10)
  const start = new Date(`${startKey}T12:00:00`)
  const end = new Date(`${endKey}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [startKey]

  const nights: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    nights.push(formatLocalDateKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return nights
}

function hasBedChargeForNight(admissionId: string, nightDate: string): boolean {
  const ref = `${admissionId}:${nightDate}`
  return accountTransactions.some(
    (t) =>
      t.admissionId === admissionId &&
      t.chargeType === 'Room' &&
      (t.referenceId === ref || t.description.includes(nightDate)),
  )
}

function bedChargeDisplayDate(tx: AccountTransaction): string {
  if (tx.referenceId?.includes(':')) {
    const night = tx.referenceId.split(':')[1]
    if (night && /^\d{4}-\d{2}-\d{2}$/.test(night)) return night
  }
  return tx.createdAt.split('T')[0]
}

/** Post one bed fee per night from assignment until today while patient remains active */
export function syncInpatientBedNightlyCharges(
  admissionId: string,
  createdBy = 'system',
): void {
  const adm = getAdmissionById(admissionId)
  if (!adm || adm.status !== 'Active') return

  const bed = beds.find((b) => b.id === adm.bedId)
  if (!bed) return

  const roomName = getRoomById(adm.roomId)?.name ?? 'Room'
  const nights = listAdmissionBedNights(adm.admittedAt, today())
  let posted = false

  nights.forEach((nightDate, index) => {
    if (hasBedChargeForNight(admissionId, nightDate)) return
    addAccountCharge(
      adm.patientId,
      bed.dailyRate,
      'Room',
      `Bed fee — ${roomName}, Bed ${bed.bedNumber} · Night ${index + 1} (${nightDate})`,
      adm.visitId,
      createdBy,
      {
        admissionId,
        settledAtCharge: false,
        referenceId: `${admissionId}:${nightDate}`,
        referenceType: 'bed',
        chargeDate: nightDate,
      },
    )
    posted = true
  })

  if (posted) touchHmsStore()
}

/** Add tonight's bed fee to credit book (call daily for book patients) */
export function postNightlyBedCharge(admissionId: string, createdBy: string): boolean {
  const adm = getAdmissionById(admissionId)
  if (!adm || adm.status !== 'Active' || !adm.bookOpen) return false
  const bed = beds.find((b) => b.id === adm.bedId)
  if (!bed) return false
  const night = today()
  const exists = accountTransactions.some(
    (t) => t.admissionId === admissionId && t.description.includes(night),
  )
  if (exists) return false
  addAccountCharge(
    adm.patientId,
    bed.dailyRate,
    'Room',
    `${getRoomById(adm.roomId)?.name ?? 'Room'} â€” ${bed.bedNumber} (${night})`,
    adm.visitId,
    createdBy,
    { admissionId, settledAtCharge: false, referenceId: admissionId, referenceType: 'bed' },
  )
  return true
}

export function collectNightlyBedPayment(admissionId: string, createdBy: string): boolean {
  const adm = getAdmissionById(admissionId)
  if (!adm || adm.status !== 'Active' || adm.billingMode !== 'nightly_cash') return false
  const bed = beds.find((b) => b.id === adm.bedId)
  if (!bed) return false
  const night = today()
  const exists = accountTransactions.some(
    (t) => t.admissionId === admissionId && t.description.includes(night),
  )
  if (exists) return false
  addAccountCharge(
    adm.patientId,
    bed.dailyRate,
    'Room',
    `${getRoomById(adm.roomId)?.name ?? 'Room'} â€” ${bed.bedNumber} (${night}) â€” cash`,
    adm.visitId,
    createdBy,
    { admissionId, settledAtCharge: true, referenceId: admissionId, referenceType: 'bed' },
  )
  return true
}

export function getAdmissionLedger(admissionId: string): AccountTransaction[] {
  return accountTransactions
    .filter((t) => t.admissionId === admissionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAdmissionBookBalance(admissionId: string): number {
  return getAdmissionLedger(admissionId)
    .filter((t) => t.type === 'charge' && !t.settledAtCharge)
    .reduce((s, t) => s + t.amount, 0)
}

export function hasTonightBedCharge(admissionId: string): boolean {
  const night = today()
  return accountTransactions.some(
    (t) => t.admissionId === admissionId && t.chargeType === 'Room' && t.description.includes(night),
  )
}

export function getActiveAdmissionForVisit(visitId: string): Admission | undefined {
  return admissions.find((a) => a.visitId === visitId && a.status === 'Active')
}

function hasAdmissionChargeReference(
  admissionId: string,
  referenceType: AccountTransaction['referenceType'],
  referenceId: string,
): boolean {
  return accountTransactions.some(
    (t) =>
      t.admissionId === admissionId &&
      t.type === 'charge' &&
      t.referenceType === referenceType &&
      t.referenceId === referenceId,
  )
}

export function getInpatientBillingLedger(admissionId: string): InpatientChargeRow[] {
  const adm = getAdmissionById(admissionId)
  if (!adm) return []

  syncInpatientBedNightlyCharges(admissionId)

  const rows: InpatientChargeRow[] = []

  for (const tx of getAdmissionLedger(admissionId)) {
    if (tx.type !== 'charge') continue
    rows.push({
      id: tx.id,
      sourceType: tx.referenceType ?? (tx.chargeType === 'Room' ? 'bed' : tx.chargeType === 'Laboratory' ? 'lab' : tx.chargeType === 'Surgery' ? 'surgery' : tx.chargeType === 'Pharmacy' ? 'pharmacy' : 'bed'),
      sourceId: tx.referenceId ?? tx.id,
      date: bedChargeDisplayDate(tx),
      description: tx.description,
      amount: tx.amount,
      status: tx.settledAtCharge ? 'Paid' : 'On book',
      transactionId: tx.id,
    })
  }

  for (const lab of labRequests.filter((l) => l.visitId === adm.visitId && l.status === 'Awaiting Payment')) {
    if (hasAdmissionChargeReference(admissionId, 'lab', lab.id)) continue
    rows.push({
      id: `pending-lab-${lab.id}`,
      sourceType: 'lab',
      sourceId: lab.id,
      date: lab.createdAt.split('T')[0],
      description: `Lab â€” ${lab.tests.map((t) => t.testName).join(', ')}`,
      amount: lab.totalFee ?? calculateLabRequestSubtotal(lab.tests),
      status: 'Pending',
    })
  }

  for (const srg of surgeryRequests.filter(
    (s) => s.visitId === adm.visitId && s.status === 'Pending' && !isSurgeryFeePaid(s),
  )) {
    if (hasAdmissionChargeReference(admissionId, 'surgery', srg.id)) continue
    rows.push({
      id: `pending-surgery-${srg.id}`,
      sourceType: 'surgery',
      sourceId: srg.id,
      date: srg.createdAt.split('T')[0],
      description: `Surgery â€” ${srg.surgeryName}`,
      amount: getSurgeryRequestFee(srg),
      status: 'Pending',
    })
  }

  for (const rx of prescriptions.filter(
    (p) =>
      p.admissionId === admissionId &&
      isInpatientMedicineRequest(p) &&
      p.status === 'Approved' &&
      isInpatientMedicineSentToReception(p) &&
      !isInpatientMedicinePaymentCollected(p),
  )) {
    if (hasAdmissionChargeReference(admissionId, 'pharmacy', rx.id)) continue
    rows.push({
      id: `pending-pharmacy-${rx.id}`,
      sourceType: 'pharmacy',
      sourceId: rx.id,
      date: (rx.sentToReceptionAt ?? rx.createdAt).split('T')[0],
      description: buildInpatientPharmacyChargeDescription(rx),
      amount: estimatePrescriptionTotalFee(rx),
      status: 'Pending',
    })
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description))
}

function buildInpatientPharmacyChargeDescription(rx: Prescription): string {
  return `Prescription — ${rx.items.map((i) => i.medicine).join(', ')}`
}

function markInpatientPrescriptionPaidFromBilling(
  rxId: string,
  receptionId: string,
  amount: number,
  paymentMethod: 'Cash' | 'Credit Book',
): void {
  const rx = prescriptions.find((p) => p.id === rxId)
  if (!rx || !isInpatientMedicineRequest(rx)) return
  if (isInpatientMedicinePaymentCollected(rx)) return
  const ts = now()
  rx.totalFee = amount
  rx.amountPaid = amount
  rx.paymentCollectedAt = ts
  rx.collectedByReceptionId = receptionId
  rx.paymentMethod = paymentMethod
  rx.lastModifiedAt = ts
  touchHmsStore()
}

export function getInpatientOutstandingTotal(admissionId: string): number {
  return getInpatientBillingLedger(admissionId)
    .filter((r) => r.status !== 'Paid')
    .reduce((s, r) => s + r.amount, 0)
}

export function getReceptionInpatientUnpaidAlerts(): InpatientUnpaidAlert[] {
  const alerts: InpatientUnpaidAlert[] = []

  for (const adm of admissions) {
    const outstanding = getInpatientOutstandingTotal(adm.id)
    if (outstanding <= 0) continue

    const visit = getVisitById(adm.visitId)
    const patient = getPatientById(adm.patientId)
    if (!visit || !patient) continue

    let scenario: InpatientUnpaidAlert['scenario'] | null = null
    if (adm.status === 'Discharged') {
      scenario = 'discharged_unpaid'
    } else if (adm.status === 'Active' && visit.status === 'Completed') {
      scenario = 'released_still_admitted'
    }
    if (!scenario) continue

    const doctor = visit.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
    const bed = beds.find((b) => b.id === adm.bedId)
    const room = getRoomById(adm.roomId)

    alerts.push({
      admissionId: adm.id,
      patientId: patient.id,
      patientName: patient.fullName,
      visitId: visit.id,
      doctorName: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'â€”',
      outstandingAmount: outstanding,
      scenario,
      bedId: adm.bedId,
      bedLabel: bed && room ? `${room.name} Â· ${bed.bedNumber}` : undefined,
      dischargedAt: adm.dischargedAt,
    })
  }

  return alerts.sort((a, b) => b.outstandingAmount - a.outstandingAmount)
}

function getStaffDisplayName(staffId: string): string {
  const staff = getStaffById(staffId)
  if (!staff) return 'â€”'
  if (staff.role === 'emergency') return 'Emergency'
  return `Dr. ${staff.firstName} ${staff.lastName}`
}

export type InpatientCollectOptions = {
  skipReceipt?: boolean
  skipPaymentRecord?: boolean
  discountPercent?: number
  discountAmount?: number
}

export function buildInpatientChargeReceipt(
  adm: Admission,
  row: InpatientChargeRow,
  receptionId: string,
  paymentMethod = 'Cash',
  discount?: Pick<InpatientCollectOptions, 'discountPercent' | 'discountAmount'>,
): ReceptionReceipt {
  const visit = getVisitById(adm.visitId)
  const doctorId = visit?.assignedDoctorId ?? receptionId
  const subtotal = row.amount
  const discountAmount = discount?.discountAmount ?? 0
  const total = Math.max(0, subtotal - discountAmount)
  return {
    id: generateId('rcpt'),
    receiptNumber: generateNumber('RCP'),
    type: row.sourceType === 'lab' ? 'lab' : row.sourceType === 'surgery' ? 'surgery' : 'checkout',
    patientId: adm.patientId,
    visitId: adm.visitId,
    doctorId,
    doctorName: getStaffDisplayName(doctorId),
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: [{ description: row.description, amount: row.amount }],
    subtotal,
    discountPercent: discount?.discountPercent,
    discountAmount,
    total,
    paymentMethod,
    paymentConfirmed: true,
    labRequestNumber:
      row.sourceType === 'lab'
        ? labRequests.find((l) => l.id === row.sourceId)?.requestNumber
        : undefined,
    surgeryRequestNumber:
      row.sourceType === 'surgery'
        ? surgeryRequests.find((s) => s.id === row.sourceId)?.requestNumber
        : undefined,
    createdAt: now(),
    createdBy: receptionId,
  }
}

export function applyInpatientChargeToBook(
  admissionId: string,
  row: InpatientChargeRow,
  receptionId: string,
): { ok: boolean; error?: string } {
  const adm = getAdmissionById(admissionId)
  if (!adm) {
    return { ok: false, error: 'Admission not found.' }
  }
  if (adm.status !== 'Active' && row.status === 'Pending') {
    return { ok: false, error: 'Cannot post new charges after discharge â€” settle existing book items.' }
  }
  if (row.status !== 'Pending') return { ok: false, error: 'Charge already processed.' }

  if (row.sourceType === 'bed') {
    const ok = postNightlyBedCharge(admissionId, receptionId)
    return ok ? { ok: true } : { ok: false, error: "Tonight's bed fee could not be posted." }
  }

  if (row.sourceType === 'lab') {
    const lab = labRequests.find((l) => l.id === row.sourceId)
    if (!lab || lab.status !== 'Awaiting Payment') return { ok: false, error: 'Lab request not found.' }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Laboratory',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: false, referenceId: lab.id, referenceType: 'lab' },
    )
    lab.status = 'Pending'
    lab.paymentConfirmedAt = now()
    lab.paidByReceptionId = receptionId
    lab.amountPaid = row.amount
    return { ok: true }
  }

  if (row.sourceType === 'surgery') {
    const srg = surgeryRequests.find((s) => s.id === row.sourceId)
    if (!srg || srg.status !== 'Pending') return { ok: false, error: 'Surgery request not found.' }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Surgery',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: false, referenceId: srg.id, referenceType: 'surgery' },
    )
    srg.paymentConfirmedAt = now()
    srg.paidByReceptionId = receptionId
    srg.amountPaid = row.amount
    return { ok: true }
  }

  if (row.sourceType === 'pharmacy') {
    const rx = prescriptions.find((p) => p.id === row.sourceId)
    if (!rx || !isInpatientMedicineRequest(rx)) {
      return { ok: false, error: 'Prescription not found.' }
    }
    if (!isInpatientMedicineSentToReception(rx)) {
      return { ok: false, error: 'Pharmacy has not sent this prescription to reception.' }
    }
    if (isInpatientMedicinePaymentCollected(rx)) {
      return { ok: false, error: 'Prescription already paid.' }
    }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Pharmacy',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: false, referenceId: rx.id, referenceType: 'pharmacy' },
    )
    if (adm.billingMode === 'credit_book') {
      markInpatientPrescriptionPaidFromBilling(
        rx.id,
        receptionId,
        row.amount,
        'Credit Book',
      )
    }
    return { ok: true }
  }

  return { ok: false, error: 'Unsupported charge type.' }
}

export function collectInpatientChargeCash(
  admissionId: string,
  row: InpatientChargeRow,
  receptionId: string,
  options?: InpatientCollectOptions,
): { ok: boolean; receipt?: ReceptionReceipt; error?: string } {
  const adm = getAdmissionById(admissionId)
  if (!adm || adm.billingMode !== 'nightly_cash') {
    return { ok: false, error: 'Patient is not on nightly cash billing.' }
  }
  if (adm.status !== 'Active' && row.status === 'Pending') {
    return { ok: false, error: 'Cannot post new charges after discharge.' }
  }
  if (row.status !== 'Pending') return { ok: false, error: 'Charge already processed.' }

  const discountAmount = options?.discountAmount ?? 0
  const paidTotal = Math.max(0, row.amount - discountAmount)
  const receiptDiscount = {
    discountPercent: options?.discountPercent,
    discountAmount,
  }

  if (row.sourceType === 'bed') {
    const ok = collectNightlyBedPayment(admissionId, receptionId)
    if (!ok) return { ok: false, error: "Could not collect tonight's bed fee." }
    if (!options?.skipPaymentRecord) {
      recordInpatientPayment(adm, paidTotal, row.description, receptionId, row.sourceId, 'Other')
    }
    const receipt = buildInpatientChargeReceipt(adm, row, receptionId, 'Cash', receiptDiscount)
    if (!options?.skipReceipt) receptionReceipts.push(receipt)
    return { ok: true, receipt }
  }

  if (row.sourceType === 'lab') {
    const lab = labRequests.find((l) => l.id === row.sourceId)
    if (!lab || lab.status !== 'Awaiting Payment') return { ok: false, error: 'Lab request not found.' }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Laboratory',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: true, referenceId: lab.id, referenceType: 'lab' },
    )
    lab.status = 'Pending'
    lab.paymentConfirmedAt = now()
    lab.paidByReceptionId = receptionId
    lab.amountPaid = paidTotal
    lab.discountPercent = options?.discountPercent
    lab.discountAmount = discountAmount > 0 ? discountAmount : undefined
    lab.paymentMethod = 'Cash'
    if (!options?.skipPaymentRecord) {
      recordInpatientPayment(adm, paidTotal, row.description, receptionId, lab.id, 'Laboratory')
    }
    const receipt = buildInpatientChargeReceipt(adm, row, receptionId, 'Cash', receiptDiscount)
    if (!options?.skipReceipt) receptionReceipts.push(receipt)
    return { ok: true, receipt }
  }

  if (row.sourceType === 'surgery') {
    const srg = surgeryRequests.find((s) => s.id === row.sourceId)
    if (!srg || srg.status !== 'Pending') return { ok: false, error: 'Surgery request not found.' }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Surgery',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: true, referenceId: srg.id, referenceType: 'surgery' },
    )
    srg.paymentConfirmedAt = now()
    srg.paidByReceptionId = receptionId
    srg.amountPaid = paidTotal
    srg.discountPercent = options?.discountPercent
    srg.discountAmount = discountAmount > 0 ? discountAmount : undefined
    srg.paymentMethod = 'Cash'
    if (!options?.skipPaymentRecord) {
      recordInpatientPayment(adm, paidTotal, row.description, receptionId, srg.id, 'Surgery')
    }
    const receipt = buildInpatientChargeReceipt(adm, row, receptionId, 'Cash', receiptDiscount)
    if (!options?.skipReceipt) receptionReceipts.push(receipt)
    return { ok: true, receipt }
  }

  if (row.sourceType === 'pharmacy') {
    const rx = prescriptions.find((p) => p.id === row.sourceId)
    if (!rx || !isInpatientMedicineRequest(rx)) {
      return { ok: false, error: 'Prescription not found.' }
    }
    if (!isInpatientMedicineSentToReception(rx)) {
      return { ok: false, error: 'Pharmacy has not sent this prescription to reception.' }
    }
    if (isInpatientMedicinePaymentCollected(rx)) {
      return { ok: false, error: 'Prescription already paid.' }
    }
    addAccountCharge(
      adm.patientId,
      row.amount,
      'Pharmacy',
      row.description,
      adm.visitId,
      receptionId,
      { admissionId, settledAtCharge: true, referenceId: rx.id, referenceType: 'pharmacy' },
    )
    markInpatientPrescriptionPaidFromBilling(rx.id, receptionId, paidTotal, 'Cash')
    if (!options?.skipPaymentRecord) {
      recordInpatientPayment(adm, paidTotal, row.description, receptionId, rx.id, 'Pharmacy')
    }
    const receipt = buildInpatientChargeReceipt(adm, row, receptionId, 'Cash', receiptDiscount)
    if (!options?.skipReceipt) receptionReceipts.push(receipt)
    return { ok: true, receipt }
  }

  return { ok: false, error: 'Unsupported charge type.' }
}

export function buildInpatientBookChargeReceipt(
  adm: Admission,
  row: InpatientChargeRow,
  receptionId: string,
): ReceptionReceipt {
  const receipt = buildInpatientChargeReceipt(adm, row, receptionId, 'Credit book')
  receipt.paymentConfirmed = false
  receipt.paymentMethod = 'Credit book'
  return receipt
}

export function isInpatientChargePaid(status: InpatientChargeRow['status']): boolean {
  return status === 'Paid'
}

function recordInpatientPayment(
  adm: Admission,
  amount: number,
  description: string,
  receptionId: string,
  reference?: string,
  incomeCategory: IncomeRecord['category'] = 'Other',
): void {
  payments.push({
    id: generateId('pay'),
    patientId: adm.patientId,
    visitId: adm.visitId,
    amount,
    paymentMethod: 'Cash',
    receiptNumber: generateNumber('RCP'),
    description,
    receivedBy: receptionId,
    createdAt: now(),
  })
  incomeRecords.push({
    id: generateId('inc'),
    category: incomeCategory,
    description,
    amount,
    receivedBy: receptionId,
    reference,
    createdAt: now(),
  })
}

function settleAdmissionChargeTransaction(
  transactionId: string,
  patientId: string,
): AccountTransaction | undefined {
  const txn = accountTransactions.find((t) => t.id === transactionId)
  if (!txn || txn.type !== 'charge' || txn.settledAtCharge) return undefined
  txn.settledAtCharge = true
  const account = getPatientAccount(patientId)
  if (account) account.outstandingBalance = recalculateBalance(account.id)
  return txn
}

/** Credit book: post pending charge (if needed) then collect cash payment */
export function settleInpatientBookCharge(
  admissionId: string,
  row: InpatientChargeRow,
  receptionId: string,
  options?: InpatientCollectOptions,
): { ok: boolean; receipt?: ReceptionReceipt; error?: string } {
  const adm = getAdmissionById(admissionId)
  if (!adm) {
    return { ok: false, error: 'Admission not found.' }
  }
  if (isInpatientChargePaid(row.status)) {
    return { ok: false, error: 'Charge already paid.' }
  }

  let paidRow = row
  let transactionId = row.transactionId

  if (row.status === 'Pending') {
    const applyResult = applyInpatientChargeToBook(admissionId, row, receptionId)
    if (!applyResult.ok) return applyResult
    const updated = getInpatientBillingLedger(admissionId).find(
      (r) =>
        r.sourceType === row.sourceType &&
        r.sourceId === row.sourceId &&
        r.status === 'On book',
    )
    if (!updated?.transactionId) {
      return { ok: false, error: 'Charge not found after posting to book.' }
    }
    paidRow = updated
    transactionId = updated.transactionId
  }

  if (!transactionId) return { ok: false, error: 'Charge transaction not found.' }
  const txn = settleAdmissionChargeTransaction(transactionId, adm.patientId)
  if (!txn) return { ok: false, error: 'Charge could not be settled.' }

  const incomeCategory =
    paidRow.sourceType === 'lab'
      ? 'Laboratory'
      : paidRow.sourceType === 'surgery'
        ? 'Surgery'
        : paidRow.sourceType === 'pharmacy'
          ? 'Pharmacy'
          : 'Other'
  const discountAmount = options?.discountAmount ?? 0
  const paidTotal = Math.max(0, paidRow.amount - discountAmount)
  if (!options?.skipPaymentRecord) {
    recordInpatientPayment(
      adm,
      paidTotal,
      paidRow.description,
      receptionId,
      paidRow.sourceId,
      incomeCategory,
    )
  }

  if (paidRow.sourceType === 'pharmacy') {
    markInpatientPrescriptionPaidFromBilling(
      paidRow.sourceId,
      receptionId,
      paidTotal,
      'Cash',
    )
  }

  const receipt = buildInpatientChargeReceipt(
    adm,
    { ...paidRow, status: 'Paid' },
    receptionId,
    'Cash',
    {
      discountPercent: options?.discountPercent,
      discountAmount,
    },
  )
  if (!options?.skipReceipt) receptionReceipts.push(receipt)
  return { ok: true, receipt }
}

/** Collect a single inpatient charge (cash or credit book) */
export function collectInpatientChargePayment(
  admissionId: string,
  row: InpatientChargeRow,
  receptionId: string,
  options?: InpatientCollectOptions,
): { ok: boolean; receipt?: ReceptionReceipt; error?: string; discharged?: boolean } {
  const adm = getAdmissionById(admissionId)
  if (!adm) return { ok: false, error: 'Admission not found.' }
  if (isInpatientChargePaid(row.status)) {
    return { ok: false, error: 'Charge already paid.' }
  }
  const result = settleInpatientBookCharge(admissionId, row, receptionId, options)
  if (!result.ok) return result
  const discharged = dischargeInpatientAfterFullPayment(admissionId)
  return { ...result, discharged }
}

/** Collect all unpaid inpatient charges in one action */
export function collectInpatientTotalPayment(
  admissionId: string,
  receptionId: string,
  options?: Pick<InpatientCollectOptions, 'discountPercent' | 'discountAmount'>,
): { ok: boolean; receipt?: ReceptionReceipt; error?: string; discharged?: boolean } {
  const adm = getAdmissionById(admissionId)
  if (!adm) return { ok: false, error: 'Admission not found.' }

  const unpaidRows = getInpatientBillingLedger(admissionId).filter((r) => !isInpatientChargePaid(r.status))
  if (unpaidRows.length === 0) {
    return { ok: false, error: 'No unpaid charges.' }
  }

  const subtotal = unpaidRows.reduce((s, r) => s + r.amount, 0)
  const discountAmount = options?.discountAmount ?? 0
  const total = Math.max(0, subtotal - discountAmount)

  for (const row of unpaidRows) {
    const result = collectInpatientChargePayment(admissionId, row, receptionId, {
      skipReceipt: true,
      skipPaymentRecord: true,
    })
    if (!result.ok) return result
  }

  recordInpatientPayment(
    adm,
    total,
    `Inpatient checkout â€” ${unpaidRows.length} charge(s)`,
    receptionId,
    admissionId,
    'Other',
  )

  const visit = getVisitById(adm.visitId)
  const doctorId = visit?.assignedDoctorId ?? receptionId
  const receipt: ReceptionReceipt = {
    id: generateId('rcpt'),
    receiptNumber: generateNumber('RCP'),
    type: 'checkout',
    patientId: adm.patientId,
    visitId: adm.visitId,
    doctorId,
    doctorName: getStaffDisplayName(doctorId),
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: unpaidRows.map((r) => ({ description: r.description, amount: r.amount })),
    subtotal,
    discountPercent: options?.discountPercent,
    discountAmount,
    total,
    paymentMethod: 'Cash',
    paymentConfirmed: true,
    createdAt: now(),
    createdBy: receptionId,
  }
  receptionReceipts.push(receipt)
  const discharged = dischargeInpatientAfterFullPayment(admissionId)
  return { ok: true, receipt, discharged }
}

export function getLatestInpatientCheckoutReceipt(admissionId: string): ReceptionReceipt | undefined {
  const adm = getAdmissionById(admissionId)
  if (!adm) return undefined
  return receptionReceipts
    .filter((r) => r.type === 'checkout' && r.visitId === adm.visitId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Inpatient medicine order (doctor or nursing) linked to an admission */
export function isInpatientMedicineRequest(rx: Prescription): boolean {
  if (!rx.admissionId) return false
  const adm = getAdmissionById(rx.admissionId)
  return !!adm && adm.status !== 'Discharged'
}

/** @deprecated Use isInpatientMedicineRequest */
export function isNursingInpatientMedicineRequest(rx: Prescription): boolean {
  return isInpatientMedicineRequest(rx)
}

export function getInpatientMedicineRequests(status?: Prescription['status']): Prescription[] {
  return prescriptions
    .filter((p) => isInpatientMedicineRequest(p) && (!status || p.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** @deprecated Use getInpatientMedicineRequests */
export function getNursingInpatientMedicineRequests(
  status?: Prescription['status'],
): Prescription[] {
  return getInpatientMedicineRequests(status)
}

export function getInpatientMedicineOrderedByLabel(rx: Prescription): string {
  if (!rx.orderedById) return '—'
  const staff = getStaffById(rx.orderedById)
  if (!staff) return '—'
  if (staff.role === 'nurse') return `Nurse ${staff.firstName} ${staff.lastName}`
  if (staff.role === 'doctor') return `Dr. ${staff.firstName} ${staff.lastName}`
  return `${staff.firstName} ${staff.lastName}`
}

export function isInpatientMedicineSentToReception(rx: Prescription): boolean {
  return !!rx.sentToReceptionAt
}

export function getInpatientMedicinePaymentStatus(rx: Prescription): InpatientMedicinePaymentStatus {
  if (isInpatientMedicinePaymentCollected(rx)) {
    if (rx.paymentMethod === 'Credit Book') return 'credit_book'
    return 'paid_cash'
  }
  if (isInpatientMedicineSentToReception(rx)) return 'at_reception'
  return 'awaiting_payment'
}

function findInventoryForMedicine(medicineName: string) {
  const lower = medicineName.toLowerCase()
  return inventoryItems.find(
    (i) =>
      i.name.toLowerCase().includes(lower) ||
      lower.includes(i.name.toLowerCase().split(' ')[0]),
  )
}

function findInventoryBySupplyName(supplyName: string) {
  const lower = supplyName.toLowerCase().trim()
  const exact = inventoryItems.find((i) => i.name.toLowerCase() === lower)
  if (exact) return exact
  return findInventoryForMedicine(supplyName)
}

export function deliverDepartmentSupplyRequest(
  requestId: string,
  userId: string,
): { ok: boolean; error?: string } {
  const req = departmentSupplyRequests.find((r) => r.id === requestId)
  if (!req) return { ok: false, error: 'Request not found.' }
  if (req.status === 'Pending') return { ok: false, error: 'Approve the request before delivery.' }
  if (req.status === 'Delivered') return { ok: false, error: 'Request already delivered.' }

  for (const line of req.items) {
    const inv = findInventoryBySupplyName(line.supplyName)
    if (!inv) return { ok: false, error: `No inventory match for "${line.supplyName}".` }
    if (inv.quantity < line.quantity) {
      return { ok: false, error: `Insufficient stock for ${inv.name} (need ${line.quantity}, have ${inv.quantity}).` }
    }

    inv.quantity -= line.quantity
    syncMedicineStatusForInventoryItem(inv)

    stockTransactions.push({
      id: generateId('st'),
      itemId: inv.id,
      type: 'Internal Usage',
      quantity: line.quantity,
      unitPrice: inv.unitPrice,
      unitCost: inv.purchasePrice ?? 0,
      department: req.department,
      reference: req.id,
      notes: `Supply delivered to ${req.department}`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    })
  }

  req.status = 'Delivered'
  touchHmsStore()
  return { ok: true }
}

export function estimatePrescriptionTotalFee(rx: Prescription): number {
  if (rx.totalFee != null) return rx.totalFee
  let total = 0
  for (const item of rx.items) {
    const inv = findInventoryForMedicine(item.medicine)
    if (inv) total += inv.unitPrice
  }
  return total
}

export function getInpatientMedicinePaymentSummary(rx: Prescription) {
  const total = estimatePrescriptionTotalFee(rx)
  const paid = rx.amountPaid ?? 0
  return { total, paid, remaining: Math.max(0, total - paid) }
}

export function isInpatientMedicinePaymentCollected(rx: Prescription): boolean {
  if (rx.paymentCollectedAt) return true
  const { total, paid } = getInpatientMedicinePaymentSummary(rx)
  return total > 0 && paid >= total - 0.001
}

/** Active = awaiting payment. Inactive = payment collected or on credit book. */
export function isInpatientMedicineActive(rx: Prescription): boolean {
  if (!isInpatientMedicineRequest(rx)) return rx.status === 'Pending'
  return !isInpatientMedicinePaymentCollected(rx)
}

export function createInpatientPrescription(params: {
  visitId: string
  patientId: string
  admissionId: string
  doctorId: string
  orderedById: string
  items: Prescription['items']
}): Prescription {
  const rx: Prescription = {
    id: generateId('rx'),
    visitId: params.visitId,
    patientId: params.patientId,
    doctorId: params.doctorId,
    admissionId: params.admissionId,
    orderedById: params.orderedById,
    items: params.items,
    status: 'Pending',
    createdAt: now(),
    lastModifiedAt: now(),
  }
  rx.totalFee = estimatePrescriptionTotalFee(rx)
  prescriptions.push(rx)
  schedulePersist()
  return rx
}

/** Pharmacy approves inpatient medicine request (doctor or nursing) before payment */
export function approveInpatientMedicineAtPharmacy(
  prescriptionId: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || !isInpatientMedicineRequest(rx)) {
    return { ok: false, error: 'Inpatient medicine request not found.' }
  }
  if (rx.status !== 'Pending') {
    return { ok: false, error: 'Only pending requests can be approved.' }
  }
  rx.status = 'Approved'
  rx.approvedAt = now()
  rx.approvedByPharmacyId = pharmacyUserId
  rx.lastModifiedAt = now()
  touchHmsStore()
  return { ok: true }
}

/** Pharmacy sends unpaid request to reception cashier */
export function sendInpatientMedicineToReceptionAtPharmacy(
  prescriptionId: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || !isInpatientMedicineRequest(rx)) {
    return { ok: false, error: 'Inpatient medicine request not found.' }
  }
  if (rx.status !== 'Approved') {
    return { ok: false, error: 'Approve the request before sending to reception.' }
  }
  if (isInpatientMedicinePaymentCollected(rx)) {
    return { ok: false, error: 'Payment already collected.' }
  }
  if (isInpatientMedicineSentToReception(rx)) {
    return { ok: false, error: 'Already sent to reception.' }
  }
  const ts = now()
  rx.sentToReceptionAt = ts
  rx.sentToReceptionByPharmacyId = pharmacyUserId
  rx.lastModifiedAt = ts
  touchHmsStore()
  return { ok: true }
}

/** Patient pays cash at pharmacy (no reception visit needed) */
export function collectInpatientMedicinePaymentAtPharmacy(
  prescriptionId: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || !isInpatientMedicineRequest(rx)) {
    return { ok: false, error: 'Inpatient medicine request not found.' }
  }
  if (isInpatientMedicinePaymentCollected(rx)) {
    return { ok: false, error: 'Payment already collected.' }
  }
  if (rx.status !== 'Approved') {
    return { ok: false, error: 'Pharmacy must approve this request first.' }
  }
  if (isInpatientMedicineSentToReception(rx)) {
    return { ok: false, error: 'Already sent to reception — use Inpatient billing there.' }
  }

  const total = estimatePrescriptionTotalFee(rx)
  if (total <= 0) return { ok: false, error: 'Could not calculate medicine total.' }

  const patient = getPatientById(rx.patientId)
  if (!patient) return { ok: false, error: 'Patient not found.' }

  const nowIso = now()
  const itemDescription = rx.items.map((i) => i.medicine).join(', ')

  rx.totalFee = total
  rx.amountPaid = total
  rx.paymentCollectedAt = nowIso
  rx.collectedByPharmacyId = pharmacyUserId
  rx.paymentMethod = 'Cash'
  rx.lastModifiedAt = nowIso

  incomeRecords.push({
    id: generateId('inc'),
    category: 'Pharmacy',
    amount: total,
    description: `Inpatient medicine (pharmacy) — ${patient.fullName}`,
    reference: rx.id,
    receivedBy: pharmacyUserId,
    createdAt: nowIso,
  })

  payments.push({
    id: generateId('pay'),
    patientId: rx.patientId,
    visitId: rx.visitId,
    amount: total,
    paymentMethod: 'Cash',
    receiptNumber: generateNumber('RCP'),
    description: `Inpatient medicine — ${itemDescription}`,
    receivedBy: pharmacyUserId,
    createdAt: nowIso,
  })

  touchHmsStore()
  return { ok: true }
}

/** Pharmacy dispenses stock after reception has collected payment / charged book */
export function dispenseInpatientMedicineAtPharmacy(
  prescriptionId: string,
  pharmacyUserId: string,
  totalCost: number,
  _itemDescription: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || rx.status !== 'Approved') {
    return { ok: false, error: 'Prescription must be approved and awaiting dispense.' }
  }
  if (!isInpatientMedicineRequest(rx)) {
    return { ok: false, error: 'Not an inpatient medicine request.' }
  }
  if (!isInpatientMedicinePaymentCollected(rx)) {
    return { ok: false, error: 'Payment not collected at reception yet.' }
  }

  rx.totalFee = totalCost
  rx.dispensedAt = now()
  rx.dispensedByPharmacyId = pharmacyUserId
  rx.status = 'Dispensed'
  touchHmsStore()
  return { ok: true }
}

export function dispensePrescriptionOnInpatientBook(
  prescriptionId: string,
  totalCost: number,
  itemDescription: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || rx.status !== 'Pending') return { ok: false, error: 'Prescription not found.' }
  const adm = getActiveAdmissionForVisit(rx.visitId)
  if (!adm || adm.billingMode !== 'credit_book' || !adm.bookOpen) {
    return { ok: false, error: 'Patient does not have an open inpatient credit book.' }
  }
  if (hasAdmissionChargeReference(adm.id, 'pharmacy', rx.id)) {
    return { ok: false, error: 'Prescription already on book.' }
  }
  addAccountCharge(
    rx.patientId,
    totalCost,
    'Pharmacy',
    `Prescription â€” ${itemDescription}`,
    rx.visitId,
    pharmacyUserId,
    {
      admissionId: adm.id,
      settledAtCharge: false,
      referenceId: rx.id,
      referenceType: 'pharmacy',
    },
  )
  rx.status = 'Dispensed'
  return { ok: true }
}

/** Inpatient on nightly cash â€” patient pays at pharmacy when medicine is dispensed */
export function dispensePrescriptionCashInpatient(
  prescriptionId: string,
  totalCost: number,
  itemDescription: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx || rx.status !== 'Pending') return { ok: false, error: 'Prescription not found.' }
  const adm = getActiveAdmissionForVisit(rx.visitId)
  if (!adm || adm.billingMode !== 'nightly_cash') {
    return { ok: false, error: 'Patient is not on inpatient cash billing.' }
  }
  if (hasAdmissionChargeReference(adm.id, 'pharmacy', rx.id)) {
    return { ok: false, error: 'Prescription already charged.' }
  }
  addAccountCharge(
    rx.patientId,
    totalCost,
    'Pharmacy',
    `Prescription â€” ${itemDescription}`,
    rx.visitId,
    pharmacyUserId,
    {
      admissionId: adm.id,
      settledAtCharge: true,
      referenceId: rx.id,
      referenceType: 'pharmacy',
    },
  )
  payments.push({
    id: generateId('pay'),
    patientId: rx.patientId,
    visitId: rx.visitId,
    amount: totalCost,
    paymentMethod: 'Cash',
    receiptNumber: generateNumber('RCP'),
    description: `Pharmacy â€” ${itemDescription}`,
    receivedBy: pharmacyUserId,
    createdAt: now(),
  })
  incomeRecords.push({
    id: generateId('inc'),
    category: 'Pharmacy',
    description: `Pharmacy â€” ${itemDescription}`,
    amount: totalCost,
    receivedBy: pharmacyUserId,
    reference: rx.id,
    createdAt: now(),
  })
  rx.status = 'Dispensed'
  return { ok: true }
}

export type PrescriptionDispenseBilling = 'inpatient_credit_book' | 'inpatient_cash' | 'outpatient_credit' | 'outpatient_cash'

export function getPrescriptionDispenseBilling(rx: Prescription): PrescriptionDispenseBilling {
  const adm = getActiveAdmissionForVisit(rx.visitId)
  if (adm?.billingMode === 'credit_book' && adm.bookOpen) return 'inpatient_credit_book'
  if (adm?.billingMode === 'nightly_cash') return 'inpatient_cash'
  const patient = getPatientById(rx.patientId)
  if (patient?.paymentType === 'credit') return 'outpatient_credit'
  return 'outpatient_cash'
}

export function processPrescriptionDispense(
  prescriptionId: string,
  totalCost: number,
  itemDescription: string,
  pharmacyUserId: string,
): { ok: boolean; error?: string; billing?: PrescriptionDispenseBilling } {
  const rx = prescriptions.find((p) => p.id === prescriptionId)
  if (!rx) {
    return { ok: false, error: 'Prescription not found.' }
  }

  const billing = getPrescriptionDispenseBilling(rx)

  if (isInpatientMedicineRequest(rx)) {
    if (rx.status !== 'Approved') {
      return { ok: false, error: 'Prescription must be approved before dispense.' }
    }
    const result = dispenseInpatientMedicineAtPharmacy(
      prescriptionId,
      pharmacyUserId,
      totalCost,
      itemDescription,
    )
    return { ...result, billing }
  }

  if (rx.status !== 'Pending') {
    return { ok: false, error: 'Prescription not found.' }
  }

  if (billing === 'inpatient_credit_book') {
    const result = dispensePrescriptionOnInpatientBook(prescriptionId, totalCost, itemDescription, pharmacyUserId)
    return { ...result, billing }
  }

  if (billing === 'inpatient_cash') {
    const result = dispensePrescriptionCashInpatient(prescriptionId, totalCost, itemDescription, pharmacyUserId)
    return { ...result, billing }
  }

  if (billing === 'outpatient_credit') {
    addAccountCharge(
      rx.patientId,
      totalCost,
      'Pharmacy',
      `Prescription dispense â€” ${itemDescription}`,
      rx.visitId,
      pharmacyUserId,
    )
    rx.status = 'Dispensed'
    return { ok: true, billing }
  }

  rx.status = 'Dispensed'
  return { ok: true, billing }
}

export function getSurgeriesForDoctor(doctorId: string): SurgeryRequest[] {
  return surgeryRequests.filter((s) => s.doctorId === doctorId)
}

export function getSurgeryRequestById(id: string): SurgeryRequest | undefined {
  return surgeryRequests.find((r) => r.id === id)
}

export function getSurgeryRequestFee(req: SurgeryRequest): number {
  return req.surgeryFee ?? getSurgeryById(req.surgeryCatalogId)?.price ?? 0
}

export function isSurgeryFeePaid(req: SurgeryRequest): boolean {
  return Boolean(req.paymentConfirmedAt) || req.status === 'Scheduled' || req.status === 'Completed'
}

export function getDoctorSurgeryStatusLabel(req: SurgeryRequest): string {
  if (req.status === 'Completed') return 'Completed'
  if (req.status === 'Scheduled') return 'Scheduled'
  if (req.status === 'Cancelled') return 'Cancelled'

  if (isSurgeryFeePaid(req)) {
    if (req.paymentMethod === 'Credit Book') return 'Credit Book — Awaiting Schedule'
    return 'Paid — Awaiting Schedule'
  }

  const adm = getActiveAdmissionForVisit(req.visitId)
  if (adm?.billingMode === 'credit_book' && adm.bookOpen) {
    return 'Credit Book — Pending'
  }
  if (adm?.billingMode === 'nightly_cash') {
    return 'Inpatient Cash — Awaiting Payment'
  }
  return 'Awaiting Payment'
}

/** Post surgery fee to inpatient credit book when patient is admitted on credit billing */
function attachSurgeryToInpatientCreditBookIfEligible(
  req: SurgeryRequest,
  postedById: string,
): boolean {
  if (isSurgeryFeePaid(req)) return req.paymentMethod === 'Credit Book'

  const adm = getActiveAdmissionForVisit(req.visitId)
  if (!adm || adm.billingMode !== 'credit_book' || !adm.bookOpen) return false

  const fee = getSurgeryRequestFee(req)

  if (!hasAdmissionChargeReference(adm.id, 'surgery', req.id)) {
    addAccountCharge(
      req.patientId,
      fee,
      'Surgery',
      `Surgery — ${req.surgeryName}`,
      req.visitId,
      postedById,
      {
        admissionId: adm.id,
        settledAtCharge: false,
        referenceId: req.id,
        referenceType: 'surgery',
      },
    )
  }

  req.surgeryFee = fee
  req.amountPaid = fee
  req.paymentMethod = 'Credit Book'
  req.paymentConfirmedAt = now()
  req.paidByReceptionId = postedById
  return true
}

export function completeSurgeryRequest(requestId: string, completedBy: string): void {
  const req = surgeryRequests.find((r) => r.id === requestId)
  if (!req) throw new Error('Surgery request not found')
  if (req.status !== 'Scheduled') throw new Error('Only scheduled surgeries can be marked completed')
  req.status = 'Completed'
  req.completedAt = now()
  req.completedBy = completedBy
  touchHmsStore()
}

export type SurgeryReceptionMode = 'cash' | 'inpatient_book' | 'schedule_only' | 'view'

/** How reception should handle this surgery request in the Surgery page modal */
export function getSurgeryReceptionMode(req: SurgeryRequest): SurgeryReceptionMode {
  if (req.status === 'Completed' || req.status === 'Cancelled') return 'view'
  if (req.status === 'Scheduled') return 'view'
  if (isSurgeryFeePaid(req)) return 'schedule_only'
  const adm = getActiveAdmissionForVisit(req.visitId)
  if (adm?.billingMode === 'credit_book' && adm.bookOpen) return 'inpatient_book'
  return 'cash'
}

export function scheduleSurgeryRequest(
  requestId: string,
  scheduledDate: string,
  scheduledNotes?: string,
): { ok: boolean; error?: string } {
  const req = surgeryRequests.find((r) => r.id === requestId)
  if (!req) return { ok: false, error: 'Surgery request not found.' }
  if (req.status === 'Completed') return { ok: false, error: 'Surgery already completed.' }
  if (req.status === 'Scheduled') return { ok: false, error: 'Surgery already scheduled.' }
  if (!isSurgeryFeePaid(req)) {
    return { ok: false, error: 'Collect payment or charge to inpatient account before scheduling.' }
  }

  req.scheduledDate = scheduledDate
  req.scheduledNotes = scheduledNotes?.trim() || undefined
  req.status = 'Scheduled'
  touchHmsStore()
  return { ok: true }
}

export function confirmSurgeryCashAndSchedule(input: {
  requestId: string
  receptionId: string
  scheduledDate: string
  scheduledNotes?: string
  subtotal: number
  discountPercent?: number
  discountAmount?: number
  total: number
  receiptNumber: string
  surgeryName: string
}): { ok: boolean; error?: string; receipt?: ReceptionReceipt } {
  const req = surgeryRequests.find((r) => r.id === input.requestId)
  if (!req || req.status !== 'Pending') {
    return { ok: false, error: 'Surgery request not found or already processed.' }
  }
  if (isSurgeryFeePaid(req)) {
    return { ok: false, error: 'Payment already recorded — schedule from the paid request.' }
  }

  const patient = getPatientById(req.patientId)
  if (!patient) return { ok: false, error: 'Patient not found.' }

  const nowIso = now()
  req.surgeryFee = input.subtotal
  req.discountPercent = input.discountPercent
  req.discountAmount = input.discountAmount
  req.amountPaid = input.total
  req.paymentMethod = 'Cash'
  req.paymentConfirmedAt = nowIso
  req.paidByReceptionId = input.receptionId
  req.scheduledDate = input.scheduledDate
  req.scheduledNotes = input.scheduledNotes?.trim() || undefined
  req.status = 'Scheduled'

  payments.push({
    id: generateId('pay'),
    patientId: req.patientId,
    visitId: req.visitId,
    amount: input.total,
    paymentMethod: 'Cash',
    receiptNumber: input.receiptNumber,
    description: `Surgery fees — ${req.requestNumber} (${input.surgeryName})`,
    receivedBy: input.receptionId,
    createdAt: nowIso,
  })

  incomeRecords.push({
    id: generateId('inc'),
    category: 'Surgery',
    amount: input.total,
    description: `Surgery fees — ${patient.fullName} (${req.requestNumber})`,
    reference: req.id,
    doctorId: req.doctorId,
    receivedBy: input.receptionId,
    createdAt: nowIso,
  })

  const visit = getVisitById(req.visitId)
  const receipt: ReceptionReceipt = {
    id: generateId('rcpt'),
    receiptNumber: input.receiptNumber,
    type: 'surgery',
    patientId: req.patientId,
    visitId: req.visitId,
    doctorId: req.doctorId,
    doctorName: staffDisplayName(req.doctorId) ?? '—',
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: [{ description: input.surgeryName, amount: input.subtotal }],
    subtotal: input.subtotal,
    discountPercent: input.discountPercent,
    discountAmount: input.discountAmount ?? 0,
    total: input.total,
    paymentConfirmed: true,
    surgeryRequestNumber: req.requestNumber,
    createdAt: nowIso,
    createdBy: input.receptionId,
  }
  receptionReceipts.push(receipt)
  touchHmsStore()
  return { ok: true, receipt }
}

/** Inpatient credit book: post surgery fee to account and schedule in one step */
export function confirmInpatientSurgeryBookAndSchedule(input: {
  requestId: string
  admissionId: string
  receptionId: string
  scheduledDate: string
  scheduledNotes?: string
}): { ok: boolean; error?: string } {
  const req = surgeryRequests.find((r) => r.id === input.requestId)
  if (!req || req.status !== 'Pending') {
    return { ok: false, error: 'Surgery request not found or already processed.' }
  }
  if (isSurgeryFeePaid(req)) {
    return scheduleSurgeryRequest(input.requestId, input.scheduledDate, input.scheduledNotes)
  }

  const adm = getAdmissionById(input.admissionId)
  if (!adm || adm.billingMode !== 'credit_book' || !adm.bookOpen) {
    return { ok: false, error: 'Patient is not on an open inpatient credit book.' }
  }

  const row = getInpatientBillingLedger(input.admissionId).find(
    (r) => r.sourceType === 'surgery' && r.sourceId === req.id && r.status === 'Pending',
  )
  if (!row) {
    return { ok: false, error: 'Surgery charge not found on inpatient ledger.' }
  }

  const applyResult = applyInpatientChargeToBook(input.admissionId, row, input.receptionId)
  if (!applyResult.ok) return applyResult

  const fee = getSurgeryRequestFee(req)
  req.surgeryFee = fee
  req.amountPaid = fee
  req.paymentMethod = 'Credit Book'
  req.scheduledDate = input.scheduledDate
  req.scheduledNotes = input.scheduledNotes?.trim() || undefined
  req.status = 'Scheduled'
  touchHmsStore()
  return { ok: true }
}

export function getPatientAccount(patientId: string): PatientAccount | undefined {
  return patientAccounts.find((a) => a.patientId === patientId)
}

function staffDisplayName(staffId: string): string | undefined {
  const staff = getStaffById(staffId)
  if (!staff) return undefined
  return `${staff.firstName} ${staff.lastName}`
}

/** Full transaction timeline for a patient (visits, labs, surgery, credit, receipts, etc.) */
export function getPatientHistory(patientId: string): PatientHistorySummary | null {
  const patient = getPatientById(patientId)
  if (!patient) return null

  const entries: PatientHistoryEntry[] = []
  const patientReceipts = receptionReceipts.filter((r) => r.patientId === patientId)
  const receiptNumbers = new Set(patientReceipts.map((r) => r.receiptNumber))
  const receiptLabNumbers = new Set(
    patientReceipts.map((r) => r.labRequestNumber).filter(Boolean) as string[],
  )
  const receiptSurgeryNumbers = new Set(
    patientReceipts.map((r) => r.surgeryRequestNumber).filter(Boolean) as string[],
  )

  for (const visit of visits.filter((v) => v.patientId === patientId)) {
    const hasRegistrationReceipt = patientReceipts.some(
      (r) => r.type === 'registration' && r.visitId === visit.id,
    )
    if (hasRegistrationReceipt) continue

    const amount = visit.amountPaid ?? visit.subtotal ?? getStaffRegistrationFee(visit.assignedDoctorId)
    entries.push({
      id: `visit-${visit.id}`,
      date: visit.createdAt,
      category: 'Registration',
      description: `Visit #${visit.patientNumber ?? visit.queueNumber} â€” ${visit.visitDate}`,
      reference: visit.receiptNumber ?? visit.visitNumber,
      amount,
      paymentStatus: visit.paymentConfirmed ? 'Paid' : 'Unpaid',
      paymentMethod: visit.paymentConfirmed ? 'Cash' : undefined,
      handledBy: staffDisplayName(visit.assignedDoctorId),
    })
  }

  for (const receipt of patientReceipts) {
    const category =
      receipt.type === 'registration'
        ? 'Registration'
        : receipt.type === 'lab'
          ? 'Laboratory'
          : receipt.type === 'surgery'
            ? 'Surgery'
            : 'Inpatient'
    entries.push({
      id: `rcpt-${receipt.id}`,
      date: receipt.createdAt,
      category,
      description:
        receipt.lineItems.map((l) => l.description).join(' Â· ') || `${category} payment`,
      reference: receipt.receiptNumber,
      amount: receipt.total,
      paymentStatus: receipt.paymentConfirmed ? 'Paid' : 'Unpaid',
      paymentMethod: receipt.paymentMethod,
      handledBy: staffDisplayName(receipt.createdBy),
    })
  }

  for (const payment of payments.filter(
    (p) => p.patientId === patientId && !receiptNumbers.has(p.receiptNumber),
  )) {
    entries.push({
      id: `pay-${payment.id}`,
      date: payment.createdAt,
      category: 'Payment',
      description: payment.description,
      reference: payment.receiptNumber,
      amount: payment.amount,
      paymentStatus: 'Paid',
      paymentMethod: payment.paymentMethod,
      handledBy: staffDisplayName(payment.receivedBy),
    })
  }

  for (const txn of accountTransactions.filter((t) => t.patientId === patientId)) {
    if (txn.type === 'payment') {
      entries.push({
        id: `acct-${txn.id}`,
        date: txn.createdAt,
        category: 'Credit Payment',
        description: txn.description,
        amount: txn.amount,
        paymentStatus: 'Paid',
        paymentMethod: 'Cash',
        handledBy: staffDisplayName(txn.createdBy),
      })
      continue
    }

    const onBook = !txn.settledAtCharge && Boolean(txn.admissionId || patient.paymentType === 'credit')
    entries.push({
      id: `acct-${txn.id}`,
      date: txn.createdAt,
      category: txn.chargeType ?? 'Charge',
      description: txn.description,
      reference: txn.referenceId,
      amount: txn.amount,
      paymentStatus: txn.settledAtCharge ? 'Paid' : onBook ? 'On book' : 'Unpaid',
      paymentMethod: txn.settledAtCharge ? 'Cash' : onBook ? 'Credit book' : undefined,
      handledBy: staffDisplayName(txn.createdBy),
    })
  }

  for (const lab of labRequests.filter((l) => l.patientId === patientId)) {
    if (receiptLabNumbers.has(lab.requestNumber)) continue
    const fee = lab.totalFee ?? 0
    let paymentStatus: PatientHistoryPaymentStatus = 'Unpaid'
    if (lab.paymentConfirmedAt) paymentStatus = 'Paid'
    else if (lab.status === 'Awaiting Payment') paymentStatus = 'Unpaid'
    else if (patient.paymentType === 'credit') paymentStatus = 'On book'

    entries.push({
      id: `lab-${lab.id}`,
      date: lab.createdAt,
      category: 'Laboratory',
      description: `Lab: ${lab.tests.map((t) => t.testName).join(', ')}`,
      reference: lab.requestNumber,
      amount: fee,
      paymentStatus,
      paymentMethod: lab.paymentMethod,
      handledBy: staffDisplayName(lab.doctorId),
    })
  }

  for (const srg of surgeryRequests.filter((s) => s.patientId === patientId)) {
    if (srg.status === 'Cancelled') continue
    if (receiptSurgeryNumbers.has(srg.requestNumber)) continue
    entries.push({
      id: `srg-${srg.id}`,
      date: srg.createdAt,
      category: 'Surgery',
      description: srg.surgeryName,
      reference: srg.requestNumber,
      amount: srg.surgeryFee ?? 0,
      paymentStatus: srg.paymentConfirmedAt ? 'Paid' : 'Unpaid',
      paymentMethod: srg.paymentMethod,
      handledBy: staffDisplayName(srg.doctorId),
    })
  }

  for (const rx of prescriptions.filter((r) => r.patientId === patientId)) {
    entries.push({
      id: `rx-${rx.id}`,
      date: rx.createdAt,
      category: 'Pharmacy',
      description: `Prescription: ${rx.items.map((i) => i.medicine).join(', ')}`,
      reference: rx.id,
      amount: 0,
      paymentStatus: rx.status === 'Dispensed' ? 'Paid' : 'Unpaid',
      handledBy: staffDisplayName(rx.orderedById ?? rx.doctorId),
    })
  }

  for (const adm of admissions.filter((a) => a.patientId === patientId)) {
    const room = getRoomById(adm.roomId)
    const bed = beds.find((b) => b.id === adm.bedId)
    entries.push({
      id: `adm-${adm.id}`,
      date: adm.admittedAt,
      category: 'Inpatient',
      description: `Admitted â€” ${room?.name ?? 'Room'} ${bed?.name ?? ''} (${adm.billingMode === 'credit_book' ? 'Credit book' : 'Nightly cash'})`,
      reference: adm.id,
      amount: 0,
      paymentStatus:
        adm.billingMode === 'credit_book' && adm.bookOpen && adm.status === 'Active'
          ? 'On book'
          : 'Paid',
    })
  }

  for (const disc of patientDiscounts.filter((d) => d.patientId === patientId)) {
    entries.push({
      id: `disc-${disc.id}`,
      date: disc.createdAt,
      category: 'Discount',
      description: `${disc.feeType} â€” ${disc.discountPercent}% discount`,
      amount: disc.discountAmount,
      paymentStatus: disc.paymentCollected ? 'Paid' : 'Unpaid',
      handledBy: staffDisplayName(disc.appliedBy),
    })
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const account = getPatientAccount(patientId)
  const outstandingBalance = account?.outstandingBalance ?? 0
  const totalPaid = entries
    .filter((e) => e.paymentStatus === 'Paid' && e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0)
  const totalCharged = entries
    .filter((e) => e.category !== 'Credit Payment' && e.category !== 'Payment' && e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0)

  return {
    patientId,
    entries,
    totalCharged,
    totalPaid,
    outstandingBalance,
    hasDebt: outstandingBalance > 0 || entries.some((e) => e.paymentStatus === 'Unpaid' || e.paymentStatus === 'On book'),
  }
}

export function recalculateBalance(accountId: string): number {
  const txns = accountTransactions.filter((t) => t.accountId === accountId)
  return txns.reduce((sum, t) => {
    if (t.type === 'payment') return sum - t.amount
    if (t.type === 'charge' && t.settledAtCharge) return sum
    return sum + t.amount
  }, 0)
}

export function addAccountCharge(
  patientId: string,
  amount: number,
  chargeType: AccountTransaction['chargeType'],
  description: string,
  visitId?: string,
  createdBy = 'system',
  options?: {
    admissionId?: string
    settledAtCharge?: boolean
    referenceId?: string
    referenceType?: AccountTransaction['referenceType']
    /** Calendar date for the charge (YYYY-MM-DD) — used for nightly bed fees */
    chargeDate?: string
  },
): AccountTransaction {
  let account = getPatientAccount(patientId)
  if (!account) {
    account = { id: generateId('acc'), patientId, outstandingBalance: 0, createdAt: now() }
    patientAccounts.push(account)
  }
  const txn: AccountTransaction = {
    id: generateId('txn'),
    accountId: account.id,
    patientId,
    visitId,
    admissionId: options?.admissionId,
    type: 'charge',
    chargeType,
    description,
    amount,
    settledAtCharge: options?.settledAtCharge,
    referenceId: options?.referenceId,
    referenceType: options?.referenceType,
    createdAt: options?.chargeDate ? `${options.chargeDate}T12:00:00.000Z` : now(),
    createdBy,
  }
  accountTransactions.push(txn)
  account.outstandingBalance = recalculateBalance(account.id)
  return txn
}

export function addAccountPayment(patientId: string, amount: number, createdBy: string): AccountTransaction {
  const account = getPatientAccount(patientId)
  if (!account) throw new Error('No credit account found')
  const txn: AccountTransaction = {
    id: generateId('txn'),
    accountId: account.id,
    patientId,
    type: 'payment',
    description: 'Account Payment',
    amount,
    createdAt: now(),
    createdBy,
  }
  accountTransactions.push(txn)
  account.outstandingBalance = recalculateBalance(account.id)
  return txn
}

export function getNextQueueNumber(): number {
  const todayVisits = visits.filter((v) => v.visitDate === today())
  return todayVisits.length + 1
}

/** Per-doctor daily patient queue: 1, 2, 3â€¦ resets each calendar day per doctor (independent counters) */
export function getNextPatientNumberForDoctor(doctorId: string): number {
  const todayDoctorVisits = visits.filter(
    (v) => v.visitDate === today() && v.assignedDoctorId === doctorId && !v.isEmergency,
  )
  if (todayDoctorVisits.length === 0) return 1
  return Math.max(...todayDoctorVisits.map((v) => v.patientNumber ?? v.queueNumber)) + 1
}

/** Emergency queue number for today (separate counter, resets daily from 1) */
export function getNextEmergencyNumber(): number {
  const todayEmergency = visits.filter((v) => v.visitDate === today() && v.isEmergency)
  if (todayEmergency.length === 0) return 1
  return Math.max(...todayEmergency.map((v) => v.patientNumber ?? v.queueNumber)) + 1
}

/** Auto-assign next patient number at registration (call once on submit) */
export function getAutoPatientNumberForStaff(staffId: string): number {
  const staff = getStaffById(staffId)
  if (staff?.role === 'emergency') return getNextEmergencyNumber()
  return getNextPatientNumberForDoctor(staffId)
}

export function calculateDiscountAmount(subtotal: number, discountId?: string): number {
  if (!discountId) return 0
  const disc = discounts.find((d) => d.id === discountId && d.isActive)
  if (!disc) return 0
  if (disc.type === 'percentage') return Math.round((subtotal * disc.value) / 100 * 100) / 100
  return Math.min(disc.value, subtotal)
}

export function getMaxDiscountPercent(role: UserRole, feeType: PatientDiscountFeeType): number {
  if (role === 'pharmacy') {
    return systemSettings.discountLimits.pharmacy.dispensing
  }
  if (role === 'reception_cashier' || role === 'admin') {
    const limits = systemSettings.discountLimits.reception
    if (feeType === 'pharmacy') return systemSettings.discountLimits.pharmacy.dispensing
    return limits[feeType as keyof typeof limits] ?? 0
  }
  return 0
}

export function clampDiscountPercent(role: UserRole, feeType: PatientDiscountFeeType, percent: number): number {
  const max = getMaxDiscountPercent(role, feeType)
  if (percent <= 0) return 0
  return Math.min(percent, max)
}

export function updateDiscountLimits(limits: DiscountLimitsSettings): void {
  systemSettings.discountLimits = {
    reception: { ...limits.reception },
    pharmacy: { ...limits.pharmacy },
  }
  stampModified(systemSettings)
  touchHmsStore()
}

export function sendPatientDiscountToReception(id: string): boolean {
  const row = patientDiscounts.find((p) => p.id === id)
  if (!row || row.status !== 'Active' || row.paymentCollected) return false
  row.sentToReception = true
  return true
}

const DISCOUNT_INCOME_CATEGORY: Record<PatientDiscountFeeType, ChargeType> = {
  registration: 'Registration',
  lab: 'Laboratory',
  surgery: 'Surgery',
  inpatient: 'Room',
  pharmacy: 'Pharmacy',
}

export function collectPatientDiscountPayment(id: string, collectedBy: string): boolean {
  const row = patientDiscounts.find((p) => p.id === id)
  if (!row || !row.sentToReception || row.paymentCollected || row.status !== 'Active') return false

  const now = new Date().toISOString()
  const receiptNumber = generateNumber('RCP')
  const patient = getPatientById(row.patientId)
  const doctor = getStaffById(row.doctorId)
  const description = `Patient discount â€” ${row.feeType} (${patient?.fullName ?? row.patientId})`

  row.paymentCollected = true
  row.collectedAt = now
  row.collectedBy = collectedBy

  payments.push({
    id: generateId('pay'),
    patientId: row.patientId,
    amount: row.netAmount,
    paymentMethod: 'Cash',
    receiptNumber,
    description,
    receivedBy: collectedBy,
    createdAt: now,
  })

  incomeRecords.push({
    id: generateId('inc'),
    category: DISCOUNT_INCOME_CATEGORY[row.feeType],
    amount: row.netAmount,
    description,
    reference: row.id,
    doctorId: row.doctorId,
    receivedBy: collectedBy,
    createdAt: now,
  })

  receptionReceipts.push({
    id: generateId('rcpt'),
    receiptNumber,
    type: row.feeType === 'registration' ? 'registration' : row.feeType === 'lab' ? 'lab' : 'surgery',
    patientId: row.patientId,
    doctorId: row.doctorId,
    doctorName: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'â€”',
    patientNumber: 0,
    isEmergency: false,
    lineItems: [{ description: `Discounted ${row.feeType} fee`, amount: row.feeAmount }],
    subtotal: row.feeAmount,
    discountPercent: row.discountPercent > 0 ? row.discountPercent : undefined,
    discountAmount: row.discountAmount,
    total: row.netAmount,
    paymentMethod: 'Cash',
    paymentConfirmed: true,
    createdAt: now,
    createdBy: collectedBy,
  })

  return true
}

export function recordRegistrationPayment(params: {
  patientId: string
  visitId: string
  amount: number
  receivedBy: string
  doctorId: string
  doctorName: string
  patientNumber: number
  isEmergency: boolean
  subtotal?: number
  discountPercent?: number
  discountAmount?: number
}): ReceptionReceipt | null {
  if (params.amount <= 0) return null

  const subtotal = params.subtotal ?? params.amount
  const discountAmount = params.discountAmount ?? 0
  const now = new Date().toISOString()
  const receiptNumber = generateNumber('RCP')

  payments.push({
    id: generateId('pay'),
    patientId: params.patientId,
    visitId: params.visitId,
    amount: params.amount,
    paymentMethod: 'Cash',
    receiptNumber,
    description:
      discountAmount > 0
        ? `Registration Fee (${params.discountPercent ?? 0}% discount)`
        : 'Registration Fee',
    receivedBy: params.receivedBy,
    createdAt: now,
  })

  incomeRecords.push({
    id: generateId('inc'),
    category: 'Registration',
    amount: params.amount,
    description: `Registration â€” ${getPatientById(params.patientId)?.fullName ?? 'Patient'}`,
    reference: params.visitId,
    doctorId: params.doctorId,
    receivedBy: params.receivedBy,
    createdAt: now,
  })

  const visit = getVisitById(params.visitId)
  if (visit) {
    visit.paymentConfirmed = true
    visit.subtotal = subtotal
    visit.discountAmount = discountAmount
    visit.amountPaid = params.amount
    visit.receiptNumber = receiptNumber
  }

  const receipt: ReceptionReceipt = {
    id: generateId('rcpt'),
    receiptNumber,
    type: 'registration',
    patientId: params.patientId,
    visitId: params.visitId,
    doctorId: params.doctorId,
    doctorName: params.doctorName,
    patientNumber: params.patientNumber,
    isEmergency: params.isEmergency,
    lineItems: [{ description: 'Registration Fee', amount: subtotal }],
    subtotal,
    discountPercent: params.discountPercent,
    discountAmount,
    total: params.amount,
    paymentMethod: 'Cash',
    paymentConfirmed: true,
    createdAt: now,
    createdBy: params.receivedBy,
  }
  receptionReceipts.push(receipt)
  return receipt
}

export function getReceptionPendingPatientDiscounts() {
  return patientDiscounts.filter(
    (p) => p.status === 'Active' && p.sentToReception && !p.paymentCollected,
  )
}

export function getDashboardStats() {
  return {
    totalPatients: patients.length,
    todayVisits: visits.filter((v) => v.visitDate === today()).length,
    waitingPatients: visits.filter((v) => v.status === 'Waiting').length,
    admittedPatients: admissions.filter((a) => a.status === 'Active').length,
    pendingLabRequests: labRequests.filter((l) => l.status === 'Pending').length,
    awaitingLabFees: labRequests.filter((l) => l.status === 'Awaiting Payment').length,
    pendingPrescriptions: prescriptions.filter((p) => p.status === 'Pending').length,
    totalOutstanding: patientAccounts.reduce((s, a) => s + a.outstandingBalance, 0),
    inpatientUnpaidAlerts: getReceptionInpatientUnpaidAlerts().length,
    obstetricPendingPayments: obstetricDeliveries.filter((d) => d.status === 'Pending').length,
    todayRevenue: incomeRecords.filter((i) => i.createdAt.startsWith(today())).reduce((s, i) => s + i.amount, 0),
    bedOccupancy: beds.filter((b) => b.isOccupied).length,
    totalBeds: beds.length,
    emergencyActive: emergencyCases.filter((e) => e.status === 'Active').length,
  }
}

export type DateFilterPeriod = 'day' | 'week' | 'month' | 'custom'

export function getDateRange(period: DateFilterPeriod, customStart?: string, customEnd?: string): { start: string; end: string } {
  const d = new Date()
  const end = customEnd ?? d.toISOString().split('T')[0]
  if (period === 'custom' && customStart) {
    return { start: customStart, end }
  }
  if (period === 'day') {
    const day = d.toISOString().split('T')[0]
    return { start: day, end: day }
  }
  if (period === 'week') {
    const startDate = new Date(d)
    startDate.setDate(d.getDate() - 6)
    return { start: startDate.toISOString().split('T')[0], end }
  }
  if (period === 'month') {
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { start, end }
  }
  if (customStart) return { start: customStart, end }
  const day = d.toISOString().split('T')[0]
  return { start: day, end: day }
}

function recordDate(iso: string): string {
  return iso.split('T')[0]
}

export function filterIncomeByDateRange(start: string, end: string): IncomeRecord[] {
  return incomeRecords.filter((r) => {
    const d = recordDate(r.createdAt)
    return d >= start && d <= end
  })
}

export function filterExpensesByDateRange(start: string, end: string): ExpenseRecord[] {
  return expenseRecords.filter((r) => {
    const d = recordDate(r.createdAt)
    return d >= start && d <= end
  })
}

export function getIncomeByCategory(records: IncomeRecord[]): Record<ChargeType, number> {
  const totals = {} as Record<ChargeType, number>
  for (const r of records) {
    totals[r.category] = (totals[r.category] ?? 0) + r.amount
  }
  return totals
}

export function getTodayReceptionSummary() {
  const day = today()
  const todayIncome = incomeRecords.filter((r) => recordDate(r.createdAt) === day)
  const doctors = getStaffByRole('doctor')
  const byDoctor = doctors.map((doc) => ({
    doctorId: doc.id,
    doctorName: `Dr. ${doc.firstName} ${doc.lastName}`,
    visitCount: visits.filter((v) => v.visitDate === day && v.assignedDoctorId === doc.id).length,
    amount: todayIncome.filter((i) => i.doctorId === doc.id).reduce((s, i) => s + i.amount, 0),
  }))
  const receptionOnly = todayIncome
    .filter((i) => i.category === 'Registration' || (i.category === 'Consultation' && !i.doctorId))
    .reduce((s, i) => s + i.amount, 0)
  const labTotal = todayIncome.filter((i) => i.category === 'Laboratory').reduce((s, i) => s + i.amount, 0)
  const pharmacyTotal = todayIncome.filter((i) => i.category === 'Pharmacy').reduce((s, i) => s + i.amount, 0)
  const total = todayIncome.reduce((s, i) => s + i.amount, 0)
  return { byDoctor, receptionOnly, labTotal, pharmacyTotal, total, todayIncome }
}

export function getSupplyExpenses(start: string, end: string): number {
  const expenseTotal = filterExpensesByDateRange(start, end)
    .filter((e) => e.category === 'Supply Expenses')
    .reduce((s, e) => s + e.amount, 0)
  const internalUsage = stockTransactions
    .filter((t) => t.type === 'Internal Usage')
    .filter((t) => {
      const d = recordDate(t.createdAt)
      return d >= start && d <= end
    })
    .reduce((s, t) => {
      const item = inventoryItems.find((i) => i.id === t.itemId)
      return s + t.quantity * (t.unitPrice ?? item?.unitPrice ?? 0)
    }, 0)
  return expenseTotal + internalUsage
}

export function getDoctorPatientNumberFee(): number {
  return systemSettings.doctorPatientNumberFee ?? systemSettings.consultationFee
}

export function getEmergencyPatientNumberFee(): number {
  return systemSettings.emergencyPatientNumberFee ?? systemSettings.registrationFee
}

export function getStaffServiceFee(staffId: string): number {
  return getStaffRegistrationFee(staffId)
}

/** Registration / patient number fee — per-doctor fee on staff, else admin defaults */
export function getStaffRegistrationFee(staffId: string): number {
  const staff = getStaffById(staffId)
  if (!staff) return 0
  if (staff.serviceFee != null) return staff.serviceFee
  if (staff.role === 'doctor' || staff.role === 'emergency') return getDoctorPatientNumberFee()
  return systemSettings.registrationFee
}

export function setStaffRegistrationFee(staffId: string, fee: number): void {
  const staff = getStaffById(staffId)
  if (!staff) return
  staff.serviceFee = Math.max(0, fee)
  stampModified(staff)
  schedulePersist()
}

export function setRegistrationFeeForAllDoctors(fee: number): void {
  const amount = Math.max(0, fee)
  systemSettings.doctorPatientNumberFee = amount
  systemSettings.consultationFee = amount
  stampModified(systemSettings)
  systemSettings.emergencyPatientNumberFee = amount
  for (const staff of staffUsers) {
    if ((staff.role === 'doctor' || staff.role === 'emergency') && staff.isActive) {
      staff.serviceFee = amount
      stampModified(staff)
    }
  }
  schedulePersist()
}

export function setRegistrationFeeForAllEmergency(fee: number): void {
  setRegistrationFeeForAllDoctors(fee)
}

export function setRegistrationFeeForAllReferralStaff(fee: number): void {
  setRegistrationFeeForAllDoctors(fee)
}

export function getReferralStaffForRegistration(): StaffUser[] {
  return staffUsers.filter(
    (s) => s.isActive && (s.role === 'doctor' || s.role === 'emergency'),
  )
}

export function getObstetricianFee(): number {
  return systemSettings.obstetricianFee ?? 0
}

export function setObstetricianFee(amount: number): void {
  systemSettings.obstetricianFee = Math.max(0, amount)
  stampModified(systemSettings)
  touchHmsStore()
}

export function getObstetricDoctors(): StaffUser[] {
  return staffUsers.filter((s) => s.isActive && s.role === 'doctor')
}

export function getObstetricDeliveries(): ObstetricDelivery[] {
  return [...obstetricDeliveries]
}

export function getObstetricDeliveryById(id: string): ObstetricDelivery | undefined {
  return obstetricDeliveries.find((d) => d.id === id)
}

export function getObstetricReceiptByDeliveryId(id: string): ReceptionReceipt | undefined {
  const row = getObstetricDeliveryById(id)
  if (!row?.receiptId) return undefined
  return receptionReceipts.find((r) => r.id === row.receiptId)
}

export function createObstetricDelivery(params: {
  motherFullName: string
  motherAge: number
  motherPhone: string
  childGender: ObstetricChildGender
  doctorId: string
  createdBy: string
}): ObstetricDelivery | null {
  const doctor = getStaffById(params.doctorId)
  if (!doctor || doctor.role !== 'doctor') return null

  const motherFullName = params.motherFullName.trim()
  const motherPhone = params.motherPhone.trim()
  if (!motherFullName || !motherPhone || params.motherAge < 1) return null

  const delivery: ObstetricDelivery = {
    id: generateId('obst-del'),
    registrationNumber: generateNumber('OBT'),
    motherFullName,
    motherAge: params.motherAge,
    motherPhone,
    childGender: params.childGender,
    doctorId: params.doctorId,
    obstetricianFee: getObstetricianFee(),
    amountPaid: 0,
    paymentConfirmed: false,
    status: 'Pending',
    createdAt: now(),
    createdBy: params.createdBy,
    lastModifiedAt: now(),
  }
  obstetricDeliveries.push(delivery)
  touchHmsStore()
  return delivery
}

export function updateObstetricDelivery(
  id: string,
  updates: {
    motherFullName?: string
    motherAge?: number
    motherPhone?: string
    childGender?: ObstetricChildGender
    doctorId?: string
  },
): boolean {
  const row = obstetricDeliveries.find((d) => d.id === id)
  if (!row || row.status === 'Paid') return false

  if (updates.doctorId) {
    const doctor = getStaffById(updates.doctorId)
    if (!doctor || doctor.role !== 'doctor') return false
    row.doctorId = updates.doctorId
  }
  if (updates.motherFullName !== undefined) {
    const name = updates.motherFullName.trim()
    if (!name) return false
    row.motherFullName = name
  }
  if (updates.motherAge !== undefined) {
    if (updates.motherAge < 1) return false
    row.motherAge = updates.motherAge
  }
  if (updates.motherPhone !== undefined) {
    const phone = updates.motherPhone.trim()
    if (!phone) return false
    row.motherPhone = phone
  }
  if (updates.childGender !== undefined) row.childGender = updates.childGender

  row.obstetricianFee = getObstetricianFee()
  row.lastModifiedAt = now()
  touchHmsStore()
  return true
}

export function deleteObstetricDelivery(id: string): boolean {
  const idx = obstetricDeliveries.findIndex((d) => d.id === id)
  if (idx < 0) return false
  if (obstetricDeliveries[idx].status === 'Paid') return false
  obstetricDeliveries.splice(idx, 1)
  touchHmsStore()
  return true
}

export function confirmObstetricDeliveryPayment(
  id: string,
  collectedBy: string,
): ReceptionReceipt | null {
  const row = obstetricDeliveries.find((d) => d.id === id)
  if (!row || row.paymentConfirmed || row.status === 'Paid') return null

  const fee = row.obstetricianFee > 0 ? row.obstetricianFee : getObstetricianFee()
  if (fee <= 0) return null

  const doctor = getStaffById(row.doctorId)
  const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'
  const receiptNumber = generateNumber('RCP')
  const paymentNow = now()
  const syntheticPatientId = `obst-${row.id}`

  payments.push({
    id: generateId('pay'),
    patientId: syntheticPatientId,
    amount: fee,
    paymentMethod: 'Cash',
    receiptNumber,
    description: 'Obstetrician Fee',
    receivedBy: collectedBy,
    createdAt: paymentNow,
  })

  incomeRecords.push({
    id: generateId('inc'),
    category: 'Obstetrics',
    amount: fee,
    description: `Obstetrician — ${row.motherFullName}`,
    reference: row.registrationNumber,
    doctorId: row.doctorId,
    receivedBy: collectedBy,
    createdAt: paymentNow,
  })

  row.paymentConfirmed = true
  row.status = 'Paid'
  row.amountPaid = fee
  row.obstetricianFee = fee
  row.paymentConfirmedAt = paymentNow
  row.paidByReceptionId = collectedBy
  row.receiptNumber = receiptNumber
  row.lastModifiedAt = paymentNow

  const receipt: ReceptionReceipt = {
    id: generateId('rcpt'),
    receiptNumber,
    type: 'obstetric',
    patientId: syntheticPatientId,
    doctorId: row.doctorId,
    doctorName,
    patientNumber: 0,
    isEmergency: false,
    lineItems: [{ description: 'Obstetrician Fee', amount: fee }],
    subtotal: fee,
    discountAmount: 0,
    total: fee,
    paymentMethod: 'Cash',
    paymentConfirmed: true,
    obstetricRegistrationNumber: row.registrationNumber,
    motherFullName: row.motherFullName,
    motherAge: row.motherAge,
    motherPhone: row.motherPhone,
    childGender: row.childGender,
    createdAt: paymentNow,
    createdBy: collectedBy,
  }
  receptionReceipts.push(receipt)
  row.receiptId = receipt.id
  touchHmsStore()
  return receipt
}

export function getDoctorCommissionPayouts(): DoctorCommissionPayout[] {
  return [...doctorCommissionPayouts]
}

export function getDoctorCommissionPayoutForMonth(
  doctorId: string,
  periodMonth: string,
): DoctorCommissionPayout | undefined {
  return doctorCommissionPayouts.find(
    (p) => p.doctorId === doctorId && p.periodMonth === periodMonth,
  )
}

export function isDoctorCommissionPaidForMonth(doctorId: string, periodMonth: string): boolean {
  return Boolean(getDoctorCommissionPayoutForMonth(doctorId, periodMonth))
}

export function confirmDoctorCommissionPayout(params: {
  periodMonth: string
  confirmedBy: string
  report: DoctorFinancialReport
  notes?: string
}): DoctorCommissionPayout {
  const existing = getDoctorCommissionPayoutForMonth(params.report.doctorId, params.periodMonth)
  if (existing) {
    throw new Error(`Commission for ${params.report.doctorName} in ${params.periodMonth} is already confirmed.`)
  }

  const payout: DoctorCommissionPayout = {
    ...params.report,
    id: generateId('dcp'),
    periodMonth: params.periodMonth,
    confirmedAt: now(),
    confirmedBy: params.confirmedBy,
    notes: params.notes,
  }
  doctorCommissionPayouts.push(payout)
  touchHmsStore()
  schedulePersist()
  return payout
}

export function isStaffCredentialTaken(
  username: string,
  email: string,
  excludeId?: string,
): boolean {
  const normalizedUsername = username.trim().toLowerCase()
  const normalizedEmail = email.trim().toLowerCase()
  return staffUsers.some(
    (staff) =>
      staff.id !== excludeId &&
      (staff.username.toLowerCase() === normalizedUsername ||
        staff.email.toLowerCase() === normalizedEmail),
  )
}

export function isStaffUserActive(userId?: string): boolean {
  if (!userId) return false
  const staff = getStaffById(userId)
  return Boolean(staff?.isActive)
}

const BOOTSTRAP_ADMIN_ID = 'staff-001'

export function removeStaffUser(staffId: string): { ok: boolean; error?: string } {
  if (staffId === BOOTSTRAP_ADMIN_ID) {
    return { ok: false, error: 'Cannot delete the system admin account.' }
  }
  const index = staffUsers.findIndex((staff) => staff.id === staffId)
  if (index < 0) return { ok: false, error: 'User not found.' }
  staffUsers.splice(index, 1)
  hmsStoreRevision += 1
  schedulePersist()
  return { ok: true }
}

export function getLabTestPriceByName(testName: string): number {
  const item = labTestCatalog.find((t) => t.isActive && t.testName === testName)
  return item?.price ?? 0
}

export function calculateLabRequestSubtotal(tests: { testName: string }[]): number {
  return tests.reduce((sum, t) => sum + getLabTestPriceByName(t.testName), 0)
}

// ─── Doctor consultation CRUD (consultant notes, prescriptions, labs, surgery, admissions) ───

export function getClinicalNoteForVisit(visitId: string): ClinicalNote | undefined {
  return clinicalNotes.find((n) => n.visitId === visitId)
}

export function saveClinicalNoteForVisit(input: {
  visitId: string
  patientId: string
  doctorId: string
  note: string
}): ClinicalNote {
  const note = input.note.trim()
  if (!note) throw new Error('Consultant note is required')

  const existing = getClinicalNoteForVisit(input.visitId)
  if (existing) {
    existing.note = note
    existing.lastModifiedAt = now()
    schedulePersist()
    return existing
  }

  const entry: ClinicalNote = {
    id: generateId('cn'),
    visitId: input.visitId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    note,
    createdAt: now(),
    lastModifiedAt: now(),
  }
  clinicalNotes.push(entry)
  schedulePersist()
  return entry
}

export function getPrescriptionForVisit(visitId: string): Prescription | undefined {
  return prescriptions
    .filter((p) => p.visitId === visitId && p.status !== 'Dispensed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function getPrescriptionsForPatient(patientId: string): Prescription[] {
  return prescriptions
    .filter((p) => p.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** All prescriptions this doctor wrote for a patient (every visit, from database) */
export function getPrescriptionsForPatientByDoctor(
  patientId: string,
  doctorId: string,
): Prescription[] {
  return prescriptions
    .filter((p) => p.patientId === patientId && p.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function savePrescriptionForVisit(input: {
  visitId: string
  patientId: string
  doctorId: string
  items: PrescriptionItem[]
}): Prescription {
  const validItems = input.items.filter((i) => i.medicine.trim())
  if (validItems.length === 0) throw new Error('Add at least one medicine')

  const adm = getActiveAdmissionForVisit(input.visitId)
  const existing = getPrescriptionForVisit(input.visitId)

  if (adm) {
    if (existing && existing.status !== 'Dispensed' && isInpatientMedicineRequest(existing)) {
      existing.items = validItems
      existing.totalFee = estimatePrescriptionTotalFee(existing)
      existing.lastModifiedAt = now()
      if (existing.status === 'Printed') existing.status = 'Pending'
      schedulePersist()
      return existing
    }
    if (existing && existing.status !== 'Dispensed' && !isInpatientMedicineRequest(existing)) {
      existing.admissionId = adm.id
      existing.orderedById = input.doctorId
      existing.items = validItems
      existing.status = 'Pending'
      existing.totalFee = estimatePrescriptionTotalFee(existing)
      existing.lastModifiedAt = now()
      schedulePersist()
      return existing
    }
    return createInpatientPrescription({
      visitId: input.visitId,
      patientId: input.patientId,
      admissionId: adm.id,
      doctorId: input.doctorId,
      orderedById: input.doctorId,
      items: validItems,
    })
  }

  if (existing) {
    existing.items = validItems
    existing.status = 'Printed'
    existing.lastModifiedAt = now()
    schedulePersist()
    return existing
  }

  const rx: Prescription = {
    id: generateId('rx'),
    visitId: input.visitId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    items: validItems,
    status: 'Printed',
    createdAt: now(),
    lastModifiedAt: now(),
  }
  prescriptions.push(rx)
  schedulePersist()
  return rx
}

export function createLabRequestForVisit(input: {
  visitId: string
  patientId: string
  doctorId: string
  testNames: string[]
}): LabRequest {
  const testNames = input.testNames.map((n) => n.trim()).filter(Boolean)
  if (testNames.length === 0) throw new Error('Add at least one test')

  const tests = testNames.map((testName) => ({ testName }))
  const ts = now()
  const lab: LabRequest = {
    id: generateId('lab'),
    requestNumber: generateNumber('LR'),
    visitId: input.visitId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    tests,
    status: 'Awaiting Payment',
    totalFee: calculateLabRequestSubtotal(tests),
    createdAt: ts,
    lastModifiedAt: ts,
  }
  labRequests.push(lab)
  schedulePersist()
  return lab
}

export function getAdmissionRequestForVisit(visitId: string): AdmissionRequest | undefined {
  return admissionRequests.find((a) => a.visitId === visitId && a.status !== 'Cancelled')
}

export function saveAdmissionRequestForVisit(input: {
  visitId: string
  patientId: string
  doctorId: string
  reason: string
}): AdmissionRequest {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Enter reason for admission')

  const existing = getAdmissionRequestForVisit(input.visitId)
  if (existing) {
    existing.reason = reason
    existing.lastModifiedAt = now()
    schedulePersist()
    return existing
  }

  const req: AdmissionRequest = {
    id: generateId('adm-req'),
    visitId: input.visitId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    reason,
    status: 'Pending',
    createdAt: now(),
    lastModifiedAt: now(),
  }
  admissionRequests.push(req)
  schedulePersist()
  return req
}

export function getSurgeryRequestForVisit(visitId: string): SurgeryRequest | undefined {
  return surgeryRequests.find((s) => s.visitId === visitId && s.status !== 'Cancelled')
}

export function saveSurgeryRequestForVisit(input: {
  visitId: string
  patientId: string
  doctorId: string
  surgeryCatalogId: string
  notes?: string
}): SurgeryRequest {
  const catalog = getSurgeryById(input.surgeryCatalogId)
  if (!catalog) throw new Error('Surgery not found in catalog')

  const existing = getSurgeryRequestForVisit(input.visitId)
  if (existing && isSurgeryFeePaid(existing)) {
    throw new Error('This surgery is already paid or scheduled — contact reception to make changes.')
  }

  if (existing) {
    existing.surgeryCatalogId = input.surgeryCatalogId
    existing.surgeryName = catalog.name
    existing.notes = input.notes?.trim() || undefined
    existing.surgeryFee = catalog.price
    existing.status = 'Pending'
    existing.paymentConfirmedAt = undefined
    existing.paymentMethod = undefined
    existing.amountPaid = undefined
    existing.paidByReceptionId = undefined
    existing.lastModifiedAt = now()
    attachSurgeryToInpatientCreditBookIfEligible(existing, input.doctorId)
    schedulePersist()
    return existing
  }

  const req: SurgeryRequest = {
    id: generateId('srg-req'),
    requestNumber: generateNumber('SRG'),
    visitId: input.visitId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    surgeryCatalogId: input.surgeryCatalogId,
    surgeryName: catalog.name,
    notes: input.notes?.trim() || undefined,
    status: 'Pending',
    surgeryFee: catalog.price,
    createdAt: now(),
    lastModifiedAt: now(),
  }
  surgeryRequests.push(req)
  attachSurgeryToInpatientCreditBookIfEligible(req, input.doctorId)
  schedulePersist()
  return req
}

export function createDoctorOrder(input: {
  admissionId: string
  patientId: string
  doctorId: string
  orderType: DoctorOrderType
  description: string
  medicine?: string
  quantity?: number
}): DoctorOrder {
  const description = input.description.trim()
  if (!description) throw new Error('Order description is required')

  const order: DoctorOrder = {
    id: generateId('ord'),
    patientId: input.patientId,
    admissionId: input.admissionId,
    doctorId: input.doctorId,
    orderType: input.orderType,
    description,
    medicine: input.medicine?.trim() || undefined,
    quantity: input.quantity,
    status: 'Pending',
    createdAt: now(),
  }
  doctorOrders.push(order)
  schedulePersist()
  return order
}

export type ConfirmLabFeePaymentInput = {
  labRequestId: string
  receptionId: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  total: number
  lineItems: { testName: string; price: number }[]
}

/** Reception confirms lab payment, records receipt, and sends request to laboratory */
export function confirmLabFeePayment(input: ConfirmLabFeePaymentInput): ReceptionReceipt {
  const lab = labRequests.find((l) => l.id === input.labRequestId)
  if (!lab) throw new Error('Lab request not found')
  if (lab.status !== 'Awaiting Payment') throw new Error('Lab fee already collected for this request')

  const patient = getPatientById(lab.patientId)
  const doctor = getStaffById(lab.doctorId)
  if (!patient || !doctor) throw new Error('Patient or doctor not found')

  const receiptNumber = generateNumber('RCP')
  const now = new Date().toISOString()
  const visit = getVisitById(lab.visitId)
  const doctorName =
    doctor.role === 'emergency' ? 'Emergency' : `Dr. ${doctor.firstName} ${doctor.lastName}`

  lab.status = 'Pending'
  lab.totalFee = input.subtotal
  lab.discountId = undefined
  lab.discountPercent = input.discountPercent > 0 ? input.discountPercent : undefined
  lab.discountAmount = input.discountAmount
  lab.amountPaid = input.total
  lab.paymentConfirmedAt = now
  lab.paidByReceptionId = input.receptionId
  lab.lastModifiedAt = now

  payments.push({
    id: generateId('pay'),
    patientId: lab.patientId,
    visitId: lab.visitId,
    amount: input.total,
    paymentMethod: 'Cash',
    receiptNumber,
    description: `Lab fees — ${lab.requestNumber}`,
    receivedBy: input.receptionId,
    createdAt: now,
  })

  incomeRecords.push({
    id: generateId('inc'),
    category: 'Laboratory',
    amount: input.total,
    description: `Lab fees — ${patient.fullName} (${lab.requestNumber})`,
    reference: lab.id,
    doctorId: lab.doctorId,
    receivedBy: input.receptionId,
    createdAt: now,
  })

  const receipt: ReceptionReceipt = {
    id: generateId('rcpt'),
    receiptNumber,
    type: 'lab',
    patientId: lab.patientId,
    visitId: lab.visitId,
    doctorId: lab.doctorId,
    doctorName,
    patientNumber: visit?.patientNumber ?? visit?.queueNumber ?? 0,
    isEmergency: visit?.isEmergency ?? false,
    lineItems: input.lineItems.map((l) => ({ description: l.testName, amount: l.price })),
    subtotal: input.subtotal,
    discountPercent: input.discountPercent > 0 ? input.discountPercent : undefined,
    discountAmount: input.discountAmount,
    total: input.total,
    paymentConfirmed: true,
    labRequestNumber: lab.requestNumber,
    createdAt: now,
    createdBy: input.receptionId,
  }
  receptionReceipts.push(receipt)
  hmsStoreRevision += 1
  return receipt
}

export function getLabRequestsAwaitingPayment(): LabRequest[] {
  return labRequests.filter((l) => l.status === 'Awaiting Payment')
}

/** Paid / in-lab workflow only (excludes awaiting reception payment and cancelled) */
export function getLabVisibleRequests(): LabRequest[] {
  return labRequests.filter((l) => l.status !== 'Awaiting Payment' && l.status !== 'Cancelled')
}

export function getLabRequestsForDoctor(doctorId: string): LabRequest[] {
  return labRequests
    .filter(
      (l) =>
        l.doctorId === doctorId &&
        l.status !== 'Awaiting Payment' &&
        l.status !== 'Cancelled' &&
        Boolean(l.paymentConfirmedAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Lab tech saves test results — status becomes Completed */
export function completeLabRequest(labRequestId: string, tests: LabTestItem[]): LabRequest {
  const lab = labRequests.find((l) => l.id === labRequestId)
  if (!lab) throw new Error('Lab request not found')
  if (lab.status === 'Awaiting Payment') {
    throw new Error('This request is awaiting payment at reception')
  }
  const now = new Date().toISOString()
  lab.tests = tests.map((t) => ({ ...t }))
  lab.status = 'Completed'
  lab.completedAt = now
  lab.lastModifiedAt = now
  touchHmsStore()
  return lab
}

/** All lab orders for a patient — includes Cancelled (consultation history) */
export function getLabRequestsForPatientHistory(
  patientId: string,
  options?: { doctorId?: string; excludeVisitId?: string },
): LabRequest[] {
  return labRequests
    .filter((l) => {
      if (l.patientId !== patientId) return false
      if (options?.doctorId && l.doctorId !== options.doctorId) return false
      if (options?.excludeVisitId && l.visitId === options.excludeVisitId) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Active lab orders only (excludes Cancelled) */
export function getLabRequestsForPatient(patientId: string): LabRequest[] {
  return labRequests
    .filter((l) => l.patientId === patientId && l.status !== 'Cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** All lab orders this doctor sent for a patient — includes results when Completed */
export function getLabRequestsForPatientByDoctor(
  patientId: string,
  doctorId: string,
): LabRequest[] {
  return labRequests
    .filter(
      (l) =>
        l.patientId === patientId &&
        l.doctorId === doctorId &&
        l.status !== 'Cancelled',
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getLabRequestsForVisit(visitId: string): LabRequest[] {
  return labRequests
    .filter((l) => l.visitId === visitId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getLabRequestById(id: string): LabRequest | undefined {
  return labRequests.find((l) => l.id === id)
}

export function markLabViewedByDoctor(labId: string): boolean {
  const lab = labRequests.find((l) => l.id === labId)
  if (lab && lab.status === 'Completed' && !lab.doctorViewedAt) {
    const now = new Date().toISOString()
    lab.doctorViewedAt = now
    lab.lastModifiedAt = now
    hmsStoreRevision += 1
    return true
  }
  return false
}

export function isLabResultViewedByDoctor(lab: LabRequest): boolean {
  return lab.status === 'Completed' && Boolean(lab.doctorViewedAt)
}

/** Doctor opens completed lab results — mark Viewed and save to database */
export async function persistLabViewedByDoctorNowAsync(labRequestId: string): Promise<string> {
  const changed = markLabViewedByDoctor(labRequestId)
  if (!changed) {
    const lab = getLabRequestById(labRequestId)
    if (!lab) throw new Error('Lab request not found')
    return new Date().toISOString()
  }
  return persistLabRequestNowAsync(labRequestId)
}

export function getLabTestById(id: string): LabTestCatalog | undefined {
  return labTestCatalog.find((t) => t.id === id)
}

export function getMedicineCatalogById(id: string): MedicineCatalogItem | undefined {
  return medicineCatalog.find((m) => m.id === id)
}

export function getSurgeryById(id: string): SurgeryCatalog | undefined {
  return surgeryCatalog.find((s) => s.id === id)
}

export function getDiscountById(id: string): Discount | undefined {
  return discounts.find((d) => d.id === id)
}

export function getRoomById(id: string): Room | undefined {
  return rooms.find((r) => r.id === id)
}

export function getWardById(id: string): Ward | undefined {
  return wards.find((w) => w.id === id)
}

export function getBedsForRoom(roomId: string): Bed[] {
  return beds.filter((b) => b.roomId === roomId)
}

export function syncRoomBedCounts(): void {
  for (const room of rooms) {
    room.bedCount = getBedsForRoom(room.id).length
  }
}

function stampModified<T extends { lastModifiedAt?: string }>(entity: T): void {
  entity.lastModifiedAt = new Date().toISOString()
}

export function saveWardEntry(data: { id?: string; name: string; description?: string }): Ward {
  const name = data.name.trim()
  if (!name) throw new Error('Ward name is required')

  if (data.id) {
    const existing = wards.find((w) => w.id === data.id)
    if (existing) {
      existing.name = name
      existing.description = data.description?.trim() || `${name} ward`
      stampModified(existing)
      schedulePersist()
      return existing
    }
  }

  const ward: Ward = {
    id: generateId('ward'),
    name,
    description: data.description?.trim() || `${name} ward`,
    lastModifiedAt: new Date().toISOString(),
  }
  wards.push(ward)
  schedulePersist()
  return ward
}

export function deleteWardEntry(id: string): void {
  const wardRooms = rooms.filter((r) => r.wardId === id)
  for (const room of wardRooms) {
    deleteRoomEntry(room.id)
  }
  const index = wards.findIndex((w) => w.id === id)
  if (index < 0) throw new Error('Ward not found')
  wards.splice(index, 1)
  hmsStoreRevision += 1
  schedulePersist()
}

export function saveRoomEntry(data: { id?: string; wardId: string; name: string }): Room {
  const name = data.name.trim()
  if (!name) throw new Error('Room name is required')
  if (!wards.find((w) => w.id === data.wardId)) throw new Error('Ward not found')

  if (data.id) {
    const existing = rooms.find((r) => r.id === data.id)
    if (existing) {
      existing.name = name
      existing.wardId = data.wardId
      for (const bed of beds.filter((b) => b.roomId === existing.id)) {
        bed.wardId = data.wardId
        stampModified(bed)
      }
      stampModified(existing)
      syncRoomBedCounts()
      schedulePersist()
      return existing
    }
  }

  const room: Room = {
    id: generateId('room'),
    wardId: data.wardId,
    name,
    bedCount: 0,
    lastModifiedAt: new Date().toISOString(),
  }
  rooms.push(room)
  schedulePersist()
  return room
}

export function deleteRoomEntry(id: string): void {
  const roomBeds = beds.filter((b) => b.roomId === id)
  if (roomBeds.some((b) => b.isOccupied)) {
    throw new Error('Cannot delete a room with occupied beds')
  }
  for (const bed of roomBeds) {
    const bedIndex = beds.findIndex((b) => b.id === bed.id)
    if (bedIndex >= 0) beds.splice(bedIndex, 1)
  }
  const index = rooms.findIndex((r) => r.id === id)
  if (index < 0) throw new Error('Room not found')
  rooms.splice(index, 1)
  hmsStoreRevision += 1
  schedulePersist()
}

export function saveBedEntry(data: {
  id?: string
  roomId: string
  bedNumber: string
  name: string
  dailyRate: number
}): Bed {
  const room = rooms.find((r) => r.id === data.roomId)
  if (!room) throw new Error('Room not found')

  const bedNumber = data.bedNumber.trim()
  const name = data.name.trim()
  if (!bedNumber || !name) throw new Error('Bed number and name are required')

  if (data.id) {
    const existing = beds.find((b) => b.id === data.id)
    if (existing) {
      if (existing.isOccupied && existing.roomId !== data.roomId) {
        throw new Error('Cannot move an occupied bed to another room')
      }
      existing.roomId = data.roomId
      existing.wardId = room.wardId
      existing.bedNumber = bedNumber
      existing.name = name
      existing.dailyRate = data.dailyRate
      stampModified(existing)
      syncRoomBedCounts()
      schedulePersist()
      return existing
    }
  }

  const bed: Bed = {
    id: generateId('bed'),
    roomId: data.roomId,
    wardId: room.wardId,
    bedNumber,
    name,
    dailyRate: data.dailyRate,
    isOccupied: false,
    lastModifiedAt: new Date().toISOString(),
  }
  beds.push(bed)
  syncRoomBedCounts()
  schedulePersist()
  return bed
}

export function deleteBedEntry(id: string): void {
  const bed = beds.find((b) => b.id === id)
  if (!bed) throw new Error('Bed not found')
  if (bed.isOccupied) throw new Error('Cannot delete an occupied bed')

  const index = beds.findIndex((b) => b.id === id)
  beds.splice(index, 1)
  syncRoomBedCounts()
  hmsStoreRevision += 1
  schedulePersist()
}

// â”€â”€â”€ Local storage persistence (mock DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type HmsStoreSnapshot = {
  version: typeof HMS_STORE_VERSION
  idCounter: number
  departments: Department[]
  staffUsers: StaffUser[]
  patients: Patient[]
  patientAccounts: PatientAccount[]
  accountTransactions: AccountTransaction[]
  receptionReceipts: ReceptionReceipt[]
  visits: Visit[]
  clinicalNotes: ClinicalNote[]
  diagnoses: Diagnosis[]
  prescriptions: Prescription[]
  labRequests: LabRequest[]
  surgeryRequests: SurgeryRequest[]
  departmentSupplyRequests: DepartmentSupplyRequest[]
  pharmacySupplyRequests: PharmacySupplyRequest[]
  labSupplyRequests: LabSupplyRequest[]
  admissionRequests: AdmissionRequest[]
  wards: Ward[]
  rooms: Room[]
  beds: Bed[]
  labTestCatalog: LabTestCatalog[]
  medicineCatalog: MedicineCatalogItem[]
  surgeryCatalog: SurgeryCatalog[]
  discounts: Discount[]
  patientDiscounts: PatientDiscount[]
  obstetricDeliveries: ObstetricDelivery[]
  doctorCommissionPayouts: DoctorCommissionPayout[]
  admissions: Admission[]
  medicationAdministrations: MedicationAdministration[]
  nursingNotes: NursingNote[]
  doctorOrders: DoctorOrder[]
  inventoryItems: InventoryItem[]
  stockTransactions: StockTransaction[]
  payments: Payment[]
  emergencyCases: EmergencyCase[]
  incomeRecords: IncomeRecord[]
  expenseRecords: ExpenseRecord[]
  systemSettings: SystemSettings
}

function replaceArrayInPlace<T>(target: T[], source: T[]): void {
  target.length = 0
  target.push(...source)
}

function getHmsStoreSnapshot(): HmsStoreSnapshot {
  return {
    version: HMS_STORE_VERSION,
    idCounter,
    departments: [...departments],
    staffUsers: [...staffUsers],
    patients: patients.map((p) => ({ ...p })),
    patientAccounts: [...patientAccounts],
    accountTransactions: [...accountTransactions],
    receptionReceipts: [...receptionReceipts],
    visits: visits.map((v) => ({ ...v })),
    clinicalNotes: [...clinicalNotes],
    diagnoses: [...diagnoses],
    prescriptions: [...prescriptions],
    labRequests: [...labRequests],
    surgeryRequests: [...surgeryRequests],
    departmentSupplyRequests: [...departmentSupplyRequests],
    pharmacySupplyRequests: [...pharmacySupplyRequests],
    labSupplyRequests: [...labSupplyRequests],
    admissionRequests: [...admissionRequests],
    wards: [...wards],
    rooms: [...rooms],
    beds: [...beds],
    labTestCatalog: [...labTestCatalog],
    medicineCatalog: [...medicineCatalog],
    surgeryCatalog: [...surgeryCatalog],
    discounts: [...discounts],
    patientDiscounts: [...patientDiscounts],
    obstetricDeliveries: [...obstetricDeliveries],
    doctorCommissionPayouts: [...doctorCommissionPayouts],
    admissions: [...admissions],
    medicationAdministrations: [...medicationAdministrations],
    nursingNotes: [...nursingNotes],
    doctorOrders: [...doctorOrders],
    inventoryItems: [...inventoryItems],
    stockTransactions: [...stockTransactions],
    payments: [...payments],
    emergencyCases: [...emergencyCases],
    incomeRecords: [...incomeRecords],
    expenseRecords: [...expenseRecords],
    systemSettings: JSON.parse(JSON.stringify(systemSettings)) as SystemSettings,
  }
}

function hydrateHmsStore(snapshot: HmsStoreSnapshot): void {
  idCounter = snapshot.idCounter ?? 100
  replaceArrayInPlace(departments, snapshot.departments ?? [])
  replaceArrayInPlace(staffUsers, snapshot.staffUsers ?? [])
  replaceArrayInPlace(patients, snapshot.patients ?? [])
  replaceArrayInPlace(patientAccounts, snapshot.patientAccounts ?? [])
  replaceArrayInPlace(accountTransactions, snapshot.accountTransactions ?? [])
  replaceArrayInPlace(receptionReceipts, snapshot.receptionReceipts ?? [])
  replaceArrayInPlace(visits, snapshot.visits ?? [])
  replaceArrayInPlace(clinicalNotes, snapshot.clinicalNotes ?? [])
  replaceArrayInPlace(diagnoses, snapshot.diagnoses ?? [])
  replaceArrayInPlace(prescriptions, snapshot.prescriptions ?? [])
  replaceArrayInPlace(labRequests, snapshot.labRequests ?? [])
  replaceArrayInPlace(surgeryRequests, snapshot.surgeryRequests ?? [])
  replaceArrayInPlace(departmentSupplyRequests, snapshot.departmentSupplyRequests ?? [])
  replaceArrayInPlace(pharmacySupplyRequests, snapshot.pharmacySupplyRequests ?? [])
  replaceArrayInPlace(labSupplyRequests, snapshot.labSupplyRequests ?? [])
  replaceArrayInPlace(admissionRequests, snapshot.admissionRequests ?? [])
  replaceArrayInPlace(wards, snapshot.wards ?? [])
  replaceArrayInPlace(rooms, snapshot.rooms ?? [])
  replaceArrayInPlace(beds, snapshot.beds ?? [])
  replaceArrayInPlace(
    labTestCatalog,
    (snapshot.labTestCatalog ?? []).map((item) => normalizeLabTestCatalogItem(item)),
  )
  replaceArrayInPlace(medicineCatalog, snapshot.medicineCatalog ?? [])
  replaceArrayInPlace(surgeryCatalog, snapshot.surgeryCatalog ?? [])
  replaceArrayInPlace(discounts, snapshot.discounts ?? [])
  replaceArrayInPlace(patientDiscounts, snapshot.patientDiscounts ?? [])
  replaceArrayInPlace(obstetricDeliveries, snapshot.obstetricDeliveries ?? [])
  replaceArrayInPlace(doctorCommissionPayouts, snapshot.doctorCommissionPayouts ?? [])
  replaceArrayInPlace(admissions, snapshot.admissions ?? [])
  syncBedOccupancyFromAdmissions()
  replaceArrayInPlace(medicationAdministrations, snapshot.medicationAdministrations ?? [])
  replaceArrayInPlace(nursingNotes, snapshot.nursingNotes ?? [])
  replaceArrayInPlace(doctorOrders, snapshot.doctorOrders ?? [])
  replaceArrayInPlace(inventoryItems, snapshot.inventoryItems ?? [])
  replaceArrayInPlace(stockTransactions, snapshot.stockTransactions ?? [])
  replaceArrayInPlace(payments, snapshot.payments ?? [])
  replaceArrayInPlace(emergencyCases, snapshot.emergencyCases ?? [])
  replaceArrayInPlace(incomeRecords, snapshot.incomeRecords ?? [])
  replaceArrayInPlace(expenseRecords, snapshot.expenseRecords ?? [])
  applySystemSettingsFromSnapshot(snapshot.systemSettings)
}

function applySystemSettingsFromSnapshot(incoming?: SystemSettings): void {
  if (!incoming) return
  const merged = mergeSystemSettingsDeep(
    JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS)) as SystemSettings,
    incoming,
  )
  const target = systemSettings as unknown as Record<string, unknown>
  for (const key of Object.keys(merged) as (keyof SystemSettings)[]) {
    if (key === 'discountLimits') continue
    target[key] = merged[key]
  }
  systemSettings.discountLimits = {
    reception: { ...merged.discountLimits.reception },
    pharmacy: { ...merged.discountLimits.pharmacy },
  }
}

function wrapMutableStoreWithPersistence(): void {
  departments = createPersistableArray(departments)
  staffUsers = createPersistableArray(staffUsers)
  patients = createPersistableArray(patients)
  patientAccounts = createPersistableArray(patientAccounts)
  accountTransactions = createPersistableArray(accountTransactions)
  receptionReceipts = createPersistableArray(receptionReceipts)
  visits = createPersistableArray(visits)
  clinicalNotes = createPersistableArray(clinicalNotes)
  diagnoses = createPersistableArray(diagnoses)
  prescriptions = createPersistableArray(prescriptions)
  labRequests = createPersistableArray(labRequests)
  surgeryRequests = createPersistableArray(surgeryRequests)
  departmentSupplyRequests = createPersistableArray(departmentSupplyRequests)
  pharmacySupplyRequests = createPersistableArray(pharmacySupplyRequests)
  labSupplyRequests = createPersistableArray(labSupplyRequests)
  admissionRequests = createPersistableArray(admissionRequests)
  wards = createPersistableArray(wards)
  rooms = createPersistableArray(rooms)
  beds = createPersistableArray(beds)
  labTestCatalog = createPersistableArray(labTestCatalog)
  medicineCatalog = createPersistableArray(medicineCatalog)
  surgeryCatalog = createPersistableArray(surgeryCatalog)
  discounts = createPersistableArray(discounts)
  patientDiscounts = createPersistableArray(patientDiscounts)
  obstetricDeliveries = createPersistableArray(obstetricDeliveries)
  doctorCommissionPayouts = createPersistableArray(doctorCommissionPayouts)
  admissions = createPersistableArray(admissions)
  medicationAdministrations = createPersistableArray(medicationAdministrations)
  nursingNotes = createPersistableArray(nursingNotes)
  doctorOrders = createPersistableArray(doctorOrders)
  inventoryItems = createPersistableArray(inventoryItems)
  stockTransactions = createPersistableArray(stockTransactions)
  payments = createPersistableArray(payments)
  emergencyCases = createPersistableArray(emergencyCases)
  incomeRecords = createPersistableArray(incomeRecords)
  expenseRecords = createPersistableArray(expenseRecords)
  systemSettings = createPersistableObject(systemSettings)
}

const hmsStoreEmptySnapshot: HmsStoreSnapshot = createEmptyHmsSnapshot()

function normalizeLegacyVisitStatuses(): void {
  for (const visit of visits) {
    if ((visit.status as string) === 'Pharmacy Pending') {
      visit.status = 'In Consultation'
    }
    if (
      (visit.status === 'Completed' || visit.status === 'Cancelled') &&
      !visit.lastModifiedAt
    ) {
      visit.lastModifiedAt = visit.createdAt
    }
  }
}

// localStorage only when Supabase is off â€” database is the source of truth when enabled
if (!isSupabaseConfigured) {
  const storedHmsSnapshot = loadHmsStoreSnapshot<HmsStoreSnapshot>()
  if (storedHmsSnapshot?.version === HMS_STORE_VERSION) {
    hydrateHmsStore(storedHmsSnapshot)
  }
}
normalizeLegacyVisitStatuses()

wrapMutableStoreWithPersistence()
registerHmsStorePersistence(getHmsStoreSnapshot)

/** Reset in-memory data to empty bootstrap state */
export function resetHmsStoreToSeed(): void {
  hydrateHmsStore(JSON.parse(JSON.stringify(hmsStoreEmptySnapshot)) as HmsStoreSnapshot)
  schedulePersist()
}

/** Clear localStorage and restore empty bootstrap state */
export function clearHmsStoreAndReset(): void {
  clearHmsLocalStorage()
  resetHmsStoreToSeed()
  flushPersist()
}

export { flushPersist as persistHmsStoreNow, flushPersistAsync as persistHmsStoreNowAsync }

/** Fast save after staff user create/edit/delete (~2–3s) */
export async function persistStaffUsersNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveStaffSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after medical catalog add/edit/delete/restock/import */
export async function persistMedicalCatalogNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    clearPendingPersist()
    const savedAt = await saveMedicalCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

export async function saveMedicineCatalogEntryAndPersist(
  input: SaveMedicineCatalogInput,
): Promise<MedicineCatalogItem> {
  clearPendingPersist()
  beginFastSave()
  try {
    const item = saveMedicineCatalogEntry(input, { skipSchedulePersist: true })
    clearPendingPersist()
    const savedAt = await saveMedicalCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return item
  } finally {
    endFastSave()
  }
}

export async function deleteMedicineCatalogEntryAndPersist(id: string): Promise<void> {
  clearPendingPersist()
  beginFastSave()
  try {
    deleteMedicineCatalogEntry(id, { skipSchedulePersist: true })
    clearPendingPersist()
    const savedAt = await saveMedicalCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
  } finally {
    endFastSave()
  }
}

export async function restockMedicineAndPersist(
  input: RestockMedicineInput,
): Promise<MedicineCatalogItem | undefined> {
  clearPendingPersist()
  beginFastSave()
  try {
    const item = restockMedicine(input, { skipSchedulePersist: true })
    if (!item) return undefined
    clearPendingPersist()
    const savedAt = await saveMedicalCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return item
  } finally {
    endFastSave()
  }
}

/** Fast save after surgery catalog add/edit/delete/import */
export async function persistSurgeryCatalogNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveSurgeryCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after ward/room/bed changes */
export async function persistRoomsBedsNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveRoomsBedsSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after lab test add/edit/import or Test ID settings */
export async function persistLabCatalogNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveLabCatalogSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after patient register / edit */
export async function persistPatientsNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await savePatientsSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after doctor releases patient — visit Completed, patient Inactive in queue */
export async function persistReleasePatientNowAsync(visitId: string): Promise<string> {
  const visit = getVisitById(visitId)
  if (!visit) throw new Error('Visit not found')
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await savePatientReleaseSnapshotToSupabase(getHmsStoreSnapshot(), visitId)
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    clearPendingPersist()
    endFastSave()
  }
}

/** Fast save after doctor consultation — notes, prescriptions, labs, surgery, admissions, nurse orders */
export async function persistDoctorConsultationNowAsync(focus?: {
  visitId?: string
  patientId?: string
}): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveDoctorConsultationSnapshotToSupabase(getHmsStoreSnapshot(), focus)
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    clearPendingPersist()
    endFastSave()
  }
}

/** Fast save after admin updates discount limits / system settings */
export async function persistSystemSettingsNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    stampModified(systemSettings)
    const savedAt = await saveSystemSettingsSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    clearPendingPersist()
    endFastSave()
  }
}

/** Fast save after admin updates registration / patient number fees */
export async function persistRegistrationFeesNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    stampModified(systemSettings)
    const savedAt = await saveRegistrationFeesSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after obstetric delivery CRUD or payment */
export async function persistObstetricDeliveryNowAsync(deliveryId?: string): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    if (deliveryId) {
      const row = getObstetricDeliveryById(deliveryId)
      if (row) row.lastModifiedAt = now()
    }
    const savedAt = await saveObstetricDeliverySnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after admin confirms doctor monthly commission payout */
export async function persistDoctorCommissionPayoutNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveDoctorCommissionPayoutSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after reception collects lab fees */
export async function persistLabFeePaymentNowAsync(labRequestId: string): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveLabFeePaymentSnapshotToSupabase(getHmsStoreSnapshot(), labRequestId)
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after lab updates request status (start / complete) */
export async function persistLabRequestNowAsync(labRequestId: string): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveLabRequestSnapshotToSupabase(getHmsStoreSnapshot(), labRequestId)
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after reception collects surgery fees */
export async function persistSurgeryFeePaymentNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveSurgeryFeePaymentSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after inpatient charge / checkout payment */
export async function persistInpatientPaymentNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveInpatientPaymentSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Fast save after patient discount create / collect */
export async function persistPatientDiscountNowAsync(): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await savePatientDiscountSnapshotToSupabase(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Direct save for Edit Patient → Update existing record */
export async function persistPatientProfileNowAsync(patientId: string): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const patient = getPatientById(patientId)
    if (!patient) throw new Error('Patient not found')
    const savedAt = await savePatientProfileSnapshotToSupabase({ ...patient })
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

async function runFastSnapshotSave(
  saveFn: (snapshot: HmsStoreSnapshot) => Promise<string>,
): Promise<string> {
  clearPendingPersist()
  beginFastSave()
  try {
    const savedAt = await saveFn(getHmsStoreSnapshot())
    hmsStoreRevision += 1
    onSupabaseSaved?.(savedAt)
    return savedAt
  } finally {
    endFastSave()
  }
}

/** Reception in-patient room/bed assignment */
export async function persistAdmissionAssignmentNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveAdmissionAssignmentSnapshotToSupabase)
}

/** Emergency case register / update */
export async function persistEmergencyCaseNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveEmergencyCaseSnapshotToSupabase)
}

/** Pharmacy prescription dispense + stock */
export async function persistPharmacyDispenseNowAsync(): Promise<string> {
  return runFastSnapshotSave(savePharmacyDispenseSnapshotToSupabase)
}

/** Stock transactions + inventory updates (pharmacy sales / dispense) */
export async function persistStockTransactionsNowAsync(): Promise<string> {
  return runFastSnapshotSave(savePharmacyDispenseSnapshotToSupabase)
}

/** Inpatient medicine payment at reception (cash or credit book) */
export async function persistInpatientMedicinePaymentNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveInpatientMedicinePaymentSnapshotToSupabase)
}

/** Pharmacy approval of inpatient medicine request */
export async function persistInpatientMedicineApprovalNowAsync(): Promise<string> {
  return runFastSnapshotSave(savePrescriptionSnapshotToSupabase)
}

/** Patient credit account payment */
export async function persistCreditPaymentNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveCreditPaymentSnapshotToSupabase)
}

/** Supply requests (doctor, nurse, lab, pharmacy, emergency) */
export async function persistSupplyRequestNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveSupplyRequestSnapshotToSupabase)
}

/** Full mirror — departments, settings, nursing, all collections */
export async function persistFullSnapshotNowAsync(): Promise<string> {
  return runFastSnapshotSave(saveFullMirrorSnapshotToSupabase)
}

/** Call after in-place entity edits (visit.status, lab.status, etc.) */
export function touchHmsStore(): void {
  hmsStoreRevision += 1
  onStoreChanged?.()
  schedulePersist()
}

function mergeIncomingWithLocal<T extends { id: string }>(incoming: T[], local: T[]): T[] {
  const merged = new Map<string, T>()
  for (const item of incoming) merged.set(item.id, { ...item })
  for (const item of local) merged.set(item.id, { ...item })
  return Array.from(merged.values())
}

/** Apply remote snapshot from Supabase — database wins (used on load / poll / refresh) */
export function applyRemoteHmsStoreSnapshot(snapshot: HmsStoreSnapshot): boolean {
  const { snapshot: safeSnapshot, repaired: staffRepaired } = ensureBootstrapStaffInSnapshot(snapshot)
  hydrateHmsStore(safeSnapshot)
  normalizeLegacyVisitStatuses()
  hmsStoreRevision += 1
  return staffRepaired
}

/** Apply a full snapshot from Supabase (or backup). Returns true if staff emails were corrected. */
export function applyHmsStoreSnapshot(snapshot: HmsStoreSnapshot): boolean {
  let staffEmailsFixed = false

  const mergedStaff = mergeIncomingWithLocal(snapshot.staffUsers ?? [], [...staffUsers]).map((staff) => {
    const copy = { ...staff }
    if (normalizeStaffUserEmail(copy)) staffEmailsFixed = true
    return copy
  })

  hydrateHmsStore({
    ...snapshot,
    staffUsers: mergedStaff,
    patients: mergeIncomingWithLocal(snapshot.patients ?? [], [...patients]),
    visits: mergeIncomingWithLocal(snapshot.visits ?? [], [...visits]),
    labRequests: mergeIncomingWithLocal(snapshot.labRequests ?? [], [...labRequests]),
    surgeryRequests: mergeIncomingWithLocal(snapshot.surgeryRequests ?? [], [...surgeryRequests]),
    admissions: mergeIncomingWithLocal(snapshot.admissions ?? [], [...admissions]),
    patientAccounts: mergeIncomingWithLocal(snapshot.patientAccounts ?? [], [...patientAccounts]),
    accountTransactions: mergeIncomingWithLocal(
      snapshot.accountTransactions ?? [],
      [...accountTransactions],
    ),
    patientDiscounts: mergeIncomingWithLocal(snapshot.patientDiscounts ?? [], [...patientDiscounts]),
    obstetricDeliveries: mergeIncomingWithLocal(
      snapshot.obstetricDeliveries ?? [],
      [...obstetricDeliveries],
    ),
    doctorCommissionPayouts: mergeIncomingWithLocal(
      snapshot.doctorCommissionPayouts ?? [],
      [...doctorCommissionPayouts],
    ),
    receptionReceipts: mergeIncomingWithLocal(
      snapshot.receptionReceipts ?? [],
      [...receptionReceipts],
    ),
    payments: mergeIncomingWithLocal(snapshot.payments ?? [], [...payments]),
    incomeRecords: mergeIncomingWithLocal(snapshot.incomeRecords ?? [], [...incomeRecords]),
  })
  normalizeLegacyVisitStatuses()
  hmsStoreRevision += 1
  return staffEmailsFixed
}

/** Export current in-memory state for Supabase sync */
export function exportHmsStoreSnapshot(): HmsStoreSnapshot {
  return getHmsStoreSnapshot()
}

/** Original seed data â€” used when Supabase has no row yet */
export function getHmsStoreSeedSnapshot(): HmsStoreSnapshot {
  return createEmptyHmsSnapshot()
}

export function registerSupabasePersistence(saveFn: () => Promise<void>): void {
  registerSupabasePersistHandler(saveFn)
}
