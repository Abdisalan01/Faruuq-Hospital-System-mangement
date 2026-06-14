-- Doctor monthly commission payout confirmations (50% of registration, lab, surgery, obstetric fees)
-- Safe to run standalone (creates helper function if migration 004 was not applied)

SELECT public.hms_create_entity_table('hms_doctor_commission_payouts');

CREATE OR REPLACE FUNCTION public.hms_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.hms_doctor_commission_payouts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hms_doctor_commission_payouts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS hms_doctor_commission_payouts_access ON public.hms_doctor_commission_payouts';
    EXECUTE $p$
      CREATE POLICY hms_doctor_commission_payouts_access ON public.hms_doctor_commission_payouts
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)
    $p$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.hms_doctor_commission_payouts TO anon, authenticated';
    EXECUTE 'DROP TRIGGER IF EXISTS hms_doctor_commission_payouts_updated_at ON public.hms_doctor_commission_payouts';
    EXECUTE $t$
      CREATE TRIGGER hms_doctor_commission_payouts_updated_at
      BEFORE UPDATE ON public.hms_doctor_commission_payouts
      FOR EACH ROW EXECUTE FUNCTION public.hms_set_updated_at()
    $t$;
  END IF;
END $$;
