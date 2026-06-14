export * from './roles'

export type Gender = 'Male' | 'Female' | 'Other'

export type PaymentType = 'cash' | 'credit'

export type PatientStatus = 'Active' | 'In Active' | 'Inactive'

export type VisitStatus =
  | 'Waiting'
  | 'In Consultation'
  | 'Completed Consultation'
  | 'Lab Requested'
  | 'Admitted'
  | 'Completed'
  | 'Cancelled'

export type LabRequestStatus =
  | 'Awaiting Payment'
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'

export type PrescriptionStatus = 'Pending' | 'Approved' | 'Dispensed' | 'Printed'

export type EmergencySeverity = 'Critical' | 'Urgent' | 'Stable' | 'Minor'

export type EmergencyOutcome = 'Discharge' | 'Admit' | 'Transfer'

export type StockTransactionType = 'Purchase' | 'Adjustment' | 'Dispense' | 'Internal Usage'

export type InventoryCategory = 'Medicines' | 'Medical Supplies' | 'Consumables'

export type ChargeType =
  | 'Registration'
  | 'Consultation'
  | 'Laboratory'
  | 'Pharmacy'
  | 'Room'
  | 'Surgery'
  | 'Obstetrics'
  | 'Other'

export type ExpenseCategory =
  | 'Medicine Purchases'
  | 'Salaries'
  | 'Utilities'
  | 'Supplies'
  | 'Supply Expenses'

export type DiscountType = 'percentage' | 'fixed'

export type DoctorOrderType =
  | 'IV Fluid'
  | 'Injection'
  | 'Medication'
  | 'Monitoring'
  | 'Lab Order'
  | 'Surgery Order'

export type DoctorOrderStatus = 'Pending' | 'Pharmacy Approved' | 'Delivered' | 'Administered'

export interface StaffUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: import('./roles').UserRole
  departmentId?: string
  phone?: string
  /** Consultation fee for doctors; registration/service fee for reception */
  serviceFee?: number
  /** Demo/local login password set by admin */
  password?: string
  isActive: boolean
  createdAt: string
  lastModifiedAt?: string
}

/** Suggested defaults — any custom category name is allowed */
export const DEFAULT_LAB_TEST_CATEGORIES = ['Laboratory', 'Radiology', 'Imaging'] as const
export type LabTestCategory = string

export type LabSampleType = 'Blood' | 'Urine' | 'Stool' | 'Other' | 'N/A'

export interface LabTestCatalog {
  id: string
  /** Lab_ID */
  testId: string
  /** Test_Name */
  testName: string
  category: LabTestCategory
  price: number
  /** Unit_Reference */
  unitReference?: string
  isActive: boolean
  createdAt: string
  lastModifiedAt?: string
  /** @deprecated use unitReference */
  description?: string
  /** @deprecated use unitReference */
  normalRange?: string
  /** @deprecated use unitReference */
  unit?: string
  /** @deprecated */
  sampleType?: LabSampleType
  /** @deprecated */
  turnaroundTime?: string
}

export interface MedicineCatalogItem {
  id: string
  medicineId: string
  name: string
  unit: string
  strength?: string
  price: number
  purchasePrice?: number
  category: string
  isActive: boolean
  createdAt: string
  lastModifiedAt?: string
}

export type SurgeryCategory = 'General' | 'Orthopedic' | 'Cardiac'

export type AnesthesiaType = 'Local' | 'General'

export type SurgeryRiskLevel = 'Low' | 'Medium' | 'High'

export interface SurgeryCatalog {
  id: string
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
  createdAt: string
  lastModifiedAt?: string
}

export interface Discount {
  id: string
  name: string
  code: string
  type: DiscountType
  value: number
  isActive: boolean
  createdAt: string
}

export type PatientDiscountFeeType = 'registration' | 'lab' | 'surgery' | 'inpatient' | 'pharmacy'

export type PatientDiscountStatus = 'Active' | 'Inactive'

