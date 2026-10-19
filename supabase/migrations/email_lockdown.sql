-- Run this in the Supabase SQL editor (Dashboard → SQL Editor). Safe to run more than once.
-- Supports the vendor confirmation email being sent by the server (send-vendor-copy), once per submission.

alter table vendor_submissions add column if not exists email_sent_at timestamptz;

-- The vendor portal may only record the submission itself; whether and where it was emailed is set by the server
revoke insert on vendor_submissions from anon;
grant insert (vendor_id, kind, submitted_at, snapshot, pdf_path) on vendor_submissions to anon;
