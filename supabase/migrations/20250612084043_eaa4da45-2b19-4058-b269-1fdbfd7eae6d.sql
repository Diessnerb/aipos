
-- Add all users to all existing channels if they're not already members
INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
SELECT 
  c.id as channel_id,
  u.id as user_id,
  CASE 
    WHEN c.is_read_only = true AND u.role NOT IN ('manager', 'admin') THEN false
    ELSE true
  END as can_write
FROM public.channels c
CROSS JOIN public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.channel_memberships cm 
  WHERE cm.channel_id = c.id AND cm.user_id = u.id
);

-- Also create a function to automatically add new users to all existing channels
CREATE OR REPLACE FUNCTION public.add_user_to_all_channels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add the new user to all existing channels
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  SELECT 
    c.id as channel_id,
    NEW.id as user_id,
    CASE 
      WHEN c.is_read_only = true AND NEW.role NOT IN ('manager', 'admin') THEN false
      ELSE true
    END as can_write
  FROM public.channels c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel_memberships cm 
    WHERE cm.channel_id = c.id AND cm.user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Create a trigger to automatically add new users to all channels
DROP TRIGGER IF EXISTS trigger_add_user_to_all_channels ON public.users;
CREATE TRIGGER trigger_add_user_to_all_channels
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.add_user_to_all_channels();

-- Also create a function to automatically add all users to new channels
CREATE OR REPLACE FUNCTION public.add_all_users_to_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add all existing users to the new channel
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  SELECT 
    NEW.id as channel_id,
    u.id as user_id,
    CASE 
      WHEN NEW.is_read_only = true AND u.role NOT IN ('manager', 'admin') THEN false
      ELSE true
    END as can_write
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel_memberships cm 
    WHERE cm.channel_id = NEW.id AND cm.user_id = u.id
  );
  
  RETURN NEW;
END;
$$;

-- Create a trigger to automatically add all users to new channels
DROP TRIGGER IF EXISTS trigger_add_all_users_to_channel ON public.channels;
CREATE TRIGGER trigger_add_all_users_to_channel
  AFTER INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.add_all_users_to_channel();
