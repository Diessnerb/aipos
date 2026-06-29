-- Create admin credentials for Loom Bar & Cafe
-- Email: theloomhelmshore@gmail.com
-- Password: TheLoom123

SELECT public.create_company_admin_for_existing_company(
    'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
    'theloomhelmshore@gmail.com',
    'TheLoom123',
    'Loom Admin'
);