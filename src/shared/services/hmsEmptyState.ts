import type {
  AccountTransaction,
  Admission,
  AdmissionRequest,
  Bed,
  ClinicalNote,
  Department,
  Diagnosis,
  Discount,
  DoctorOrder,
  EmergencyCase,
  ExpenseRecord,
  IncomeRecord,
  InventoryItem,
  LabRequest,
  LabSupplyRequest,
  LabTestCatalog,
  MedicineCatalogItem,
  MedicationAdministration,
  NursingNote,
  Patient,
  PatientAccount,
  PatientDiscount,
  Payment,
  PharmacySupplyRequest,
  Prescription,
  ReceptionReceipt,
  Room,
  StaffUser,
  StockTransaction,
  SurgeryCatalog,
  SurgeryRequest,
  DepartmentSupplyRequest,
  SystemSettings,
  Visit,
  Ward,
} from '@/shared/types'
import { HMS_STORE_VERSION } from './hmsStorePersistence'

/** Default hospital configuration — not transactional mock data */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  hospitalName: 'FSH Hospital',
  address: 'Mogadishu, Somalia',
  phone: '+252-1-234567',
  email: 'info@fshospital.com',
  consultationFee: 50,
  registrationFee: 10,
  doctorPatientNumberFee: 50,
  emergencyPatientNumberFee: 30,
  medicineCodePrefix: 'MED',
  medicineCodeStartNumber: 1,
  medicineCodeNextNumber: 1,
  medicineCodePadLength: 3,
  labTestCodePrefix: 'LAB',
  labTestCodeStartNumber: 1,
  labTestCodeNextNumber: 1,
  labTestCodePadLength: 3,
  surgeryCodePrefix: 'SUR',
  surgeryCodeStartNumber: 1,
  surgeryCodeNextNumber: 1,
  surgeryCodePadLength: 3,
  discountLimits: {
    reception: { registration: 10, lab: 15, surgery: 20, inpatient: 25 },
    pharmacy: { dispensing: 10 },
  },
}

/** Single bootstrap admin — create other staff via Admin → Users */
const BOOTSTRAP_ADMIN: StaffUser = {
  id: 'staff-001',
  username: 'admin',
  email: 'admin@hms.com',
  firstName: 'System',
  lastName: 'Admin',
  role: 'admin',
  password: 'password',
  isActive: true,
  createdAt: new Date().toISOString().split('T')[0],
}

export const EMPTY_DEPARTMENTS: Department[] = []
export const EMPTY_STAFF_USERS: StaffUser[] = [BOOTSTRAP_ADMIN]
export const EMPTY_PATIENTS: Patient[] = []
export const EMPTY_PATIENT_ACCOUNTS: PatientAccount[] = []
export const EMPTY_ACCOUNT_TRANSACTIONS: AccountTransaction[] = []
export const EMPTY_RECEPTION_RECEIPTS: ReceptionReceipt[] = []
export const EMPTY_VISITS: Visit[] = []
export const EMPTY_CLINICAL_NOTES: ClinicalNote[] = []
export const EMPTY_DIAGNOSES: Diagnosis[] = []
export const EMPTY_PRESCRIPTIONS: Prescription[] = []
export const EMPTY_LAB_REQUESTS: LabRequest[] = []
export const EMPTY_SURGERY_REQUESTS: SurgeryRequest[] = []
export const EMPTY_DEPARTMENT_SUPPLY_REQUESTS: DepartmentSupplyRequest[] = []
export const EMPTY_PHARMACY_SUPPLY_REQUESTS: PharmacySupplyRequest[] = []
export const EMPTY_LAB_SUPPLY_REQUESTS: LabSupplyRequest[] = []
export const EMPTY_ADMISSION_REQUESTS: AdmissionRequest[] = []
export const EMPTY_WARDS: Ward[] = []
export const EMPTY_ROOMS: Room[] = []
export const EMPTY_BEDS: Bed[] = []
export const EMPTY_LAB_TEST_CATALOG: LabTestCatalog[] = []
export const EMPTY_MEDICINE_CATALOG: MedicineCatalogItem[] = []
export const EMPTY_SURGERY_CATALOG: SurgeryCatalog[] = []
export const EMPTY_DISCOUNTS: Discount[] = []
export const EMPTY_PATIENT_DISCOUNTS: PatientDiscount[] = []
export const EMPTY_ADMISSIONS: Admission[] = []
export const EMPTY_MEDICATION_ADMINISTRATIONS: MedicationAdministration[] = []
export const EMPTY_NURSING_NOTES: NursingNote[] = []
export const EMPTY_DOCTOR_ORDERS: DoctorOrder[] = []
export const EMPTY_INVENTORY_ITEMS: InventoryItem[] = []
export const EMPTY_STOCK_TRANSACTIONS: StockTransaction[] = []
export const EMPTY_PAYMENTS: Payment[] = []
export const EMPTY_EMERGENCY_CASES: EmergencyCase[] = []
export const EMPTY_INCOME_RECORDS: IncomeRecord[] = []
export const EMPTY_EXPENSE_RECORDS: ExpenseRecord[] = []

