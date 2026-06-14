-- FSH Hospital — wipe all patient / visit / clinical operational data
-- Keeps: staff, departments, catalogs, wards/rooms/beds (beds unoccupied), inventory, settings
--
-- ⚠️  CLOSE ALL HMS BROWSER TABS before running — open tabs re-upload old data to full_snapshot!
-- Then hard-refresh (Ctrl+Shift+R) after this script completes.
-- Or run: npm run db:clear-patients-api

BEGIN;

-- 1) Clear full_snapshot FIRST (app loads patients from here)
UPDATE public.hms_meta
SET
  id_counter = 100,
  full_snapshot = (
    COALESCE(full_snapshot, '{}'::jsonb)
    || jsonb_build_object(
      'idCounter', 100,
      'patients', '[]'::jsonb,
      'patientAccounts', '[]'::jsonb,
      'accountTransactions', '[]'::jsonb,
      'receptionReceipts', '[]'::jsonb,
      'visits', '[]'::jsonb,
      'clinicalNotes', '[]'::jsonb,
      'diagnoses', '[]'::jsonb,
      'prescriptions', '[]'::jsonb,
      'labRequests', '[]'::jsonb,
      'surgeryRequests', '[]'::jsonb,
      'admissionRequests', '[]'::jsonb,
      'admissions', '[]'::jsonb,
      'medicationAdministrations', '[]'::jsonb,
      'nursingNotes', '[]'::jsonb,
      'doctorOrders', '[]'::jsonb,
      'payments', '[]'::jsonb,
      'emergencyCases', '[]'::jsonb,
      'incomeRecords', '[]'::jsonb,
      'patientDiscounts', '[]'::jsonb,
      'obstetricDeliveries', '[]'::jsonb,
      'departmentSupplyRequests', '[]'::jsonb,
      'pharmacySupplyRequests', '[]'::jsonb,
      'labSupplyRequests', '[]'::jsonb,
      'beds', COALESCE(
        (
          SELECT jsonb_agg((elem - 'patientId' - 'admissionId') || '{"isOccupied": false}'::jsonb)
          FROM jsonb_array_elements(COALESCE(full_snapshot -> 'beds', '[]'::jsonb)) AS elem
        ),
        '[]'::jsonb
      )
    )
  ),
  updated_at = now()
WHERE id = 'main';

-- 2) Clear normalized mirror tables
TRUNCATE TABLE public.hms_patients;
TRUNCATE TABLE public.hms_patient_accounts;
TRUNCATE TABLE public.hms_account_transactions;
TRUNCATE TABLE public.hms_reception_receipts;
TRUNCATE TABLE public.hms_visits;
TRUNCATE TABLE public.hms_clinical_notes;
TRUNCATE TABLE public.hms_diagnoses;
TRUNCATE TABLE public.hms_prescriptions;
TRUNCATE TABLE public.hms_lab_requests;
TRUNCATE TABLE public.hms_surgery_requests;
TRUNCATE TABLE public.hms_admission_requests;
TRUNCATE TABLE public.hms_admissions;
TRUNCATE TABLE public.hms_medication_administrations;
TRUNCATE TABLE public.hms_nursing_notes;
TRUNCATE TABLE public.hms_doctor_orders;
TRUNCATE TABLE public.hms_payments;
TRUNCATE TABLE public.hms_emergency_cases;
TRUNCATE TABLE public.hms_income_records;
TRUNCATE TABLE public.hms_patient_discounts;
TRUNCATE TABLE public.hms_obstetric_deliveries;
TRUNCATE TABLE public.hms_department_supply_requests;
TRUNCATE TABLE public.hms_pharmacy_supply_requests;
TRUNCATE TABLE public.hms_lab_supply_requests;

-- 3) Release all beds (keep ward/room/bed structure)
UPDATE public.hms_beds
SET
  data = (data - 'patientId' - 'admissionId') || '{"isOccupied": false}'::jsonb,
  updated_at = now();

-- 4) Lock cleared state — open tabs cannot resurrect ghost data for doctor/lab/nursing
UPDATE public.hms_meta
SET
  system_settings = COALESCE(system_settings, '{}'::jsonb)
    || jsonb_build_object('patientDataClearedAt', now()::text, 'lastModifiedAt', now()::text),
  full_snapshot = jsonb_set(
    COALESCE(full_snapshot, '{}'::jsonb),
    '{systemSettings,patientDataClearedAt}',
    to_jsonb(now()::text),
    true
  )
WHERE id = 'main';

COMMIT;

-- Verify (should show 0, 0)
SELECT
  jsonb_array_length(COALESCE(full_snapshot -> 'patients', '[]'::jsonb)) AS snapshot_patients,
  jsonb_array_length(COALESCE(full_snapshot -> 'visits', '[]'::jsonb)) AS snapshot_visits
FROM public.hms_meta
WHERE id = 'main';
