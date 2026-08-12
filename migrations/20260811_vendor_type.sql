-- Vendor type selected by the vendor at the start of their accreditation form.
-- Used to apply per-type field requirements configured by admins.
-- Values: 'Contractor', 'Supplier / Dealer', 'Service Provider', 'Equipment Rental'
-- (or any type name defined in the accreditation_field_requirements settings key).

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS vendor_type text;
