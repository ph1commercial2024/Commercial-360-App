-- Run this in the Supabase SQL editor (Dashboard → SQL Editor), after cost_reports.sql
-- The approved items behind each line's Awarded amount: awarded work packages (WPP sheet) and approved PMIs/claims (PMIs sheet)

create table if not exists cost_report_items (
  id           bigserial primary key,
  report_id    bigint not null references cost_reports(id) on delete cascade,
  kind         text not null check (kind in ('award', 'vo')),
  code         text not null,
  ref          text,
  sub_ref      text,
  description  text,
  vendor       text,
  category     text,
  amount       numeric(18,2) not null default 0
);

create index if not exists cost_report_items_report_idx on cost_report_items (report_id, code);

alter table cost_report_items enable row level security;

drop policy if exists "auth read cost report items" on cost_report_items;
create policy "auth read cost report items"   on cost_report_items for select to authenticated using (true);
drop policy if exists "auth insert cost report items" on cost_report_items;
create policy "auth insert cost report items" on cost_report_items for insert to authenticated with check (true);
