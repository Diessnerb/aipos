-- Clean up all login data for Loom Bar & Cafe with complete dependency handling
-- Company ID: e95d96dd-fbd6-4606-a7de-4ce9a6c3a731

-- Get all user IDs for this company first
DO $$
DECLARE
    user_ids uuid[];
    auth_ids uuid[];
BEGIN
    -- Collect all user IDs and auth IDs
    SELECT array_agg(id), array_agg(auth_user_id) 
    INTO user_ids, auth_ids
    FROM public.users 
    WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;

    IF user_ids IS NOT NULL THEN
        -- Delete from all tables that reference users
        DELETE FROM public.messages WHERE user_id = ANY(user_ids) OR recipient_id = ANY(user_ids);
        DELETE FROM public.channel_memberships WHERE user_id = ANY(user_ids);
        DELETE FROM public.rota_entries WHERE user_id = ANY(user_ids);
        DELETE FROM public.rotas WHERE user_id = ANY(user_ids) OR created_by = ANY(user_ids);
        DELETE FROM public.holiday_requests WHERE user_id = ANY(user_ids);
        DELETE FROM public.off_reasons WHERE user_id = ANY(user_ids);
        DELETE FROM public.shift_logs WHERE user_id = ANY(user_ids);
        DELETE FROM public.shift_swap_requests WHERE original_user_id = ANY(user_ids) OR requested_by_user_id = ANY(user_ids) OR accepted_by_user_id = ANY(user_ids) OR approved_by_user_id = ANY(user_ids);
        DELETE FROM public.shift_approval_requests WHERE requester_user_id = ANY(user_ids) OR reviewed_by_user_id = ANY(user_ids);
        DELETE FROM public.payments WHERE paid_by = ANY(user_ids);
        DELETE FROM public.orders WHERE created_by = ANY(user_ids);
        DELETE FROM public.reservations WHERE created_by = ANY(user_ids);

        -- Delete from auth.users
        IF auth_ids IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = ANY(auth_ids);
        END IF;

        -- Delete from public.users
        DELETE FROM public.users WHERE company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;

        RAISE NOTICE 'Deleted % users and all related data', array_length(user_ids, 1);
    ELSE
        RAISE NOTICE 'No users found for this company';
    END IF;
END $$;

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