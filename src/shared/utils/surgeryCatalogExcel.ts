import * as XLSX from 'xlsx'

import {
  getSurgeryBySurgeryId,
  peekNextSurgeryCode,
  saveSurgeryCatalogEntry,
} from '@/shared/services/hmsStore'
import type { AnesthesiaType, SurgeryCategory, SurgeryRiskLevel } from '@/shared/types'

export const SURGERY_CATALOG_HEADERS = [
  'Surgery ID',
  'Surgery Name',
  'Category',
  'Price',
  'Status',
  'Duration',
  'Anesthesia Type',
  'Risk Level',
  'Description',
  'Required Equipment',
  'Pre-op Instructions',
  'Post-op Care',
] as const

const SAMPLE_ROW = [
  'SUR-001',
  'Appendectomy',
  'General',
  500,
  'Active',
  '2 hours',
  'General',
  'Medium',
  'Routine appendectomy',
  'Laparoscope',
  'NPO 8 hours',
  'Monitor vitals',
]

const CATEGORIES: SurgeryCategory[] = ['General', 'Orthopedic', 'Cardiac']
const ANESTHESIA_TYPES: AnesthesiaType[] = ['Local', 'General']
const RISK_LEVELS: SurgeryRiskLevel[] = ['Low', 'Medium', 'High']

type ParsedSurgeryRow = {
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
}

export type SurgeryCatalogImportResult = {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const HEADER_ALIASES: Record<string, keyof ParsedSurgeryRow> = {
  'surgery id': 'surgeryId',
  id: 'surgeryId',
  code: 'surgeryId',
  'surgery name': 'name',
  name: 'name',
  category: 'category',
  price: 'price',
  'price ($)': 'price',
  status: 'isActive',
  duration: 'duration',
  'anesthesia type': 'anesthesiaType',
  anesthesia: 'anesthesiaType',
  'risk level': 'riskLevel',
  risk: 'riskLevel',
  description: 'description',
  'required equipment': 'requiredEquipment',
  equipment: 'requiredEquipment',
  'pre-op instructions': 'preOpInstructions',
  'pre op instructions': 'preOpInstructions',
  'post-op care': 'postOpCare',
  'post op care': 'postOpCare',
}

const toNumber = (value: unknown, fallback = 0) => {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const parseStatus = (value: unknown): boolean => {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text || text === 'active' || text === 'yes' || text === '1' || text === 'true') return true
  if (text === 'inactive' || text === 'no' || text === '0' || text === 'false') return false
  return true
}

const parseCategory = (value: string): SurgeryCategory | null => {
  const match = CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

const parseAnesthesia = (value: string): AnesthesiaType | undefined => {
  const match = ANESTHESIA_TYPES.find((a) => a.toLowerCase() === value.trim().toLowerCase())
  return match
}

const parseRisk = (value: string): SurgeryRiskLevel | undefined => {
  const match = RISK_LEVELS.find((r) => r.toLowerCase() === value.trim().toLowerCase())
  return match
}

const parseRowObject = (row: Record<string, unknown>, rowNum: number): ParsedSurgeryRow | string => {
  const mapped: Partial<ParsedSurgeryRow> & { isActive?: boolean } = {}

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const field = HEADER_ALIASES[normalizeHeader(rawKey)]
    if (!field) continue

    if (field === 'price') {
      mapped.price = toNumber(rawValue, 0)
    } else if (field === 'isActive') {
      mapped.isActive = parseStatus(rawValue)
    } else {
      mapped[field] = String(rawValue ?? '').trim() as never
    }
  }

  if (!mapped.name?.trim()) return `Row ${rowNum}: Surgery Name is required`

  const category = parseCategory(mapped.category ?? '')
  if (!category) {
    return `Row ${rowNum}: Category must be General, Orthopedic, or Cardiac`
  }

  if (mapped.price == null || mapped.price < 0) {
    return `Row ${rowNum}: Price is required`
  }

  return {
    surgeryId: mapped.surgeryId?.trim() ?? '',
    name: mapped.name.trim(),
    category,
    price: mapped.price,
    isActive: mapped.isActive ?? true,
    duration: mapped.duration?.trim() || undefined,
    anesthesiaType: mapped.anesthesiaType ? parseAnesthesia(mapped.anesthesiaType) : undefined,
    riskLevel: mapped.riskLevel ? parseRisk(mapped.riskLevel) : undefined,
    description: mapped.description?.trim() || undefined,
    requiredEquipment: mapped.requiredEquipment?.trim() || undefined,
    preOpInstructions: mapped.preOpInstructions?.trim() || undefined,
    postOpCare: mapped.postOpCare?.trim() || undefined,
  }
}

const upsertSurgeryRow = (row: ParsedSurgeryRow): 'imported' | 'updated' => {
  const existing = row.surgeryId ? getSurgeryBySurgeryId(row.surgeryId) : undefined

  saveSurgeryCatalogEntry({
    id: existing?.id,
    surgeryId: row.surgeryId,
    name: row.name,
    category: row.category,
    price: row.price,
    isActive: row.isActive,
    duration: row.duration,
    anesthesiaType: row.anesthesiaType,
    riskLevel: row.riskLevel,
    description: row.description,
    requiredEquipment: row.requiredEquipment,
    preOpInstructions: row.preOpInstructions,
    postOpCare: row.postOpCare,
  })

  return existing ? 'updated' : 'imported'
}

export function downloadSurgeryCatalogTemplate(): void {
  const sampleCode = peekNextSurgeryCode()
  const ws = XLSX.utils.aoa_to_sheet([
    SURGERY_CATALOG_HEADERS as unknown as string[],
    [sampleCode, ...SAMPLE_ROW.slice(1)],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Surgery Catalog')
  XLSX.writeFile(wb, 'surgery-catalog-template.xlsx')
}

export async function importSurgeryCatalogFromExcel(file: File): Promise<SurgeryCatalogImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { imported: 0, updated: 0, skipped: 0, errors: ['The Excel file has no sheets.'] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })

  if (rows.length === 0) {
    return { imported: 0, updated: 0, skipped: 0, errors: ['No data rows found in the Excel file.'] }
  }

  const result: SurgeryCatalogImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  rows.forEach((row, index) => {
    const parsed = parseRowObject(row, index + 2)
    if (typeof parsed === 'string') {
      result.skipped += 1
      result.errors.push(parsed)
      return
    }

    try {
      const action = upsertSurgeryRow(parsed)
      if (action === 'imported') result.imported += 1
      else result.updated += 1
    } catch (err) {
      result.skipped += 1
      result.errors.push(
        `Row ${index + 2}: ${err instanceof Error ? err.message : 'Could not save surgery'}`,
      )
    }
  })

  return result
}
