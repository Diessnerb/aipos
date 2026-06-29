-- Fix the handle_new_user function that's causing auth user creation to fail
-- The profiles table doesn't exist, but this function tries to insert into it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function previously tried to insert into public.profiles which doesn't exist
  -- The app now uses public.users table instead, and user records are created
  -- by the create-company-admin edge function or ensure_user_profile_for_current_auth
  -- Simply return NEW to allow auth user creation to succeed
  RETURN NEW;
END;
$$;