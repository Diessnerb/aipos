-- Enable realtime for company_subscription_features table
ALTER TABLE public.company_subscription_features REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_subscription_features;