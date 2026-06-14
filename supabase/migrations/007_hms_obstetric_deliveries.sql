-- Obstetric / delivery registration records (reception maternity desk)
-- Safe to run standalone (creates helper function if migration 004 was not applied)

SELECT public.hms_create_entity_table('hms_obstetric_deliveries');

CREATE OR REPLACE FUNCTION public.hms_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Grants + RLS
DO $$
BEGIN
  IF to_regclass('public.hms_obstetric_deliveries') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hms_obstetric_deliveries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS hms_obstetric_deliveries_access ON public.hms_obstetric_deliveries';
    EXECUTE $p$
      CREATE POLICY hms_obstetric_deliveries_access ON public.hms_obstetric_deliveries
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)
    $p$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.hms_obstetric_deliveries TO anon, authenticated';
    EXECUTE 'DROP TRIGGER IF EXISTS hms_obstetric_deliveries_updated_at ON public.hms_obstetric_deliveries';
    EXECUTE $t$
      CREATE TRIGGER hms_obstetric_deliveries_updated_at
      BEFORE UPDATE ON public.hms_obstetric_deliveries
      FOR EACH ROW EXECUTE FUNCTION public.hms_set_updated_at()
    $t$;
  END IF;
END $$;
