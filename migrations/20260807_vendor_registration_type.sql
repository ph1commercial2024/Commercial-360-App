-- Add registration_type to vendor_company_info.
-- 'DTI' = Sole Proprietorship, 'SEC' = Corporation / Partnership.
-- Determines which government documents are required for accreditation.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS registration_type text
  CHECK (registration_type IN ('DTI', 'SEC'));
