-- Clean up all login data for Loom Bar & Cafe (company_id: e95d96dd-fbd6-4606-a7de-4ce9a6c3a731)

-- First, get all auth_user_ids from public.users for this company
DO $$
DECLARE
    auth_id uuid;
BEGIN
    -- Delete from auth.users for all users in this company
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