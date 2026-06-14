import {
  departmentSupplyRequests,
  getPatientById,
  getStaffById,
  incomeRecords,
  inventoryItems,
  labRequests,
  labTestCatalog,
  prescriptions,
  receptionReceipts,
  staffUsers,
  stockTransactions,
} from '@/shared/services/hmsStore'
import type {
  DoctorFinancialReport,
  FinancialFeeCategory,
  FinancialTransactionLine,
  HospitalRevenueReport,
  LabCategoryBreakdown,
  ReceptionReceipt,
  ReceptionReceiptType,
  ReportDatePeriod,
} from '@/shared/types'

export const DOCTOR_COMMISSION_RATE = 0.5

const recordDate = (iso: string) => iso.split('T')[0]

export function inReportDateRange(iso: string, start: string, end: string): boolean {
  const d = recordDate(iso)
  return d >= start && d <= end
}

export function getReportDateRange(
  period: ReportDatePeriod,
  anchorDate?: string,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string; label: string } {
  const anchor = anchorDate ? new Date(`${anchorDate}T12:00:00`) : new Date()
  const end = customEnd ?? recordDate(anchor.toISOString())

  if (period === 'custom' && customStart) {
    return { start: customStart, end, label: `${customStart} → ${end}` }
  }
  if (period === 'day') {
    const day = recordDate(anchor.toISOString())
    return { start: day, end: day, label: day }
  }
  if (period === 'week') {
    const startDate = new Date(anchor)
    startDate.setDate(anchor.getDate() - 6)
    const start = recordDate(startDate.toISOString())
    return { start, end, label: `${start} → ${end}` }
  }
  if (period === 'month') {
    const start = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-01`
    return { start, end, label: start.slice(0, 7) }
  }
  if (period === 'year') {
    const start = `${anchor.getFullYear()}-01-01`
    const yearEnd = `${anchor.getFullYear()}-12-31`
    return { start, end: yearEnd, label: String(anchor.getFullYear()) }
  }
  const day = recordDate(anchor.toISOString())
  return { start: day, end: day, label: day }
}

export function getMonthDateRange(periodMonth: string): { start: string; end: string } {
  const [year, month] = periodMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${periodMonth}-01`,
    end: `${periodMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}

function filterReceipts(start: string, end: string, doctorId?: string): ReceptionReceipt[] {
  return receptionReceipts.filter(
    (r) =>
      r.paymentConfirmed &&
      inReportDateRange(r.createdAt, start, end) &&
      (!doctorId || r.doctorId === doctorId),
  )
}

function getLabTestCategory(testName: string): string {
  const match = labTestCatalog.find((t) => t.testName === testName)
  return match?.category ?? 'Uncategorized'
}

function staffDisplayName(staffId: string): string {
  const staff = getStaffById(staffId)
  if (!staff) return '—'
  if (staff.role === 'emergency') return 'Emergency'
  return `Dr. ${staff.firstName} ${staff.lastName}`
}

function receiptCategory(type: ReceptionReceiptType): FinancialFeeCategory | null {
  switch (type) {
    case 'registration':
      return 'Registration'
    case 'lab':
      return 'Laboratory'
    case 'surgery':
      return 'Surgery'
    case 'obstetric':
      return 'Obstetrics'
    case 'checkout':
      return 'In-patient'
    case 'pharmacy':
      return 'Pharmacy'
    default:
      return null
  }
}

function resolvePatientName(receipt: ReceptionReceipt): string {
  if (receipt.motherFullName?.trim()) return receipt.motherFullName.trim()
  const patient = getPatientById(receipt.patientId)
  if (patient?.fullName) return patient.fullName
  if (receipt.patientId.startsWith('obst-')) return 'Obstetric patient'
  return receipt.patientId
}

function receiptReference(receipt: ReceptionReceipt): string | undefined {
  return (
    receipt.labRequestNumber ??
    receipt.surgeryRequestNumber ??
    receipt.obstetricRegistrationNumber ??
    receipt.visitId
  )
}

export function getFinancialTransactionLines(
  start: string,
  end: string,
  doctorId?: string,
): FinancialTransactionLine[] {
  const lines: FinancialTransactionLine[] = []

  for (const receipt of filterReceipts(start, end, doctorId)) {
    const category = receiptCategory(receipt.type)
    if (!category) continue
    const discountAmount = receipt.discountAmount ?? 0
    lines.push({
      id: receipt.id,
      date: receipt.createdAt.split('T')[0],
      category,
      patientId: receipt.patientId,
      patientName: resolvePatientName(receipt),
      doctorId: receipt.doctorId,
      doctorName: receipt.doctorName || staffDisplayName(receipt.doctorId),
      receiptNumber: receipt.receiptNumber,
      reference: receiptReference(receipt),
      subtotal: receipt.subtotal ?? receipt.total,
      discountPercent: receipt.discountPercent,
      discountAmount,
      collected: receipt.total,
      hasDiscount: discountAmount > 0,
    })
  }

  return lines.sort((a, b) => b.date.localeCompare(a.date) || b.collected - a.collected)
}

export function getFinancialDiscountLines(
  start: string,
  end: string,
  doctorId?: string,
): FinancialTransactionLine[] {
  return getFinancialTransactionLines(start, end, doctorId).filter((line) => line.hasDiscount)
}

function sumReceipts(receipts: ReceptionReceipt[]) {
  return receipts.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      subtotal: acc.subtotal + (r.subtotal ?? r.total),
      discount: acc.discount + (r.discountAmount ?? 0),
      collected: acc.collected + r.total,
    }),
    { count: 0, subtotal: 0, discount: 0, collected: 0 },
  )
}

function buildLabCategoryBreakdown(
  labReceipts: ReceptionReceipt[],
): { testCount: number; patientCount: number; byCategory: LabCategoryBreakdown[] } {
  const categoryMap = new Map<
    string,
    { testCount: number; patients: Set<string>; subtotal: number; discount: number; collected: number }
  >()
  const allPatients = new Set<string>()
  let testCount = 0

  for (const receipt of labReceipts) {
    allPatients.add(receipt.patientId)
    const lab = labRequests.find((l) => l.requestNumber === receipt.labRequestNumber)
    const receiptDiscount = receipt.discountAmount ?? 0
    const lineSubtotal = receipt.lineItems.reduce((s, l) => s + l.amount, 0) || receipt.subtotal

    for (const line of receipt.lineItems) {
      testCount += 1
      const category = getLabTestCategory(line.description)
      const share = lineSubtotal > 0 ? line.amount / lineSubtotal : 1 / receipt.lineItems.length
      const lineDiscount = receiptDiscount * share
      const lineCollected = line.amount - lineDiscount

      const bucket = categoryMap.get(category) ?? {
        testCount: 0,
        patients: new Set<string>(),
        subtotal: 0,
        discount: 0,
        collected: 0,
      }
      bucket.testCount += 1
      bucket.patients.add(receipt.patientId)
      bucket.subtotal += line.amount
      bucket.discount += lineDiscount
      bucket.collected += lineCollected
      categoryMap.set(category, bucket)
    }

    if (!lab && receipt.lineItems.length === 0) {
      const category = 'Uncategorized'
      const bucket = categoryMap.get(category) ?? {
        testCount: 0,
        patients: new Set<string>(),
        subtotal: 0,
        discount: 0,
        collected: 0,
      }
      bucket.testCount += 1
      bucket.patients.add(receipt.patientId)
      bucket.subtotal += receipt.subtotal
      bucket.discount += receiptDiscount
      bucket.collected += receipt.total
      categoryMap.set(category, bucket)
    }
  }

  const byCategory = [...categoryMap.entries()]
    .map(([category, data]) => ({
      category,
      testCount: data.testCount,
      patientCount: data.patients.size,
      subtotal: data.subtotal,
      discount: data.discount,
      collected: data.collected,
    }))
    .sort((a, b) => b.collected - a.collected)

  return { testCount, patientCount: allPatients.size, byCategory }
}

export function getDoctorFinancialReport(doctorId: string, start: string, end: string): DoctorFinancialReport {
  const receipts = filterReceipts(start, end, doctorId)

  const registrationReceipts = receipts.filter((r) => r.type === 'registration')
  const labReceipts = receipts.filter((r) => r.type === 'lab')
  const surgeryReceipts = receipts.filter((r) => r.type === 'surgery')
  const obstetricReceipts = receipts.filter((r) => r.type === 'obstetric')

  const registration = sumReceipts(registrationReceipts)
  const surgery = sumReceipts(surgeryReceipts)
  const obstetric = sumReceipts(obstetricReceipts)
  const labTotals = sumReceipts(labReceipts)
  const labBreakdown = buildLabCategoryBreakdown(labReceipts)

  const grossTotal =
    registration.collected + labTotals.collected + surgery.collected + obstetric.collected

  return {
    doctorId,
    doctorName: staffDisplayName(doctorId),
    registrationCount: registration.count,
    registrationSubtotal: registration.subtotal,
    registrationDiscount: registration.discount,
    registrationCollected: registration.collected,
    labPatientCount: labBreakdown.patientCount,
    labTestCount: labBreakdown.testCount,
    labSubtotal: labTotals.subtotal,
    labDiscount: labTotals.discount,
    labCollected: labTotals.collected,
    labByCategory: labBreakdown.byCategory,
    surgeryCount: surgery.count,
    surgerySubtotal: surgery.subtotal,
    surgeryDiscount: surgery.discount,
    surgeryCollected: surgery.collected,
    obstetricCount: obstetric.count,
    obstetricSubtotal: obstetric.subtotal,
    obstetricDiscount: obstetric.discount,
    obstetricCollected: obstetric.collected,
    grossTotal,
    commissionRate: DOCTOR_COMMISSION_RATE,
    commissionAmount: grossTotal * DOCTOR_COMMISSION_RATE,
  }
}

export function getAllDoctorsFinancialReports(start: string, end: string): DoctorFinancialReport[] {
  const doctors = staffUsers.filter((u) => u.role === 'doctor' && u.isActive)
  return doctors
    .map((doc) => getDoctorFinancialReport(doc.id, start, end))
    .sort((a, b) => b.grossTotal - a.grossTotal)
}

function isBedLine(description: string): boolean {
  const lower = description.toLowerCase()
  return lower.includes('room') || lower.includes('bed') || lower.includes('night')
}

function estimateSupplyRequestValue(items: { supplyName: string; quantity: number }[]): number {
  return items.reduce((sum, item) => {
    const inv = inventoryItems.find(
      (i) => i.name.toLowerCase() === item.supplyName.toLowerCase(),
    )
    return sum + item.quantity * (inv?.unitPrice ?? 0)
  }, 0)
}

export function getHospitalRevenueReport(start: string, end: string): HospitalRevenueReport {
  const receipts = filterReceipts(start, end)
  const periodIncome = incomeRecords.filter((r) => inReportDateRange(r.createdAt, start, end))

  const registrationReceipts = receipts.filter((r) => r.type === 'registration')
  const labReceipts = receipts.filter((r) => r.type === 'lab')
  const surgeryReceipts = receipts.filter((r) => r.type === 'surgery')
  const obstetricReceipts = receipts.filter((r) => r.type === 'obstetric')
  const checkoutReceipts = receipts.filter((r) => r.type === 'checkout')

  const registration = sumReceipts(registrationReceipts)
  const laboratory = sumReceipts(labReceipts)
  const surgery = sumReceipts(surgeryReceipts)
  const obstetrics = sumReceipts(obstetricReceipts)

  let inpatientSubtotal = 0
  let inpatientDiscount = 0
  let inpatientCollected = 0
  let inpatientCount = 0

  for (const receipt of checkoutReceipts) {
    inpatientCount += 1
    inpatientSubtotal += receipt.subtotal
    inpatientDiscount += receipt.discountAmount ?? 0
    inpatientCollected += receipt.total
  }

  const nightlyBedIncome = periodIncome.filter(
    (r) =>
      r.category === 'Other' &&
      isBedLine(r.description) &&
      !r.description.toLowerCase().includes('checkout'),
  )
  for (const row of nightlyBedIncome) {
    inpatientCount += 1
    inpatientSubtotal += row.amount
    inpatientCollected += row.amount
  }

  const pharmacyIncomeTotal = periodIncome
    .filter((r) => r.category === 'Pharmacy')
    .reduce((s, r) => s + r.amount, 0)

  const pharmacyIncomeIds = new Set(
    periodIncome.filter((r) => r.category === 'Pharmacy').map((r) => r.reference).filter(Boolean),
  )

  const stockSales = stockTransactions
    .filter((t) => t.type === 'Dispense' && inReportDateRange(t.createdAt, start, end))
    .reduce((s, t) => s + t.quantity * (t.unitPrice ?? 0), 0)

  const inpatientMedicineRequests = prescriptions
    .filter(
      (rx) =>
        rx.paymentCollectedAt &&
        inReportDateRange(rx.paymentCollectedAt, start, end) &&
        !pharmacyIncomeIds.has(rx.id),
    )
    .reduce((s, rx) => s + (rx.amountPaid ?? rx.totalFee ?? 0), 0)

  const deliveredSupplies = departmentSupplyRequests.filter(
    (req) => req.status === 'Delivered' && inReportDateRange(req.createdAt, start, end),
  )
  const supplyRequests = deliveredSupplies.reduce(
    (s, req) => s + estimateSupplyRequestValue(req.items),
    0,
  )

  const pharmacyTotal =
    pharmacyIncomeTotal + stockSales + inpatientMedicineRequests + supplyRequests

  const pharmacyDiscount = receipts
    .filter((r) => r.type === 'pharmacy')
    .reduce((s, r) => s + (r.discountAmount ?? 0), 0)

  const grossTotal =
    registration.collected +
    laboratory.collected +
    inpatientCollected +
    surgery.collected +
    pharmacyTotal +
    obstetrics.collected

  return {
    registration,
    laboratory: { ...laboratory, count: labReceipts.length },
    inpatient: {
      count: inpatientCount,
      subtotal: inpatientSubtotal,
      discount: inpatientDiscount,
      collected: inpatientCollected,
    },
    surgery,
    pharmacy: {
      count:
        periodIncome.filter((r) => r.category === 'Pharmacy').length +
        stockTransactions.filter((t) => t.type === 'Dispense' && inReportDateRange(t.createdAt, start, end))
          .length +
        deliveredSupplies.length,
      discount: pharmacyDiscount,
      incomeRecords: pharmacyIncomeTotal,
      stockSales,
      inpatientMedicineRequests,
      supplyRequests,
      total: pharmacyTotal,
    },
    obstetrics,
    grossTotal,
  }
}
