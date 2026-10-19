-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Every file a vendor's upload failed on, with the exact error, so the team can see it.
-- The vendor portal can only add rows; only the logged-in team can read them.

create table if not exists vendor_upload_failures (
  id          bigserial primary key,
  vendor_id   text not null,
  doc_type    text,
  file_name   text,
  file_size   bigint,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists vendor_upload_failures_vendor_idx on vendor_upload_failures (vendor_id, created_at desc);

alter table vendor_upload_failures enable row level security;

grant insert on vendor_upload_failures to anon;
grant usage, select on sequence vendor_upload_failures_id_seq to anon;

drop policy if exists "anon insert upload failures" on vendor_upload_failures;
create policy "anon insert upload failures" on vendor_upload_failures for insert to anon with check (true);

drop policy if exists "auth read upload failures" on vendor_upload_failures;
create policy "auth read upload failures" on vendor_upload_failures for select to authenticated using (true);
