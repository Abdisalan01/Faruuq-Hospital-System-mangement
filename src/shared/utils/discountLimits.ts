import type { PatientDiscountFeeType } from '@/shared/types'

export const FEE_TYPE_LABELS: Record<PatientDiscountFeeType, string> = {
  registration: 'Registration',
  lab: 'Laboratory',
  surgery: 'Surgery',
  inpatient: 'In-Patient',
  pharmacy: 'Pharmacy',
}

export function discountAmountFromPercent(subtotal: number, percent: number): number {
  if (percent <= 0 || subtotal <= 0) return 0
  return Math.round(((subtotal * percent) / 100) * 100) / 100
}

export function parseDiscountPercent(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, n)
}

export function getFeeTypeForReceptionPage(page: 'lab' | 'surgery' | 'registration' | 'inpatient'): PatientDiscountFeeType {
  return page
}
