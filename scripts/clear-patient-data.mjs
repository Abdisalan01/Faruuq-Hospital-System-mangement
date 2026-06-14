/**
 * Remove all patient / visit / clinical data from Supabase.
 * Keeps: staff, departments, catalogs, wards/rooms/beds, inventory, settings.
 * Run: npm run db:clear-patients
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
  console.error(`
Missing SUPABASE_DB_URL in .env

1. Supabase Dashboard → Settings → Database → Connection string (URI)
2. Add to .env:
   SUPABASE_DB_URL=postgresql://postgres.xxx:PASSWORD@...

Then run: npm run db:clear-patients
`)
  process.exit(1)
}

const sqlPath = path.join(root, 'supabase', 'migrations', '006_hms_clear_patient_data.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  console.log('✓ All patient records removed from database.')
  console.log('  Kept: staff, catalogs, wards/rooms/beds, inventory, settings.')
  console.log('\nNext: hard-refresh the app (Ctrl+Shift+R) on every open browser tab.')
} catch (err) {
  console.error('✗ Clear failed:', err.message)
  console.error('Ensure npm run db:setup was run and tables exist.')
  process.exit(1)
} finally {
  await client.end()
}
