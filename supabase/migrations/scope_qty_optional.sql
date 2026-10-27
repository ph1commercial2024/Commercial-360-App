-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- PR scope lines may leave the quantity blank (vendors measure it from the plans); the unit is still required in the app.
alter table scope_items alter column quantity drop not null;
