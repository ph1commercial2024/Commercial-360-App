-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Buildings / areas per project (Tower 1, Parking Building, TH End, Site Development, ...) and the ones each PR covers.

-- Condominium or Housing, and its list of areas: [{ id, name, kind, units, active }]
alter table projects add column if not exists project_type text;
alter table projects add column if not exists areas        jsonb not null default '[]'::jsonb;

-- The area ids a PR covers, and who last tagged them (tagging works at any PR status)
alter table purchase_requests add column if not exists areas                jsonb not null default '[]'::jsonb;
alter table purchase_requests add column if not exists areas_tagged_by_name text;
alter table purchase_requests add column if not exists areas_tagged_at      timestamptz;
