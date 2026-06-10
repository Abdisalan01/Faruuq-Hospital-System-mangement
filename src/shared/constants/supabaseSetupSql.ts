/** Paste in Supabase Dashboard → SQL Editor → Run */
export const HMS_TABLES_SETUP_SQL = `-- FSH Hospital HMS — backend tables (run full file)
-- See: supabase/migrations/002_hms_normalized_tables.sql

CREATE TABLE IF NOT EXISTS public.hms_meta (
  id text PRIMARY KEY DEFAULT 'main',
  version integer NOT NULL DEFAULT 1,
  id_counter integer NOT NULL DEFAULT 100,
  system_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_snapshot jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If hms_meta already exists without full_snapshot, add it (fast load)
ALTER TABLE public.hms_meta
  ADD COLUMN IF NOT EXISTS full_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.hms_create_entity_table(table_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())',
    table_name
  );
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_access', table_name);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', table_name || '_access', table_name);
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

DROP TABLE IF EXISTS public.hms_snapshots;`

/** @deprecated Use HMS_TABLES_SETUP_SQL */
export const HMS_SNAPSHOTS_SETUP_SQL = HMS_TABLES_SETUP_SQL

export function getSupabaseProjectRef(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!url) return null
  try {
    return new URL(url).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
}

export function getSupabaseSqlEditorUrl(): string | null {
  const ref = getSupabaseProjectRef()
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null
}
