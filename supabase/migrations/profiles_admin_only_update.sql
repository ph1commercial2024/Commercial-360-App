-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Before: any logged-in user could update any profile, including is_admin, position and is_active,
-- so a staff member could make themselves an administrator or change their approval role.
-- After: only an active administrator can update profiles. Reading profiles is unchanged.

-- Checks the caller's own profile without re-applying the profiles policies (avoids recursion)
create or replace function public.current_user_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and coalesce(is_active, true) from profiles where id = auth.uid()), false)
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "Authenticated users can update profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;
create policy "Admins can update profiles" on profiles for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
