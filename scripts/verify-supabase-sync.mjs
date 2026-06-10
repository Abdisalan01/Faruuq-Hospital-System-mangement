/**
 * Verify HMS Supabase tables are reachable and report row counts.
 * Run: node scripts/verify-supabase-sync.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {
    /* no .env */
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const TABLES = [
  'hms_meta',
  'hms_patients',
  'hms_visits',
  'hms_clinical_notes',
  'hms_prescriptions',
  'hms_lab_requests',
  'hms_surgery_requests',
  'hms_admission_requests',
  'hms_admissions',
  'hms_payments',
  'hms_income_records',
  'hms_reception_receipts',
  'hms_patient_accounts',
  'hms_account_transactions',
  'hms_patient_discounts',
  'hms_staff_users',
  'hms_emergency_cases',
  'hms_department_supply_requests',
  'hms_pharmacy_supply_requests',
  'hms_lab_supply_requests',
  'hms_inventory_items',
  'hms_stock_transactions',
  'hms_medicine_catalog',
  'hms_lab_test_catalog',
  'hms_surgery_catalog',
  'hms_wards',
  'hms_rooms',
  'hms_beds',
  'hms_departments',
  'hms_doctor_orders',
]

async function countTable(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    return { table, ok: false, error: `${res.status} ${text}` }
  }
  const range = res.headers.get('content-range') ?? ''
  const match = range.match(/\/(\d+)$/)
  const count = match ? Number(match[1]) : 0
  return { table, ok: true, count }
}

async function fetchMeta() {
  const res = await fetch(`${url}/rest/v1/hms_meta?select=updated_at,version&id=eq.main`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] ?? null
}

console.log('FSH Hospital — Supabase sync verification')
console.log('URL:', url)
console.log('')

const meta = await fetchMeta()
if (meta) {
  console.log(`hms_meta.updated_at: ${meta.updated_at}`)
  console.log(`hms_meta.version: ${meta.version}`)
} else {
  console.log('hms_meta: NOT FOUND or not readable')
}
console.log('')

const results = await Promise.all(TABLES.map(countTable))
let failures = 0

for (const r of results) {
  if (!r.ok) {
    failures++
    console.log(`✗ ${r.table.padEnd(35)} ${r.error}`)
  } else {
    console.log(`✓ ${r.table.padEnd(35)} ${r.count} rows`)
  }
}

console.log('')
if (failures > 0) {
  console.log(`${failures} table(s) failed — run migration 004 for RLS/grants.`)
  process.exit(1)
}
console.log('All tables reachable.')
