-- Create the admin user for Loom Bar & Cafe with proper auth setup
SELECT public.create_company_admin_for_existing_company(
  'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
  'dec@dec.com',
  'declan21',
  'Dec'
);