-- Update Loom Bar & Cafe credentials to trial account
-- New Email: trial_account@gmail.com
-- New Password: TrialAccountPassword1

DO $$
DECLARE
    user_uuid uuid := '4e0ba28e-1a81-424f-9116-630f404084d6';
    company_uuid uuid := 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731';
BEGIN
    -- 1. Update auth.users (Supabase Auth) with new email and password
    UPDATE auth.users
    SET 
        email = 'trial_account@gmail.com',
        encrypted_password = crypt('TrialAccountPassword1', gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now(),
        raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{full_name}',
            '"Trial Account"'
        )
    WHERE id = user_uuid;

    -- 2. Update public.users with new email
    UPDATE public.users
    SET 
        email = 'trial_account@gmail.com',
        full_name = 'Trial Account',
        updated_at = now()
    WHERE id = user_uuid;

    -- 3. Update companies table default admin email
    UPDATE public.companies
    SET 
        default_admin_email = 'trial_account@gmail.com',
        updated_at = now()
    WHERE id = company_uuid;

    RAISE NOTICE 'Successfully updated Loom Bar & Cafe credentials to trial account';
END $$;