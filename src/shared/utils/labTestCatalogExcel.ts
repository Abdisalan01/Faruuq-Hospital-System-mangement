import * as XLSX from 'xlsx'

import {
  getLabTestByTestId,
  peekNextLabTestCode,
  saveLabTestCatalogEntry,
} from '@/shared/services/hmsStore'
import { DEFAULT_LAB_TEST_CATEGORIES } from '@/shared/types'

export const LAB_TEST_CATALOG_HEADERS = [
  'Lab ID',
  'Test Name',
  'Category',
  'Price',
  'Unit Reference',
  'Status',
] as const

const SAMPLE_ROW = [
  'LAB-001',
  'Complete Blood Count',
  'Laboratory',
  15,
  '4.5-11.0 x10^9/L',
  'Active',
]

type ParsedLabTestRow = {
  testId: string
  testName: string
  category: string
  price: number
  unitReference?: string
  isActive: boolean
}

export type LabTestCatalogImportResult = {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const HEADER_ALIASES: Record<string, keyof ParsedLabTestRow | 'isActive'> = {
  'lab id': 'testId',
  'test id': 'testId',
  id: 'testId',
  code: 'testId',
  'test name': 'testName',
  name: 'testName',
  category: 'category',
  type: 'category',
  price: 'price',
  'price ($)': 'price',
  'unit reference': 'unitReference',
  reference: 'unitReference',
  'normal range': 'unitReference',
  range: 'unitReference',
  unit: 'unitReference',
  status: 'isActive',
}

const toNumber = (value: unknown, fallback = 0) => {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const parseCategory = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parseStatus = (value: unknown): boolean => {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text || text === 'active' || text === 'yes' || text === '1' || text === 'true') return true
  if (text === 'inactive' || text === 'no' || text === '0' || text === 'false') return false
  return true
}

const parseRowObject = (row: Record<string, unknown>, rowNum: number): ParsedLabTestRow | string => {
  const mapped: Partial<ParsedLabTestRow> & { isActive?: boolean } = {}

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

  if (!mapped.testName?.trim()) return `Row ${rowNum}: Test Name is required`

  const category = parseCategory(mapped.category ?? '')
  if (!category) {
    return `Row ${rowNum}: Category is required (e.g. ${DEFAULT_LAB_TEST_CATEGORIES.join(', ')})`
  }

  if (mapped.price == null || mapped.price < 0 || Number.isNaN(mapped.price)) {
    return `Row ${rowNum}: Price must be a valid non-negative number`
  }

  return {
    testId: mapped.testId?.trim() ?? '',
    testName: mapped.testName.trim(),
    category,
    price: mapped.price,
    unitReference: mapped.unitReference?.trim() || undefined,
    isActive: mapped.isActive ?? true,
  }
}

const upsertLabTestRow = (row: ParsedLabTestRow): 'imported' | 'updated' => {
  const existing = row.testId ? getLabTestByTestId(row.testId) : undefined

  saveLabTestCatalogEntry({
    id: existing?.id,
    testId: row.testId,
    testName: row.testName,
    category: row.category,
    price: row.price,
    unitReference: row.unitReference,
    isActive: row.isActive,
  })

  return existing ? 'updated' : 'imported'
}

export function downloadLabTestCatalogTemplate(): void {
  const sampleCode = peekNextLabTestCode()
  const ws = XLSX.utils.aoa_to_sheet([
    LAB_TEST_CATALOG_HEADERS as unknown as string[],
    [sampleCode, ...SAMPLE_ROW.slice(1)],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lab Tests')
  XLSX.writeFile(wb, 'lab-tests-catalog-template.xlsx')
}

export async function importLabTestCatalogFromExcel(file: File): Promise<LabTestCatalogImportResult> {
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

  const result: LabTestCatalogImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  rows.forEach((row, index) => {
    const parsed = parseRowObject(row, index + 2)
    if (typeof parsed === 'string') {
      result.skipped += 1
      result.errors.push(parsed)
      return
    }

    try {
      const action = upsertLabTestRow(parsed)
      if (action === 'imported') result.imported += 1
      else result.updated += 1
    } catch (err) {
      result.skipped += 1
      result.errors.push(
        `Row ${index + 2}: ${err instanceof Error ? err.message : 'Could not save test'}`,
      )
    }
  })

  return result
}
