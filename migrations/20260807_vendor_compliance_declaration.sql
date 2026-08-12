-- Compliance and declaration fields for vendor accreditation.
-- Tracks H&S, QMS, environmental management, ownership structure,
-- and typed signatories for the declaration section.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS num_employees           int,
  ADD COLUMN IF NOT EXISTS is_subsidiary           boolean,
  ADD COLUMN IF NOT EXISTS parent_company_name     text,
  ADD COLUMN IF NOT EXISTS parent_company_country  text,
  ADD COLUMN IF NOT EXISTS has_hs_adviser          boolean,
  ADD COLUMN IF NOT EXISTS hs_adviser_details      text,
  ADD COLUMN IF NOT EXISTS has_hs_policy           boolean,
  ADD COLUMN IF NOT EXISTS has_qms                 boolean,
  ADD COLUMN IF NOT EXISTS has_internal_qms        boolean,
  ADD COLUMN IF NOT EXISTS has_env_management      boolean,
  ADD COLUMN IF NOT EXISTS signatory_sales_manager text,
  ADD COLUMN IF NOT EXISTS signatory_president     text;
