-- Quick setup: run this first in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.hms_snapshots (
  id text PRIMARY KEY DEFAULT 'main',
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hms_snapshots_updated_at_idx ON public.hms_snapshots (updated_at DESC);

ALTER TABLE public.hms_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hms_snapshots_public_access" ON public.hms_snapshots;
CREATE POLICY "hms_snapshots_public_access"
  ON public.hms_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);
