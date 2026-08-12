-- Migrate all vendor child-table FKs from integer id to text vendor_code.
-- Run in Supabase SQL editor. vendor_code must already exist on vendors table.

BEGIN;

-- ── 1. Drop existing FK constraints ──────────────────────────────────────────
ALTER TABLE vendor_company_info         DROP CONSTRAINT IF EXISTS vendor_company_info_vendor_id_fkey;
ALTER TABLE vendor_owners               DROP CONSTRAINT IF EXISTS vendor_owners_vendor_id_fkey;
ALTER TABLE vendor_projects             DROP CONSTRAINT IF EXISTS vendor_projects_vendor_id_fkey;
ALTER TABLE vendor_clients              DROP CONSTRAINT IF EXISTS vendor_clients_vendor_id_fkey;
ALTER TABLE vendor_contacts             DROP CONSTRAINT IF EXISTS vendor_contacts_vendor_id_fkey;
ALTER TABLE vendor_affiliates           DROP CONSTRAINT IF EXISTS vendor_affiliates_vendor_id_fkey;
ALTER TABLE vendor_hseq                 DROP CONSTRAINT IF EXISTS vendor_hseq_vendor_id_fkey;
ALTER TABLE vendor_registration         DROP CONSTRAINT IF EXISTS vendor_registration_vendor_id_fkey;
ALTER TABLE vendor_documents            DROP CONSTRAINT IF EXISTS vendor_documents_vendor_id_fkey;
ALTER TABLE vendor_accreditation_tokens DROP CONSTRAINT IF EXISTS vendor_accreditation_tokens_vendor_id_fkey;

-- ── 2. Convert vendor_id from integer to text (VEN-000001 format) ─────────────
ALTER TABLE vendor_company_info
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_owners
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_projects
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_clients
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_contacts
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_affiliates
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_hseq
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_registration
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

ALTER TABLE vendor_documents
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

-- vendor_accreditation_tokens.vendor_id is nullable (null until vendor registers)
ALTER TABLE vendor_accreditation_tokens
  ALTER COLUMN vendor_id TYPE text
  USING CASE WHEN vendor_id IS NOT NULL THEN 'VEN-' || lpad(vendor_id::text, 6, '0') ELSE NULL END;

-- ── 3. Re-add FK constraints referencing vendors(vendor_code) ─────────────────
ALTER TABLE vendor_company_info
  ADD CONSTRAINT vendor_company_info_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_owners
  ADD CONSTRAINT vendor_owners_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_projects
  ADD CONSTRAINT vendor_projects_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_clients
  ADD CONSTRAINT vendor_clients_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_contacts
  ADD CONSTRAINT vendor_contacts_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_affiliates
  ADD CONSTRAINT vendor_affiliates_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_hseq
  ADD CONSTRAINT vendor_hseq_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_registration
  ADD CONSTRAINT vendor_registration_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_documents
  ADD CONSTRAINT vendor_documents_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

ALTER TABLE vendor_accreditation_tokens
  ADD CONSTRAINT vendor_accreditation_tokens_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE SET NULL;

COMMIT;
