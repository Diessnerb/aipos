
-- Update the RLS policy to allow both managers and admins to create channels
DROP POLICY IF EXISTS "Managers can create channels" ON public.channels;

CREATE POLICY "Managers and admins can create channels" 
  ON public.channels 
  FOR INSERT 
  WITH CHECK (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('manager', 'admin')
  );

-- Also update the update policy to allow both managers and admins
DROP POLICY IF EXISTS "Managers can update channels" ON public.channels;

CREATE POLICY "Managers and admins can update channels" 
  ON public.channels 
  FOR UPDATE 
  USING (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('manager', 'admin')
  );

-- Update the channel memberships policy to allow both managers and admins to manage memberships
DROP POLICY IF EXISTS "Managers can manage memberships" ON public.channel_memberships;

CREATE POLICY "Managers and admins can manage memberships" 
  ON public.channel_memberships 
  FOR ALL 
  USING (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('manager', 'admin')
  );

-- Update the messages policy to allow both managers and admins to send messages to read-only channels
DROP POLICY IF EXISTS "Users can send messages to channels where they have write access" ON public.messages;

CREATE POLICY "Users can send messages to channels where they have write access" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    channel_id IN (
      SELECT cm.channel_id 
      FROM public.channel_memberships cm
      JOIN public.channels c ON c.id = cm.channel_id
      WHERE cm.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      AND (
        (cm.can_write = true AND c.is_read_only = false) 
        OR 
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('manager', 'admin')
      )
    )
  );
