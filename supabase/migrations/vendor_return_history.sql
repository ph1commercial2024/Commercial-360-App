-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Creates the vendor_return_history table for tracking return rounds

create table if not exists vendor_return_history (
  id                serial primary key,
  vendor_id         integer not null,
  returned_by_name  text,
  returned_by_id    uuid,
  returned_at       timestamptz not null default now(),
  return_notes      text,
  resubmitted_at    timestamptz
);

create index if not exists vendor_return_history_vendor_idx
  on vendor_return_history (vendor_id);

alter table vendor_return_history enable row level security;

-- Authenticated users (admins) can read, insert, update
create policy "auth read return history"
  on vendor_return_history for select to authenticated using (true);

create policy "auth insert return history"
  on vendor_return_history for insert to authenticated with check (true);

create policy "auth update return history"
  on vendor_return_history for update to authenticated using (true);

-- Anon (vendor portal) can read and update resubmitted_at
create policy "anon read return history"
  on vendor_return_history for select to anon using (true);

create policy "anon update return history"
  on vendor_return_history for update to anon using (true) with check (true);
