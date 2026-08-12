-- JSONB list columns and satellite map URL used by the vendor accreditation form
-- but not yet present in vendor_company_info.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS satellite_map_url  text,
  ADD COLUMN IF NOT EXISTS client_list        jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS equipment_list     jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stockholder_list   jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS primary_activities jsonb NOT NULL DEFAULT '[]';
