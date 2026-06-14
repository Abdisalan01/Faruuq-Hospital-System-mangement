import * as XLSX from 'xlsx'

import {
  getMedicineCatalogByMedicineId,
  saveMedicineCatalogEntry,
  systemSettings,
} from '@/shared/services/hmsStore'

export const MEDICAL_CATALOG_HEADERS = [
  'Medicine Code',
  'Medicine Name',
  'Category',
  'Unit',
  'Strength',
  'Purchase Price',
  'Selling Price',
  'Quantity in Stock',
  'Reorder Level',
] as const

const SAMPLE_ROW = [
  'MED-001',
  'Amoxicillin',
  'Medicines',
  'Tablet',
  '500mg',
  0.3,
  0.5,
  100,
  20,
]

type ParsedMedicalRow = {
  medicineCode: string
  name: string
  category: string
  unit: string
  strength: string
  purchasePrice: number
  sellingPrice: number
  quantityInStock: number
  reorderLevel: number
}

export type MedicalCatalogImportResult = {
  imported: number
  updated: number
  restocked: number
  skipped: number
  errors: string[]
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const HEADER_ALIASES: Record<string, keyof ParsedMedicalRow | 'isActive'> = {
  'medicine code': 'medicineCode',
  code: 'medicineCode',
  'medicine name': 'name',
  name: 'name',
  category: 'category',
  unit: 'unit',
  strength: 'strength',
  'purchase price': 'purchasePrice',
  'selling price': 'sellingPrice',
  price: 'sellingPrice',
  'quantity in stock': 'quantityInStock',
  quantity: 'quantityInStock',
  stock: 'quantityInStock',
  'reorder level': 'reorderLevel',
  reorder: 'reorderLevel',
  status: 'isActive',
}

const toNumber = (value: unknown, fallback = 0) => {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const parseRowObject = (row: Record<string, unknown>, rowNum: number): ParsedMedicalRow | string => {
  const mapped: Partial<ParsedMedicalRow> = {}

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const field = HEADER_ALIASES[normalizeHeader(rawKey)]
    if (!field || field === 'isActive') continue

    if (field === 'purchasePrice' || field === 'sellingPrice' || field === 'quantityInStock' || field === 'reorderLevel') {
      mapped[field] = toNumber(rawValue, field === 'reorderLevel' ? 10 : 0)
    } else {
      mapped[field] = String(rawValue ?? '').trim() as never
    }
  }

  if (!mapped.name?.trim()) return `Row ${rowNum}: Medicine Name is required`
  if (!mapped.category?.trim()) return `Row ${rowNum}: Category is required`
  if (!mapped.unit?.trim()) return `Row ${rowNum}: Unit is required`

  return {
    medicineCode: mapped.medicineCode?.trim() ?? '',
    name: mapped.name.trim(),
    category: mapped.category.trim(),
    unit: mapped.unit.trim(),
    strength: mapped.strength?.trim() ?? '',
    purchasePrice: mapped.purchasePrice ?? 0,
    sellingPrice: mapped.sellingPrice ?? 0,
    quantityInStock: mapped.quantityInStock ?? 0,
    reorderLevel: mapped.reorderLevel ?? 10,
  }
}

const upsertMedicalRow = (row: ParsedMedicalRow) => {
  const existing = row.medicineCode
    ? getMedicineCatalogByMedicineId(row.medicineCode)
    : undefined
  const wasOutOfStock = existing ? !existing.isActive : false

  saveMedicineCatalogEntry({
    id: existing?.id,
    medicineId: row.medicineCode || undefined,
    name: row.name,
    unit: row.unit,
    category: row.category,
    strength: row.strength || undefined,
    purchasePrice: row.purchasePrice || undefined,
    sellingPrice: row.sellingPrice,
    quantityInStock: row.quantityInStock,
    reorderLevel: row.reorderLevel,
  }, { skipSchedulePersist: true })

  if (existing) {
    return wasOutOfStock && row.quantityInStock > 0 ? 'restocked' : 'updated'
  }
  return 'imported'
}

export function downloadMedicalCatalogTemplate(): void {
  const prefix = systemSettings.medicineCodePrefix || 'MED'
  const sampleCode = `${prefix}-${String(systemSettings.medicineCodeStartNumber).padStart(3, '0')}`
  const ws = XLSX.utils.aoa_to_sheet([
    MEDICAL_CATALOG_HEADERS as unknown as string[],
    [sampleCode, ...SAMPLE_ROW.slice(1)],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Medical Catalog')
  XLSX.writeFile(wb, 'medical-catalog-template.xlsx')
}

export async function importMedicalCatalogFromExcel(file: File): Promise<MedicalCatalogImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { imported: 0, updated: 0, restocked: 0, skipped: 0, errors: ['The Excel file has no sheets.'] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })

  if (rows.length === 0) {
    return { imported: 0, updated: 0, restocked: 0, skipped: 0, errors: ['No data rows found in the Excel file.'] }
  }

  const result: MedicalCatalogImportResult = { imported: 0, updated: 0, restocked: 0, skipped: 0, errors: [] }

  rows.forEach((row, index) => {
    const parsed = parseRowObject(row, index + 2)
    if (typeof parsed === 'string') {
      result.skipped += 1
      result.errors.push(parsed)
      return
    }

    try {
      const action = upsertMedicalRow(parsed)
      if (action === 'imported') result.imported += 1
      else if (action === 'restocked') result.restocked += 1
      else result.updated += 1
    } catch (err) {
      result.skipped += 1
      result.errors.push(
        `Row ${index + 2}: ${err instanceof Error ? err.message : 'Could not save medicine'}`,
      )
    }
  })

  return result
}
