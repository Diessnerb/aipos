
-- Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'public', -- 'public', 'private', 'dm'
  category TEXT, -- 'shift-handover', 'task', 'announcement', 'reminder', 'general'
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read_only BOOLEAN DEFAULT false -- staff can't write in read-only channels
);

-- Create channel memberships table
CREATE TABLE IF NOT EXISTS public.channel_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  can_write BOOLEAN DEFAULT true,
  UNIQUE(channel_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_edited BOOLEAN DEFAULT false
);

-- Enable RLS on all tables
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channels
CREATE POLICY "Users can view channels they are members of" 
  ON public.channels 
  FOR SELECT 
  USING (
    id IN (
      SELECT channel_id 
      FROM public.channel_memberships 
      WHERE user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Managers can create channels" 
  ON public.channels 
  FOR INSERT 
  WITH CHECK (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
  );

CREATE POLICY "Managers can update channels" 
  ON public.channels 
  FOR UPDATE 
  USING (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
  );

-- RLS Policies for channel memberships
CREATE POLICY "Users can view their own memberships" 
  ON public.channel_memberships 
  FOR SELECT 
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR 
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
  );

CREATE POLICY "Managers can manage memberships" 
  ON public.channel_memberships 
  FOR ALL 
  USING (
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in channels they belong to" 
  ON public.messages 
  FOR SELECT 
  USING (
    channel_id IN (
      SELECT channel_id 
      FROM public.channel_memberships 
      WHERE user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

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
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'manager'
      )
    )
  );

CREATE POLICY "Users can update their own messages" 
  ON public.messages 
  FOR UPDATE 
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Insert default channels
INSERT INTO public.channels (name, description, category, is_read_only) VALUES 
('General', 'General announcements and updates', 'announcement', true),
('Shift Handover', 'Shift handover information', 'shift-handover', true),
('Tasks', 'Task assignments and updates', 'task', true),
('Reminders', 'Important reminders', 'reminder', true);

-- Enable realtime for tables
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channel_memberships REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_memberships;
