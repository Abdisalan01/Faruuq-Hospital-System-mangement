-- FSH Hospital HMS — ensure anon/authenticated can SELECT, INSERT, UPDATE, DELETE
-- Run in Supabase Dashboard → SQL Editor if updates appear to succeed but rows do not change.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'hms_meta',
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
    'hms_obstetric_deliveries',
    'hms_admissions',
    'hms_medication_administrations',
    'hms_nursing_notes',
    'hms_doctor_orders',
    'hms_inventory_items',
    'hms_stock_transactions',
    'hms_payments',
    'hms_emergency_cases',
    'hms_income_records',
    'hms_expense_records'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Skipping missing table: %', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_access', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);

    -- Single policy: full read/write for app (anon + authenticated)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl || '_access',
      tbl
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated',
      tbl
    );
  END LOOP;
END $$;

-- Auto-touch updated_at on every row UPDATE (entity tables with id + data + updated_at)
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
DECLARE
  tbl text;
  entity_tables text[] := ARRAY[
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
    'hms_obstetric_deliveries',
    'hms_admissions',
    'hms_medication_administrations',
    'hms_nursing_notes',
    'hms_doctor_orders',
    'hms_inventory_items',
    'hms_stock_transactions',
    'hms_payments',
    'hms_emergency_cases',
    'hms_income_records',
    'hms_expense_records'
  ];
BEGIN
  FOREACH tbl IN ARRAY entity_tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_updated_at', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hms_set_updated_at()',
      tbl || '_updated_at',
      tbl
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION public.hms_set_updated_at IS 'Keeps hms_* entity updated_at fresh on every UPDATE';
