-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Creates the pr_return_history table: one row per PR rejection, stamped when resubmitted

create table if not exists pr_return_history (
  id                   serial primary key,
  pr_number            text not null,
  returned_by_name     text,
  returned_by_id       uuid,
  returned_at          timestamptz not null default now(),
  return_notes         text,
  resubmitted_at       timestamptz,
  resubmitted_by_name  text
);

create index if not exists pr_return_history_pr_idx
  on pr_return_history (pr_number);

alter table pr_return_history enable row level security;

create policy "auth read pr return history"
  on pr_return_history for select to authenticated using (true);

create policy "auth insert pr return history"
  on pr_return_history for insert to authenticated with check (true);

create policy "auth update pr return history"
  on pr_return_history for update to authenticated using (true);