export type HmsEmptySnapshot = {
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

/** Guarantee at least one admin exists — prevents empty DB from breaking login */
export function ensureBootstrapStaffInSnapshot<T extends { staffUsers: StaffUser[] }>(
  snapshot: T,
): { snapshot: T; repaired: boolean } {
  const bootstrapAdmin = EMPTY_STAFF_USERS[0]
  if (!bootstrapAdmin) return { snapshot, repaired: false }

  const staff = snapshot.staffUsers ?? []
  const hasActiveAdmin = staff.some((user) => user.role === 'admin' && user.isActive)
  if (hasActiveAdmin) return { snapshot, repaired: false }

  if (staff.length === 0) {
    return { snapshot: { ...snapshot, staffUsers: [{ ...bootstrapAdmin }] }, repaired: true }
  }

  const hasBootstrapId = staff.some((user) => user.id === bootstrapAdmin.id)
  return {
    snapshot: {
      ...snapshot,
      staffUsers: hasBootstrapId ? staff : [{ ...bootstrapAdmin }, ...staff],
    },
    repaired: true,
  }
}

export function createEmptyHmsSnapshot(): HmsEmptySnapshot {
  return {
    version: HMS_STORE_VERSION,
    idCounter: 100,
    departments: [...EMPTY_DEPARTMENTS],
    staffUsers: [...EMPTY_STAFF_USERS],
    patients: [...EMPTY_PATIENTS],
    patientAccounts: [...EMPTY_PATIENT_ACCOUNTS],
    accountTransactions: [...EMPTY_ACCOUNT_TRANSACTIONS],
    receptionReceipts: [...EMPTY_RECEPTION_RECEIPTS],
    visits: [...EMPTY_VISITS],
    clinicalNotes: [...EMPTY_CLINICAL_NOTES],
    diagnoses: [...EMPTY_DIAGNOSES],
    prescriptions: [...EMPTY_PRESCRIPTIONS],
    labRequests: [...EMPTY_LAB_REQUESTS],
    surgeryRequests: [...EMPTY_SURGERY_REQUESTS],
    departmentSupplyRequests: [...EMPTY_DEPARTMENT_SUPPLY_REQUESTS],
    pharmacySupplyRequests: [...EMPTY_PHARMACY_SUPPLY_REQUESTS],
    labSupplyRequests: [...EMPTY_LAB_SUPPLY_REQUESTS],
    admissionRequests: [...EMPTY_ADMISSION_REQUESTS],
    wards: [...EMPTY_WARDS],
    rooms: [...EMPTY_ROOMS],
    beds: [...EMPTY_BEDS],
    labTestCatalog: [...EMPTY_LAB_TEST_CATALOG],
    medicineCatalog: [...EMPTY_MEDICINE_CATALOG],
    surgeryCatalog: [...EMPTY_SURGERY_CATALOG],
    discounts: [...EMPTY_DISCOUNTS],
    patientDiscounts: [...EMPTY_PATIENT_DISCOUNTS],
    admissions: [...EMPTY_ADMISSIONS],
    medicationAdministrations: [...EMPTY_MEDICATION_ADMINISTRATIONS],
    nursingNotes: [...EMPTY_NURSING_NOTES],
    doctorOrders: [...EMPTY_DOCTOR_ORDERS],
    inventoryItems: [...EMPTY_INVENTORY_ITEMS],
    stockTransactions: [...EMPTY_STOCK_TRANSACTIONS],
    payments: [...EMPTY_PAYMENTS],
    emergencyCases: [...EMPTY_EMERGENCY_CASES],
    incomeRecords: [...EMPTY_INCOME_RECORDS],
    expenseRecords: [...EMPTY_EXPENSE_RECORDS],
    systemSettings: JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS)) as SystemSettings,
  }
}
