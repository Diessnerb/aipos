
-- Add support for direct messages by allowing channel_id to be null
-- and adding a recipient_id for direct messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.users(id);

-- Update the RLS policy to allow users to view direct messages sent to them
DROP POLICY IF EXISTS "Users can view messages in channels they belong to" ON public.messages;

-- Create new policies for both channel messages and direct messages
CREATE POLICY "Users can view channel messages they belong to" 
  ON public.messages 
  FOR SELECT 
  USING (
    channel_id IS NOT NULL AND
    channel_id IN (
      SELECT channel_id 
      FROM public.channel_memberships 
      WHERE user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view direct messages sent to or from them" 
  ON public.messages 
  FOR SELECT 
  USING (
    channel_id IS NULL AND
    (
      user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
      recipient_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

-- Update insert policy to handle both channel and direct messages
DROP POLICY IF EXISTS "Users can send messages to channels where they have write access" ON public.messages;

CREATE POLICY "Users can send channel messages where they have write access" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    channel_id IS NOT NULL AND
    channel_id IN (
      SELECT cm.channel_id 
      FROM public.channel_memberships cm
      JOIN public.channels c ON c.id = cm.channel_id
      WHERE cm.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      AND (
        (cm.can_write = true AND c.is_read_only = false) 
        OR 
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
      )
    )
  );

CREATE POLICY "Users can send direct messages" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    channel_id IS NULL AND
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) AND
    recipient_id IS NOT NULL
  );
