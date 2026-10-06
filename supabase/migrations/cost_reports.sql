-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Cost reports per project (each upload is a dated version) and the budget lines a PR is tagged with.

create table if not exists cost_reports (
  id                bigserial primary key,
  project_id        integer not null,
  report_date       date not null,
  file_name         text,
  project_text      text,
  uploaded_by       uuid,
  uploaded_by_name  text,
  created_at        timestamptz not null default now()
);

create index if not exists cost_reports_project_idx on cost_reports (project_id, report_date desc, created_at desc);

create table if not exists cost_report_lines (
  id               bigserial primary key,
  report_id        bigint not null references cost_reports(id) on delete cascade,
  sort_order       integer not null,
  group_name       text,
  code             text not null,
  items            text,
  name             text,
  qty              numeric,
  unit             text,
  approved_budget  numeric(18,2) not null default 0,
  awarded          numeric(18,2) not null default 0,
  wp_for_approval  numeric(18,2) not null default 0,
  anticipated      numeric(18,2) not null default 0,
  vo_approved      numeric(18,2) not null default 0,
  vo_for_approval  numeric(18,2) not null default 0,
  vo_waiting       numeric(18,2) not null default 0,
  vo_ongoing       numeric(18,2) not null default 0,
  vo_anticipated   numeric(18,2) not null default 0,
  projected_cost   numeric(18,2) not null default 0,
  money_left       numeric(18,2) not null default 0,
  parent_code      text,
  is_parent        boolean not null default false,
  is_contingency   boolean not null default false
);

create index if not exists cost_report_lines_report_idx on cost_report_lines (report_id, sort_order);

alter table cost_reports      enable row level security;
alter table cost_report_lines enable row level security;

drop policy if exists "auth read cost reports" on cost_reports;
create policy "auth read cost reports"   on cost_reports for select to authenticated using (true);
drop policy if exists "auth insert cost reports" on cost_reports;
create policy "auth insert cost reports" on cost_reports for insert to authenticated with check (true);
drop policy if exists "auth delete cost reports" on cost_reports;
create policy "auth delete cost reports" on cost_reports for delete to authenticated using (true);

drop policy if exists "auth read cost report lines" on cost_report_lines;
create policy "auth read cost report lines"   on cost_report_lines for select to authenticated using (true);
drop policy if exists "auth insert cost report lines" on cost_report_lines;
create policy "auth insert cost report lines" on cost_report_lines for insert to authenticated with check (true);

-- The budget lines a PR was tagged with, with the money left at the time (snapshot), and which report it came from
alter table purchase_requests add column if not exists budget_lines   jsonb;
alter table purchase_requests add column if not exists cost_report_id bigint;
