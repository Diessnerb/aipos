-- Create admin credentials for Loom Bar & Cafe as super admin
-- Email: theloomhelmshore@gmail.com  
-- Password: TheLoom123

DO $$
DECLARE
    new_auth_id uuid := gen_random_uuid();
    company_uuid uuid := 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;
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
        'theloomhelmshore@gmail.com',
        crypt('TheLoom123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"full_name": "Loom Admin", "role": "admin"}'::jsonb
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
        'theloomhelmshore@gmail.com',
        'Loom Admin',
        'admin',
        company_uuid,
        true
    );
    
    -- Update company default credentials
    UPDATE public.companies 
    SET 
        default_admin_email = 'theloomhelmshore@gmail.com',
        default_admin_password = 'TheLoom123',
        updated_at = now()
    WHERE id = company_uuid;
    
    RAISE NOTICE 'Admin user created successfully with auth ID: %', new_auth_id;
END $$;