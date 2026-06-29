
-- Disable RLS and remove all policies for channels table
ALTER TABLE public.channels DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view channels they are members of" ON public.channels;
DROP POLICY IF EXISTS "Managers and admins can create channels" ON public.channels;
DROP POLICY IF EXISTS "Managers and admins can update channels" ON public.channels;

-- Disable RLS and remove all policies for channel_memberships table
ALTER TABLE public.channel_memberships DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.channel_memberships;
DROP POLICY IF EXISTS "Managers and admins can manage memberships" ON public.channel_memberships;

-- Disable RLS and remove all policies for messages table
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view messages in channels they belong to" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to channels where they have write access" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
