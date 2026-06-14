-- Enable Supabase Realtime for instant cross-role sync (doctor cancel lab → reception Lab Fees)
alter publication supabase_realtime add table public.hms_meta;
alter publication supabase_realtime add table public.hms_lab_requests;
alter publication supabase_realtime add table public.hms_surgery_requests;
alter publication supabase_realtime add table public.hms_admission_requests;
alter publication supabase_realtime add table public.hms_visits;
