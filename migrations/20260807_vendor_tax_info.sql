-- Tax information fields for vendor accreditation.
-- TIN, tax classification (VAT/Non-VAT), and EWT entries stored per vendor.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS tin               text,
  ADD COLUMN IF NOT EXISTS tax_classification text CHECK (tax_classification IN ('VAT', 'Non-VAT')),
  ADD COLUMN IF NOT EXISTS ewt_entries        jsonb NOT NULL DEFAULT '[]';
