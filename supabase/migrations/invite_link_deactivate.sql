-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Accreditation links no longer expire by age. Instead, staff can deactivate a link (and reactivate it).
-- A deactivated link is hidden from the vendor portal, so it simply stops working.

alter table vendor_accreditation_tokens add column if not exists deactivated_at      timestamptz;
alter table vendor_accreditation_tokens add column if not exists deactivated_by_name text;

-- The vendor portal (public key) can only see and update links that are still active.
-- It can never reactivate a link or deactivate one itself.
drop policy if exists "vendor_portal_anon_select" on vendor_accreditation_tokens;
create policy "vendor_portal_anon_select" on vendor_accreditation_tokens for select to anon
  using (deactivated_at is null);

drop policy if exists "vendor_portal_anon_update" on vendor_accreditation_tokens;
create policy "vendor_portal_anon_update" on vendor_accreditation_tokens for update to anon
  using (deactivated_at is null) with check (deactivated_at is null);
