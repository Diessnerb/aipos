
-- First, let's check if the channels table needs any updates for this functionality
-- Looking at the existing channels table, it already has name, description, created_by fields
-- We'll need to make sure we can create channels and add members properly

-- Create a function to create a channel and add members
CREATE OR REPLACE FUNCTION public.create_channel_with_members(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_member_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_channel_id UUID;
  member_id UUID;
BEGIN
  -- Create the channel
  INSERT INTO public.channels (name, description, created_by, type)
  VALUES (p_name, p_description, auth.uid(), 'public')
  RETURNING id INTO new_channel_id;

  -- Add the creator as a member
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  VALUES (new_channel_id, auth.uid(), true);

  -- Add specified members if any
  IF p_member_ids IS NOT NULL THEN
    FOREACH member_id IN ARRAY p_member_ids
    LOOP
      INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
      VALUES (new_channel_id, member_id, true)
      ON CONFLICT (channel_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN new_channel_id;
END;
$$;
