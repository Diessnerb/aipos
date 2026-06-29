
-- Allow the authenticated role to evaluate RLS policies that reference users/companies
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.companies TO authenticated;

-- Ensure the main data set is readable under RLS (permissions still enforced by policies)
GRANT SELECT ON TABLE public.tables TO authenticated;
