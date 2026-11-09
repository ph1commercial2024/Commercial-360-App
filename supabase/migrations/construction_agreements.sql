-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Construction Agreement generator: saved agreements (the form values; the Word file is made from them
-- in the browser), and an office address on business units (the CLIENT's address in the agreement).
-- Only the Commercial Manager, the D&C Head (and admins) can see, create, change or delete agreements.

begin;

alter table business_units add column if not exists address text;

create or replace function public.current_user_can_agreements() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (coalesce(is_admin, false) or position in ('Commercial Manager', 'D&C Head')) and coalesce(is_active, true)
    from profiles where id = auth.uid()
  ), false)
$$;
revoke all on function public.current_user_can_agreements() from public;
grant execute on function public.current_user_can_agreements() to authenticated;

create table if not exists construction_agreements (
  id               bigint generated always as identity primary key,
  project_id       bigint,
  vendor_id        bigint,
  project_name     text,
  contractor_name  text,
  contract_price   numeric(16,2),
  data             jsonb not null default '{}'::jsonb,   -- every form field, so it can be reopened and edited
  created_by       uuid references profiles(id),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- "Created by" is always the signed-in user, whatever the browser sends
alter table construction_agreements alter column created_by set default auth.uid();
create or replace function public.construction_agreements_set_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;
drop trigger if exists construction_agreements_set_creator on construction_agreements;
create trigger construction_agreements_set_creator before insert on construction_agreements
  for each row execute function public.construction_agreements_set_creator();

alter table construction_agreements enable row level security;
revoke all on construction_agreements from anon;

drop policy if exists "agreements read" on construction_agreements;
create policy "agreements read" on construction_agreements for select to authenticated using (public.current_user_can_agreements());
drop policy if exists "agreements insert" on construction_agreements;
create policy "agreements insert" on construction_agreements for insert to authenticated with check (public.current_user_can_agreements());
drop policy if exists "agreements update" on construction_agreements;
create policy "agreements update" on construction_agreements for update to authenticated using (public.current_user_can_agreements()) with check (public.current_user_can_agreements());
drop policy if exists "agreements delete" on construction_agreements;
create policy "agreements delete" on construction_agreements for delete to authenticated using (public.current_user_can_agreements());

commit;
