/**
 * Run: npm run db:setup
 * Requires SUPABASE_DB_URL in .env (from Supabase Dashboard → Settings → Database → Connection string → URI)
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

1. Open Supabase Dashboard → Settings → Database
2. Copy "Connection string" → URI (replace [YOUR-PASSWORD] with your DB password)
3. Add to .env:
   SUPABASE_DB_URL=postgresql://postgres.xxx:PASSWORD@...

Then run: npm run db:setup
`)
  process.exit(1)
}

const migrationsDir = path.join(root, 'supabase', 'migrations')
const migrationFiles = ['002_hms_normalized_tables.sql', '003_hms_meta_snapshot_cache.sql']

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    await client.query(sql)
    console.log(`✓ Applied ${file}`)
  }
  console.log('✓ HMS backend tables ready (hms_meta + 33 entity tables)')
} catch (err) {
  console.error('✗ Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
