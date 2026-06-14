import {
  departmentSupplyRequests,
  getPatientById,
  inventoryItems,
  prescriptions,
  stockTransactions,
} from '@/shared/services/hmsStore'
import type {
  PharmacyProfitSummary,
  PharmacyTransactionLine,
  PharmacyTransactionSource,
  ReportDatePeriod,
  StockTransaction,
} from '@/shared/types'
import { getReportDateRange, inReportDateRange } from '@/shared/utils/financialReports'

function resolveUnitCost(txn: StockTransaction): number {
  if (txn.unitCost != null && txn.unitCost >= 0) return txn.unitCost
  const inv = inventoryItems.find((i) => i.id === txn.itemId)
  return inv?.purchasePrice ?? 0
}

function getItemName(itemId: string): string {
  return inventoryItems.find((i) => i.id === itemId)?.name ?? itemId
}

function classifySource(txn: StockTransaction): PharmacyTransactionSource | null {
  if (txn.type === 'Internal Usage') return 'Supply Request'
  if (txn.type !== 'Dispense') return null
  if (txn.reference && prescriptions.some((rx) => rx.id === txn.reference)) {
    return 'Inpatient Medicine'
  }
  return 'Stock Sale'
}

function buildLine(txn: StockTransaction): PharmacyTransactionLine | null {
  const source = classifySource(txn)
  if (!source) return null

  const qty = txn.quantity
  const unitPrice = txn.unitPrice ?? 0
  const unitCost = resolveUnitCost(txn)
  const revenue = unitPrice * qty
  const cost = unitCost * qty
  const profit = revenue - cost
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0

  let patientOrDept = txn.department
  if (source === 'Inpatient Medicine' && txn.reference) {
    const rx = prescriptions.find((p) => p.id === txn.reference)
    if (rx) {
      patientOrDept = getPatientById(rx.patientId)?.fullName ?? rx.patientId
    }
  }
  if (source === 'Supply Request' && txn.reference) {
    const req = departmentSupplyRequests.find((r) => r.id === txn.reference)
    if (req) patientOrDept = req.department
  }

  return {
    id: txn.id,
    date: txn.createdAt.split('T')[0],
    source,
    itemName: getItemName(txn.itemId),
    quantity: qty,
    unitCost,
    unitPrice,
    revenue,
    cost,
    profit,
    marginPercent,
    reference: txn.reference,
    patientOrDept,
    notes: txn.notes,
  }
}

export function getPharmacyTransactionLines(
  start: string,
  end: string,
): PharmacyTransactionLine[] {
  return stockTransactions
    .filter((txn) => inReportDateRange(txn.createdAt, start, end))
    .map(buildLine)
    .filter((line): line is PharmacyTransactionLine => line != null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.revenue - a.revenue)
}

export function getPharmacyProfitSummary(start: string, end: string): PharmacyProfitSummary {
  const lines = getPharmacyTransactionLines(start, end)

  const sumGroup = (source: PharmacyTransactionSource) => {
    const group = lines.filter((l) => l.source === source)
    return {
      count: group.length,
      revenue: group.reduce((s, l) => s + l.revenue, 0),
      profit: group.reduce((s, l) => s + l.profit, 0),
    }
  }

  const stockSales = sumGroup('Stock Sale')
  const inpatientMedicine = sumGroup('Inpatient Medicine')
  const supplyRequests = sumGroup('Supply Request')

  const revenue = lines.reduce((s, l) => s + l.revenue, 0)
  const cost = lines.reduce((s, l) => s + l.cost, 0)
  const profit = revenue - cost

  return {
    revenue,
    cost,
    profit,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
    transactionCount: lines.length,
    stockSales,
    inpatientMedicine,
    supplyRequests,
  }
}

export function getPharmacyPeriodRange(
  period: ReportDatePeriod,
  anchorDate?: string,
): { start: string; end: string; label: string } {
  return getReportDateRange(period, anchorDate)
}
