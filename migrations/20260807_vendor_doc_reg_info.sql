-- Add registration number and registration date to per-document tracking.
-- Vendors enter these when uploading each government document.

ALTER TABLE vendor_doc_expiry
  ADD COLUMN IF NOT EXISTS reg_number text,
  ADD COLUMN IF NOT EXISTS reg_date   date;
