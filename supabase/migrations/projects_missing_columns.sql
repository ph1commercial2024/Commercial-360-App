-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- Adds every projects column the app reads or writes; existing columns are left unchanged.

alter table projects add column if not exists short_name     text;
alter table projects add column if not exists project_code   text;
alter table projects add column if not exists business_unit  text;
alter table projects add column if not exists description    text;
alter table projects add column if not exists address        text;
alter table projects add column if not exists start_date     date;
alter table projects add column if not exists end_date       date;
alter table projects add column if not exists status         text default 'active';
alter table projects add column if not exists pr_reviewer_id uuid;
