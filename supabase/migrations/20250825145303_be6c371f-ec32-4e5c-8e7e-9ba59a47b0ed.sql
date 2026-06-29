
-- 1) Helper function to safely compute allowed company ids for current user
create or replace function public.allowed_company_ids_for_current_user()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- From user's linked company (preferred)
  select u.company_id
  from public.users u
  where u.auth_user_id = auth.uid() and u.company_id is not null

  union

  -- From admin email match (fallback for company admins)
  select c.id
  from public.companies c
  where c.default_admin_email = (
    select au.email from auth.users au where au.id = auth.uid()
  );
$$;

-- Ensure authenticated can execute it
grant execute on function public.allowed_company_ids_for_current_user() to authenticated;

-- 2) Remove recursive policy on companies (if it exists)
drop policy if exists "Users can view their company" on public.companies;

-- 3) Add safe policy using the helper function
create policy "Users can view their company (safe)"
on public.companies
for select
to authenticated
using (id in (select public.allowed_company_ids_for_current_user()));

-- Optional: you can keep your super admin policy as-is.
-- Note: We did not touch other companies policies here.
