# Supabase Backend Setup — FSH Hospital HMS

All HMS data lives in **Supabase PostgreSQL tables** — not localStorage, not mock data.

## 1. Environment variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_USE_SUPABASE=true
```

> Vite requires the `VITE_` prefix.

## 2. Create database tables

**Option A — SQL Editor (recommended)**

1. Open [Supabase SQL Editor](https://supabase.com/dashboard)
2. Paste and run (in order):
   - `supabase/migrations/002_hms_normalized_tables.sql`
   - `supabase/migrations/003_hms_meta_snapshot_cache.sql` *(fast load — required)*

**Option B — CLI script**

Add database password to `.env`:

```env
SUPABASE_DB_URL=postgresql://postgres.xxx:PASSWORD@...
```

Then:

```bash
npm run db:setup
```

## 3. Backend tables (34 total)

| Table | Content |
|-------|---------|
| `hms_meta` | Version, ID counter, system settings |
| `hms_patients` | Patients |
| `hms_visits` | Outpatient visits |
| `hms_staff_users` | Staff / login users |
| `hms_lab_requests` | Lab orders |
| `hms_admissions` | Inpatient admissions |
| `hms_medicine_catalog` | Medicine catalog |
| … | 27 more entity tables |

Each entity table stores one row per record (`id` + `data` jsonb).

## 4. Start the app

```bash
npm install
npm run dev
```

On first load:
1. App fetches all tables from Supabase
2. If empty → saves bootstrap state (admin user + empty lists)
3. All changes auto-save to Supabase tables

## 5. Login (bootstrap admin only)

| Email | Password |
|-------|----------|
| admin@hms.com | password |

Create other staff via **Admin → Users**. No demo patients or visits are pre-loaded.

## 6. Clear all data (reset database)

```bash
npm run db:reset
```

Then refresh the app — starts fresh with empty data + admin user.

## 7. Architecture

```
React UI → hmsStore (memory) → hms_meta.full_snapshot (1 fast request)
```

Entity tables (`hms_patients`, etc.) exist for structure; app sync uses `full_snapshot` for speed.

- **No localStorage** when `VITE_USE_SUPABASE=true`
- **No mock/seed data** in frontend code
- **Database is the single source of truth**

## 8. Production recommendations

1. Replace open RLS policies with Supabase Auth + role-based policies
2. Never commit `.env`
3. Use service role key only in server scripts (`db:setup`, `db:reset`)

## 9. Disable Supabase (dev only)

```env
VITE_USE_SUPABASE=false
```

Falls back to localStorage — not recommended for production.
