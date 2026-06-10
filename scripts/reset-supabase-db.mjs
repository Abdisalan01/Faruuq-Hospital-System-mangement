/**
 * Wipe all HMS data from Supabase tables (keeps table structure).
 * Run: npm run db:reset
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return {}
  const vars = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

const env = { ...process.env, ...loadEnv() }
const dbUrl = env.SUPABASE_DB_URL

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL in .env — see npm run db:setup')
  process.exit(1)
}

const TABLES = [
  'hms_departments',
  'hms_staff_users',
  'hms_patients',
  'hms_patient_accounts',
  'hms_account_transactions',
  'hms_reception_receipts',
  'hms_visits',
  'hms_clinical_notes',
  'hms_diagnoses',
  'hms_prescriptions',
  'hms_lab_requests',
  'hms_surgery_requests',
  'hms_department_supply_requests',
  'hms_pharmacy_supply_requests',
  'hms_lab_supply_requests',
  'hms_admission_requests',
  'hms_wards',
  'hms_rooms',
  'hms_beds',
  'hms_lab_test_catalog',
  'hms_medicine_catalog',
  'hms_surgery_catalog',
  'hms_discounts',
  'hms_patient_discounts',
  'hms_admissions',
  'hms_medication_administrations',
  'hms_nursing_notes',
  'hms_doctor_orders',
  'hms_inventory_items',
  'hms_stock_transactions',
  'hms_payments',
  'hms_emergency_cases',
  'hms_income_records',
  'hms_expense_records',
  'hms_meta',
]

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  for (const table of TABLES) {
    await client.query(`DELETE FROM public.${table}`)
    console.log(`✓ Cleared ${table}`)
  }
  console.log('\n✓ All HMS data deleted. Restart the app to bootstrap empty state + admin user.')
} catch (err) {
  console.error('✗ Reset failed:', err.message)
  console.error('Run npm run db:setup first if tables do not exist.')
  process.exit(1)
} finally {
  await client.end()
}
