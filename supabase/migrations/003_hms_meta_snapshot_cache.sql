-- Fast load/save: one row fetch instead of 34 table requests
ALTER TABLE public.hms_meta
  ADD COLUMN IF NOT EXISTS full_snapshot jsonb;

COMMENT ON COLUMN public.hms_meta.full_snapshot IS 'Full HMS state JSON — primary app sync path for speed';
