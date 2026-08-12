-- Additional vendor_company_info columns used by the accreditation form
-- but not yet added to the DB.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS location_map_url       text,
  ADD COLUMN IF NOT EXISTS key_contacts           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS declaration_confirmed_at timestamptz;
