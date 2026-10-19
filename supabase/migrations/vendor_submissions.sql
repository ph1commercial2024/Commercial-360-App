-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- The official record of each accreditation submission: a frozen snapshot of what the vendor declared,
-- and the PDF they were emailed. Stored privately: vendors can add, only the logged-in team can read.

-- 1. Private storage for the PDFs (not reachable by public link)
insert into storage.buckets (id, name, public)
values ('vendor-submissions', 'vendor-submissions', false)
on conflict (id) do update set public = false;

drop policy if exists "vendor portal uploads submission pdf" on storage.objects;
create policy "vendor portal uploads submission pdf" on storage.objects
  for insert to anon with check (bucket_id = 'vendor-submissions');

drop policy if exists "team reads submission pdf" on storage.objects;
create policy "team reads submission pdf" on storage.objects
  for select to authenticated using (bucket_id = 'vendor-submissions');

-- 2. One row per submission
create table if not exists vendor_submissions (
  id            bigserial primary key,
  vendor_id     text not null,
  kind          text not null default 'submission',   -- 'submission' or 'profile_update'
  submitted_at  timestamptz not null default now(),
  snapshot      jsonb not null,
  pdf_path      text,
  emailed_to    text,
  email_error   text
);

create index if not exists vendor_submissions_vendor_idx on vendor_submissions (vendor_id, submitted_at desc);

alter table vendor_submissions enable row level security;

grant insert on vendor_submissions to anon;
grant usage, select on sequence vendor_submissions_id_seq to anon;

drop policy if exists "anon insert submissions" on vendor_submissions;
create policy "anon insert submissions" on vendor_submissions for insert to anon with check (true);

drop policy if exists "auth read submissions" on vendor_submissions;
create policy "auth read submissions" on vendor_submissions for select to authenticated using (true);
