-- FSH Hospital HMS — initial Supabase schema
-- Run in Supabase Dashboard → SQL Editor (or via Supabase CLI)

-- Single-row JSON store (mirrors frontend hmsStore snapshot)
CREATE TABLE IF NOT EXISTS public.hms_snapshots (
  id text PRIMARY KEY DEFAULT 'main',
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hms_snapshots_updated_at_idx ON public.hms_snapshots (updated_at DESC);

ALTER TABLE public.hms_snapshots ENABLE ROW LEVEL SECURITY;

-- Development: allow app access with anon key (tighten for production — use Supabase Auth + RLS)
DROP POLICY IF EXISTS "hms_snapshots_public_access" ON public.hms_snapshots;
CREATE POLICY "hms_snapshots_public_access"
  ON public.hms_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: staff table for future Supabase Auth linking (normalized path)
CREATE TABLE IF NOT EXISTS public.staff_users (
  id text PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL,
  department_id text,
  phone text,
  service_fee numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_users_read" ON public.staff_users;
CREATE POLICY "staff_users_read"
  ON public.staff_users
  FOR SELECT
  USING (true);

COMMENT ON TABLE public.hms_snapshots IS 'Full HMS application state (JSON). Synced from React frontend.';
COMMENT ON TABLE public.staff_users IS 'Hospital staff profiles — link to auth.users when using Supabase Auth.';
