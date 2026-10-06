-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- The vendor portal uses the public (anon) key, which every vendor's browser has.
-- Before this, anon could read AND change every column of purchase_requests, including budget fields.
-- After this, anon can only read the columns a vendor needs to answer an RFQ, and can't write at all.
-- The team's app logs in as "authenticated" and is not affected.

revoke all on purchase_requests from anon;

grant select (
  id, pr_number, project_id,
  description, justification, start_date, end_date,
  plans_file_url, plans_file_name,
  tor_file_url, tor_file_name,
  specs_file_url, specs_file_name,
  scope_of_works
) on purchase_requests to anon;
