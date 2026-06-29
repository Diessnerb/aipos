-- Enable full row replication for customers table to support realtime updates
ALTER TABLE public.customers REPLICA IDENTITY FULL;

-- Add customers table to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;