export interface PatientDiscount {
  id: string
  patientId: string
  doctorId: string
  feeType: PatientDiscountFeeType
  feeAmount: number
  discountPercent: number
  discountAmount: number
  netAmount: number
  status: PatientDiscountStatus
  sentToReception: boolean
  paymentCollected: boolean
  appliedBy: string
  notes?: string
  createdAt: string
  collectedAt?: string
  collectedBy?: string
}

export interface ReceptionDiscountLimits {
  registration: number
  lab: number
  surgery: number
  inpatient: number
}

export interface PharmacyDiscountLimits {
  dispensing: number
}

export interface DiscountLimitsSettings {
  reception: ReceptionDiscountLimits
  pharmacy: PharmacyDiscountLimits
}

export interface Department {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
}

export interface Patient {
  id: string
  fullName: string
  gender: Gender
  age: number
  phone: string
  address: string
  paymentType: PaymentType
  /** Active = waiting in queue; In Active = in doctor care; Inactive = released / no open visit */
  status: PatientStatus
  createdAt: string
  /** Set on every profile save — used to resolve meta vs table conflicts */
  lastModifiedAt?: string
}

export interface PatientAccount {
  id: string
  patientId: string
  outstandingBalance: number
  createdAt: string
}

export interface AccountTransaction {
  id: string
  accountId: string
  patientId: string
  visitId?: string
  admissionId?: string
  type: 'charge' | 'payment'
  chargeType?: ChargeType
  description: string
  amount: number
  /** Paid immediately (nightly cash) — not added to credit book */
  settledAtCharge?: boolean
  referenceId?: string
  referenceType?: 'bed' | 'lab' | 'surgery' | 'pharmacy'
  createdAt: string
  createdBy: string
}

export type InpatientChargeStatus = 'Pending' | 'On book' | 'Paid'

export interface InpatientChargeRow {
  id: string
  sourceType: 'bed' | 'lab' | 'surgery' | 'pharmacy'
  sourceId: string
  date: string
  description: string
  amount: number
  status: InpatientChargeStatus
  transactionId?: string
}

export interface Visit {
  id: string
  visitNumber: string
  patientId: string
  visitDate: string
  assignedDoctorId: string
  departmentId: string
  status: VisitStatus
  queueNumber: number
  /** Daily queue per doctor (1, 2, 3…); emergency uses separate daily sequence */
  patientNumber?: number
  isEmergency?: boolean
  discountId?: string
  discountAmount?: number
  subtotal?: number
  amountPaid?: number
  paymentConfirmed?: boolean
  receiptNumber?: string
  notes?: string
  createdAt: string
  /** Set on every status change — used for Supabase merge (prevents reopening Completed visits) */
  lastModifiedAt?: string
  /** Follow-up return within 30 days — same patient number, no new registration fee */
  isFollowUp?: boolean
}

export type ReceptionReceiptType =
  | 'registration'
  | 'lab'
  | 'checkout'
  | 'surgery'
  | 'pharmacy'
  | 'obstetric'

export type ObstetricChildGender = 'Male' | 'Female'

export type ObstetricDeliveryStatus = 'Pending' | 'Paid' | 'Cancelled'

export interface ObstetricDelivery {
  id: string
  registrationNumber: string
  motherFullName: string
  motherAge: number
  motherPhone: string
  childGender: ObstetricChildGender
  doctorId: string
  obstetricianFee: number
  amountPaid: number
  paymentConfirmed: boolean
  paymentConfirmedAt?: string
  paidByReceptionId?: string
  receiptNumber?: string
  receiptId?: string
  status: ObstetricDeliveryStatus
  createdAt: string
  createdBy: string
  lastModifiedAt?: string
}

export interface ReceptionReceiptLine {
  description: string
  amount: number
}

export interface ReceptionReceipt {
  id: string
  receiptNumber: string
  type: ReceptionReceiptType
  patientId: string
  visitId?: string
  doctorId: string
  doctorName: string
  patientNumber: number
  isEmergency: boolean
  lineItems: ReceptionReceiptLine[]
  subtotal: number
  discountPercent?: number
  discountAmount: number
  total: number
  paymentMethod?: string
  paymentConfirmed: boolean
  labRequestNumber?: string
  surgeryRequestNumber?: string
  obstetricRegistrationNumber?: string
  motherFullName?: string
  motherAge?: number
  motherPhone?: string
  childGender?: ObstetricChildGender
  createdAt: string
  createdBy: string
}

