-- Enable RLS on tables that don't have it enabled

-- Enable RLS on tables mentioned in the security warnings
ALTER TABLE public.channel_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- The super_admins and users tables should already have RLS enabled
-- Let's verify and enable if needed
DO $$
BEGIN
    -- Check if RLS is enabled on super_admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'super_admins' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Check if RLS is enabled on users
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;