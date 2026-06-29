
-- Add all users to all existing channels
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
