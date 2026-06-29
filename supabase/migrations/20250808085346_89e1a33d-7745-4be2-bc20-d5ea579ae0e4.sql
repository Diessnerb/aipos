-- Clean up all login data for Loom Bar & Cafe with proper dependency handling
-- Company ID: e95d96dd-fbd6-4606-a7de-4ce9a6c3a731

-- First, delete all dependent data for users in this company
DELETE FROM public.rota_entries 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid
);

DELETE FROM public.holiday_requests 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid
);

DELETE FROM public.off_reasons 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid
);

DELETE FROM public.shift_logs 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid
);

-- Delete from auth.users for all users in this company
DO $$
DECLARE
    auth_id uuid;
BEGIN
    FOR auth_id IN 
        SELECT auth_user_id 
        FROM public.users 
        WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid 
        AND auth_user_id IS NOT NULL
    LOOP
        DELETE FROM auth.users WHERE id = auth_id;
        RAISE NOTICE 'Deleted auth user: %', auth_id;
    END LOOP;
END $$;

-- Delete all public.users records for this company
DELETE FROM public.users 
WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;

-- Clear the default admin credentials from the company record
UPDATE public.companies 
SET 
    default_admin_email = NULL,
    default_admin_password = NULL,
    updated_at = now()
WHERE id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;

-- Verify cleanup
SELECT 
    COUNT(*) as remaining_users,
    'Loom Bar & Cafe cleanup complete' as status
FROM public.users 
WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;