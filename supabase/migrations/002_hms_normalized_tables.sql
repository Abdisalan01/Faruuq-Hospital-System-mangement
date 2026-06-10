-- FSH Hospital HMS — normalized backend tables (one table per entity)
-- Run in Supabase SQL Editor after 001_hms_initial.sql (or standalone)

-- Meta: version, id counter, system settings
CREATE TABLE IF NOT EXISTS public.hms_meta (
  id text PRIMARY KEY DEFAULT 'main',
  version integer NOT NULL DEFAULT 1,
  id_counter integer NOT NULL DEFAULT 100,
  system_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_snapshot jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hms_meta
  ADD COLUMN IF NOT EXISTS full_snapshot jsonb;

-- Helper: entity row table pattern (id + jsonb data)
CREATE OR REPLACE FUNCTION public.hms_create_entity_table(table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )',
    table_name
  );
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_access', table_name);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
    table_name || '_access',
    table_name
  );
END;
$$;

SELECT public.hms_create_entity_table('hms_departments');
SELECT public.hms_create_entity_table('hms_staff_users');
SELECT public.hms_create_entity_table('hms_patients');
SELECT public.hms_create_entity_table('hms_patient_accounts');
SELECT public.hms_create_entity_table('hms_account_transactions');
SELECT public.hms_create_entity_table('hms_reception_receipts');
SELECT public.hms_create_entity_table('hms_visits');
SELECT public.hms_create_entity_table('hms_clinical_notes');
SELECT public.hms_create_entity_table('hms_diagnoses');
SELECT public.hms_create_entity_table('hms_prescriptions');
SELECT public.hms_create_entity_table('hms_lab_requests');
SELECT public.hms_create_entity_table('hms_surgery_requests');
SELECT public.hms_create_entity_table('hms_department_supply_requests');
SELECT public.hms_create_entity_table('hms_pharmacy_supply_requests');
SELECT public.hms_create_entity_table('hms_lab_supply_requests');
SELECT public.hms_create_entity_table('hms_admission_requests');
SELECT public.hms_create_entity_table('hms_wards');
SELECT public.hms_create_entity_table('hms_rooms');
SELECT public.hms_create_entity_table('hms_beds');
SELECT public.hms_create_entity_table('hms_lab_test_catalog');
SELECT public.hms_create_entity_table('hms_medicine_catalog');
SELECT public.hms_create_entity_table('hms_surgery_catalog');
SELECT public.hms_create_entity_table('hms_discounts');
SELECT public.hms_create_entity_table('hms_patient_discounts');
SELECT public.hms_create_entity_table('hms_admissions');
SELECT public.hms_create_entity_table('hms_medication_administrations');
SELECT public.hms_create_entity_table('hms_nursing_notes');
SELECT public.hms_create_entity_table('hms_doctor_orders');
SELECT public.hms_create_entity_table('hms_inventory_items');
SELECT public.hms_create_entity_table('hms_stock_transactions');
SELECT public.hms_create_entity_table('hms_payments');
SELECT public.hms_create_entity_table('hms_emergency_cases');
SELECT public.hms_create_entity_table('hms_income_records');
SELECT public.hms_create_entity_table('hms_expense_records');

ALTER TABLE public.hms_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hms_meta_access ON public.hms_meta;
CREATE POLICY hms_meta_access ON public.hms_meta FOR ALL USING (true) WITH CHECK (true);

-- Drop legacy JSON blob table (data now lives in normalized tables)
DROP TABLE IF EXISTS public.hms_snapshots;

COMMENT ON TABLE public.hms_meta IS 'HMS global state: version, id counter, system settings';
COMMENT ON TABLE public.hms_patients IS 'Patient records — one row per patient';
COMMENT ON TABLE public.hms_visits IS 'Outpatient visits — one row per visit';



