/**
 * Clear patient data via Supabase REST API (uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).
 * Fixes hms_meta.full_snapshot AND deletes mirror rows.
 *
 * IMPORTANT: Close ALL HMS browser tabs before running, then hard-refresh after.
 *
 * Run: npm run db:clear-patients-api
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

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const PATIENT_TABLES = [
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
  'hms_admission_requests',
  'hms_admissions',
  'hms_medication_administrations',
  'hms_nursing_notes',
  'hms_doctor_orders',
  'hms_payments',
  'hms_emergency_cases',
  'hms_income_records',
  'hms_patient_discounts',
  'hms_obstetric_deliveries',
  'hms_department_supply_requests',
  'hms_pharmacy_supply_requests',
  'hms_lab_supply_requests',
]

const EMPTY_COLLECTIONS = {
  patients: [],
  patientAccounts: [],
  accountTransactions: [],
  receptionReceipts: [],
  visits: [],
  clinicalNotes: [],
  diagnoses: [],
  prescriptions: [],
  labRequests: [],
  surgeryRequests: [],
  admissionRequests: [],
  admissions: [],
  medicationAdministrations: [],
  nursingNotes: [],
  doctorOrders: [],
  payments: [],
  emergencyCases: [],
  incomeRecords: [],
  patientDiscounts: [],
  obstetricDeliveries: [],
  departmentSupplyRequests: [],
  pharmacySupplyRequests: [],
  labSupplyRequests: [],
}

async function deleteAllRows(table) {
  const res = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`${table} delete failed: ${res.status} ${text}`)
  }
}

async function fetchMeta() {
  const res = await fetch(`${url}/rest/v1/hms_meta?select=id,full_snapshot,system_settings,version,id_counter&id=eq.main`, {
    headers,
  })
  if (!res.ok) throw new Error(`hms_meta read failed: ${res.status}`)
  const rows = await res.json()
  return rows[0]
}

async function releaseBedsInMeta(snapshot) {
  const beds = (snapshot.beds ?? []).map((bed) => {
    const copy = { ...bed }
    delete copy.patientId
    delete copy.admissionId
    copy.isOccupied = false
    return copy
  })

  const bedRes = await fetch(`${url}/rest/v1/hms_beds?select=id,data`, { headers })
  if (bedRes.ok) {
    const rows = await bedRes.json()
    for (const row of rows) {
      const data = { ...row.data }
      delete data.patientId
      delete data.admissionId
      data.isOccupied = false
      await fetch(`${url}/rest/v1/hms_beds?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
      })
    }
  }

  return beds
}

console.log('')
console.log('⚠️  XIR DHAMMAAN tabs-ka HMS browser-ka (doctor, reception, admin...)!')
console.log('    Haddii tab furan tahay, app-ku wuxuu dib ugu qorayaa bukaannada 2 ilbiriqsi kasta.')
console.log('    Sug 5 ilbiriqsi kadib markaad dhammaan tabs-ka xirto...')
await new Promise((r) => setTimeout(r, 5_000))

console.log('Clearing mirror tables...')
for (const table of PATIENT_TABLES) {
  await deleteAllRows(table)
  console.log(`  ✓ ${table}`)
}

console.log('Updating hms_meta.full_snapshot...')
const meta = await fetchMeta()
if (!meta?.full_snapshot) {
  console.error('hms_meta.full_snapshot missing — run npm run db:setup first')
  process.exit(1)
}

const beds = await releaseBedsInMeta(meta.full_snapshot)
const updatedAt = new Date().toISOString()
const systemSettings = {
  ...(meta.system_settings ?? meta.full_snapshot?.systemSettings ?? {}),
  patientDataClearedAt: updatedAt,
  lastModifiedAt: updatedAt,
}
const fullSnapshot = {
  ...meta.full_snapshot,
  ...EMPTY_COLLECTIONS,
  idCounter: 100,
  beds,
  systemSettings,
}

const patchRes = await fetch(`${url}/rest/v1/hms_meta?id=eq.main`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    id_counter: 100,
    full_snapshot: fullSnapshot,
    system_settings: systemSettings,
    updated_at: updatedAt,
  }),
})

if (!patchRes.ok) {
  const text = await patchRes.text()
  throw new Error(`hms_meta update failed: ${patchRes.status} ${text}`)
}

// Browser tabs may re-upload stale data — retry until snapshot stays empty
let patientCount = -1
let visitCount = -1
for (let attempt = 1; attempt <= 8; attempt++) {
  await new Promise((r) => setTimeout(r, 800))
  const verify = await fetchMeta()
  patientCount = verify.full_snapshot?.patients?.length ?? -1
  visitCount = verify.full_snapshot?.visits?.length ?? -1
  if (patientCount === 0 && visitCount === 0) break

  console.log(`  ↻ Attempt ${attempt}: snapshot still has ${patientCount} patients — re-applying clear...`)
  const retrySnap = {
    ...verify.full_snapshot,
    ...EMPTY_COLLECTIONS,
    idCounter: 100,
    beds: await releaseBedsInMeta(verify.full_snapshot),
    systemSettings: {
      ...(verify.system_settings ?? verify.full_snapshot?.systemSettings ?? {}),
      patientDataClearedAt: updatedAt,
      lastModifiedAt: updatedAt,
    },
  }
  await fetch(`${url}/rest/v1/hms_meta?id=eq.main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      id_counter: 100,
      full_snapshot: retrySnap,
      system_settings: retrySnap.systemSettings,
      updated_at: new Date().toISOString(),
    }),
  })
}

console.log('')
console.log(`✓ Done. full_snapshot: ${patientCount} patients, ${visitCount} visits`)
if (patientCount !== 0 || visitCount !== 0) {
  console.error('')
  console.error('✗ FAILED — bukaannada weli waa jiraan database-ka.')
  console.error('  Sabab: HMS app weli waa furan browser tab. Xir DHAMMAAN tabs, kadib run:')
  console.error('  npm run db:clear-patients-api')
  process.exit(1)
}

console.log('\nNext: open ONE browser tab → hard refresh (Ctrl+Shift+R) → Patient List should be empty.')
