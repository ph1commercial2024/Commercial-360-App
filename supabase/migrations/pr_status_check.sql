-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- The database's list of allowed PR statuses predates "Pending Manager Approval", so a Supervisor's
-- "Send to Manager" was rejected (purchase_requests_status_check). This replaces the list with every
-- status the app uses. NOT VALID: existing rows are left as they are; only new and changed rows are checked.

-- 1. See what is there now (optional, for the record)
select pg_get_constraintdef(oid) as current_rule from pg_constraint where conname = 'purchase_requests_status_check';
select status, count(*) from purchase_requests group by status order by status;

-- 2. Replace the rule
alter table purchase_requests drop constraint if exists purchase_requests_status_check;
alter table purchase_requests add constraint purchase_requests_status_check check (status in (
  'Draft',
  'Pending Manager Approval',
  'Pending GM Approval',
  'For Review',
  'Under Review',
  'Pending Endorsement',
  'Approved 1',
  'Approved',
  'Rejected'
)) not valid;
