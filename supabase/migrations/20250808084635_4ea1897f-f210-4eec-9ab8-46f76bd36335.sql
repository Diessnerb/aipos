-- Create the user directly with a specific UUID
DO $$
DECLARE
    new_auth_id uuid := gen_random_uuid();
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_user_meta_data
    ) VALUES (
        new_auth_id,
        'dec@dec.com',
        crypt('declan21', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"full_name": "Dec", "role": "admin"}'::jsonb
    );
    
    -- Insert into public.users
    INSERT INTO public.users (
        auth_user_id,
        email,
        full_name,
        role,
        company_id,
        is_company_admin
    ) VALUES (
        new_auth_id,
        'dec@dec.com',
        'Dec',
        'admin',
        'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
        true
    );
EXCEPTION
    WHEN unique_violation THEN
        NULL;
END $$;