export interface ClinicalNote {
  id: string
  visitId: string
  patientId: string
  doctorId: string
  note: string
  createdAt: string
  lastModifiedAt?: string
}

export interface Diagnosis {
  id: string
  visitId: string
  patientId: string
  doctorId: string
  diagnosis: string
  createdAt: string
}

export interface PrescriptionItem {
  medicine: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

export interface Prescription {
  id: string
  visitId: string
  patientId: string
  doctorId: string
  items: PrescriptionItem[]
  status: PrescriptionStatus
  createdAt: string
  lastModifiedAt?: string
  /** Set when ordered for an admitted inpatient */
  admissionId?: string
  /** Nurse or doctor who submitted the order */
  orderedById?: string
  /** Estimated / confirmed medicine fee total */
  totalFee?: number
  amountPaid?: number
  paymentCollectedAt?: string
  collectedByReceptionId?: string
  paymentMethod?: string
  approvedAt?: string
  approvedByPharmacyId?: string
  dispensedAt?: string
  dispensedByPharmacyId?: string
  /** Pharmacy sent unpaid request to reception cashier */
  sentToReceptionAt?: string
  sentToReceptionByPharmacyId?: string
  /** Cash collected at pharmacy (not reception) */
  collectedByPharmacyId?: string
}

export type InpatientMedicinePaymentStatus =
  | 'awaiting_payment'
  | 'at_reception'
  | 'paid_cash'
  | 'credit_book'

export interface LabTestItem {
  testName: string
  result?: string
  referenceValue?: string
  remarks?: string
}

export interface LabRequest {
  id: string
  requestNumber: string
  visitId: string
  patientId: string
  doctorId: string
  tests: LabTestItem[]
  status: LabRequestStatus
  totalFee?: number
  discountId?: string
  discountPercent?: number
  discountAmount?: number
  amountPaid?: number
  paymentMethod?: string
  paymentConfirmedAt?: string
  paidByReceptionId?: string
  doctorViewedAt?: string
  createdAt: string
  completedAt?: string
  cancelledAt?: string
  /** Set on every lab save — resolves meta vs table conflicts */
  lastModifiedAt?: string
}

export type InpatientBillingMode = 'nightly_cash' | 'credit_book'

export interface AdmissionRequest {
  id: string
  visitId: string
  patientId: string
  doctorId: string
  wardId?: string
  roomId?: string
  bedId?: string
  reason: string
  status: 'Pending' | 'Assigned' | 'Rejected' | 'Cancelled'
  billingMode?: InpatientBillingMode
  createdAt: string
  /** Set on every admission save — resolves meta vs table conflicts */
  lastModifiedAt?: string
}

export interface Ward {
  id: string
  name: string
  description: string
  lastModifiedAt?: string
}

export interface Room {
  id: string
  wardId: string
  name: string
  bedCount: number
  lastModifiedAt?: string
}

export interface Bed {
  id: string
  roomId: string
  wardId: string
  bedNumber: string
  name: string
  dailyRate: number
  isOccupied: boolean
  patientId?: string
  admissionId?: string
  lastModifiedAt?: string
}

export interface Admission {
  id: string
  patientId: string
  visitId: string
  wardId: string
  roomId: string
  bedId: string
  admittedAt: string
  dischargedAt?: string
  status: 'Active' | 'Discharged'
  billingMode: InpatientBillingMode
  bookOpen: boolean
}

/** Reception alert when an inpatient was released/discharged with unpaid charges */
export type InpatientUnpaidAlert = {
  admissionId: string
  patientId: string
  patientName: string
  visitId: string
  doctorName: string
  outstandingAmount: number
  scenario: 'released_still_admitted' | 'discharged_unpaid'
  bedId?: string
  bedLabel?: string
  dischargedAt?: string
}

export interface MedicationAdministration {
  id: string
  patientId: string
  admissionId: string
  medicine: string
  quantity: number
  administeredAt: string
  administeredBy: string
  notes?: string
}

export interface NursingNote {
  id: string
  patientId: string
  admissionId: string
  nurseId: string
  note: string
  createdAt: string
}

export interface DoctorOrder {
  id: string
  patientId: string
  admissionId: string
  doctorId: string
  orderType: DoctorOrderType
  description: string
  medicine?: string
  quantity?: number
  status: DoctorOrderStatus
  createdAt: string
  lastModifiedAt?: string
}

export interface SurgeryRequest {
  id: string
  requestNumber: string
  visitId: string
  patientId: string
  doctorId: string
  surgeryCatalogId: string
  surgeryName: string
  notes?: string
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Cancelled'
  surgeryFee?: number
  discountPercent?: number
  discountAmount?: number
  amountPaid?: number
  paymentMethod?: string
  paymentConfirmedAt?: string
  paidByReceptionId?: string
  scheduledDate?: string
  scheduledNotes?: string
  completedAt?: string
  completedBy?: string
  createdAt: string
  /** Set on every surgery save — resolves meta vs table conflicts */
  lastModifiedAt?: string
}

export type SupplyRequestDepartment = 'Doctor' | 'Emergency' | 'Laboratory' | 'Nursing'

export interface DepartmentSupplyRequest {
  id: string
  department: SupplyRequestDepartment
  requesterId: string
  /** Free-text name of person requesting (ward, doctor, etc.) */
  requesterName?: string
  patientId?: string
  admissionId?: string
  items: { supplyName: string; quantity: number; unit: string }[]
  notes?: string
  status: 'Pending' | 'Approved' | 'Delivered'
  createdAt: string
}

/** @deprecated Use DepartmentSupplyRequest */
export interface PharmacySupplyRequest {
  id: string
  doctorId: string
  patientId?: string
  admissionId?: string
  items: { supplyName: string; quantity: number; unit: string }[]
  notes?: string
  status: 'Pending' | 'Approved' | 'Delivered'
  createdAt: string
}

/** @deprecated Use DepartmentSupplyRequest */
export interface LabSupplyRequest {
  id: string
  labStaffId: string
  items: { supplyName: string; quantity: number; unit: string }[]
  notes?: string
  status: 'Pending' | 'Approved' | 'Delivered'
  createdAt: string
}

export interface InventoryItem {
  id: string
  name: string
  medicineId?: string
  category: string
  unit: string
  quantity: number
  reorderLevel: number
  unitPrice: number
  purchasePrice?: number
  createdAt: string
  lastModifiedAt?: string
}

export interface StockTransaction {
  id: string
  itemId: string
  type: StockTransactionType
  quantity: number
  /** Selling price at time of transaction */
  unitPrice?: number
  /** Purchase/cost price at time of transaction — for profit calculation */
  unitCost?: number
  department?: string
  reference?: string
  notes?: string
  createdAt: string
  createdBy: string
}

export interface Payment {
  id: string
  patientId: string
  visitId?: string
  amount: number
  paymentMethod: string
  receiptNumber: string
  description: string
  receivedBy: string
  createdAt: string
}

export interface EmergencyCase {
  id: string
  emgNumber: string
  patientId: string
  arrivalTime: string
  severity: EmergencySeverity
  triageNotes?: string
  diagnosis?: string
  outcome?: EmergencyOutcome
  status: 'Active' | 'Completed'
  createdAt: string
}

export interface IncomeRecord {
  id: string
  category: ChargeType
  amount: number
  description: string
  departmentId?: string
  doctorId?: string
  receivedBy?: string
  reference?: string
  createdAt: string
}

export interface ExpenseRecord {
  id: string
  category: ExpenseCategory
  amount: number
  description: string
  createdAt: string
}

export interface SystemSettings {
  hospitalName: string
  address: string
  phone: string
  email: string
  consultationFee: number
  registrationFee: number
  /** Admin-set fee when reception assigns a doctor (patient number / registration) */
  doctorPatientNumberFee?: number
  /** Admin-set fee when reception assigns emergency */
  emergencyPatientNumberFee?: number
  /** Admin-set obstetrician / delivery registration fee */
  obstetricianFee?: number
  medicineCodePrefix: string
  medicineCodeStartNumber: number
  medicineCodeNextNumber: number
  medicineCodePadLength: number
  labTestCodePrefix: string
  labTestCodeStartNumber: number
  labTestCodeNextNumber: number
  labTestCodePadLength: number
  surgeryCodePrefix: string
  surgeryCodeStartNumber: number
  surgeryCodeNextNumber: number
  surgeryCodePadLength: number
  discountLimits: DiscountLimitsSettings
  lastModifiedAt?: string
  /** Set when patient data was wiped — blocks ghost data until a new patient is registered */
  patientDataClearedAt?: string
}

export type PatientHistoryPaymentStatus = 'Paid' | 'Unpaid' | 'On book'

export interface PatientHistoryEntry {
  id: string
  date: string
  category: string
  description: string
  reference?: string
  amount: number
  paymentStatus: PatientHistoryPaymentStatus
  paymentMethod?: string
  handledBy?: string
}

export interface PatientHistorySummary {
  patientId: string
  entries: PatientHistoryEntry[]
  totalCharged: number
  totalPaid: number
  outstandingBalance: number
  hasDebt: boolean
}

export type ReportDatePeriod = 'day' | 'week' | 'month' | 'year' | 'custom'

export type LabCategoryBreakdown = {
  category: string
  testCount: number
  patientCount: number
  subtotal: number
  discount: number
  collected: number
}

export type DoctorFinancialReport = {
  doctorId: string
  doctorName: string
  registrationCount: number
  registrationSubtotal: number
  registrationDiscount: number
  registrationCollected: number
  labPatientCount: number
  labTestCount: number
  labSubtotal: number
  labDiscount: number
  labCollected: number
  labByCategory: LabCategoryBreakdown[]
  surgeryCount: number
  surgerySubtotal: number
  surgeryDiscount: number
  surgeryCollected: number
  obstetricCount: number
  obstetricSubtotal: number
  obstetricDiscount: number
  obstetricCollected: number
  grossTotal: number
  commissionRate: number
  commissionAmount: number
}

export interface DoctorCommissionPayout extends DoctorFinancialReport {
  id: string
  periodMonth: string
  confirmedAt: string
  confirmedBy: string
  notes?: string
}

export type HospitalPharmacyBreakdown = {
  incomeRecords: number
  stockSales: number
  inpatientMedicineRequests: number
  supplyRequests: number
  total: number
}

export type HospitalRevenueReport = {
  registration: { count: number; subtotal: number; discount: number; collected: number }
  laboratory: { count: number; subtotal: number; discount: number; collected: number }
  inpatient: { count: number; subtotal: number; discount: number; collected: number }
  surgery: { count: number; subtotal: number; discount: number; collected: number }
  pharmacy: HospitalPharmacyBreakdown & { count: number; discount: number }
  obstetrics: { count: number; subtotal: number; discount: number; collected: number }
  grossTotal: number
}

export type FinancialFeeCategory =
  | 'Registration'
  | 'Laboratory'
  | 'Surgery'
  | 'Obstetrics'
  | 'In-patient'
  | 'Pharmacy'

export type FinancialTransactionLine = {
  id: string
  date: string
  category: FinancialFeeCategory
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  receiptNumber: string
  reference?: string
  subtotal: number
  discountPercent?: number
  discountAmount: number
  collected: number
  hasDiscount: boolean
}

export type PharmacyTransactionSource = 'Stock Sale' | 'Inpatient Medicine' | 'Supply Request'

export type PharmacyTransactionLine = {
  id: string
  date: string
  source: PharmacyTransactionSource
  itemName: string
  quantity: number
  unitCost: number
  unitPrice: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number
  reference?: string
  patientOrDept?: string
  notes?: string
}

export type PharmacyProfitSummary = {
  revenue: number
  cost: number
  profit: number
  marginPercent: number
  transactionCount: number
  stockSales: { count: number; revenue: number; profit: number }
  inpatientMedicine: { count: number; revenue: number; profit: number }
  supplyRequests: { count: number; revenue: number; profit: number }
}
