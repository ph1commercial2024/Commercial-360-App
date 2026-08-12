-- vendor_doc_expiry was created with vendor_id INT, but all other vendor
-- child-tables use text vendor_code (VEN-xxxxxx format).
-- This migration brings it in line so the app code (which passes VEN-xxxxxx)
-- can query and upsert without 400 errors.

BEGIN;

-- 1. Drop the unique constraint that includes vendor_id (required before type change)
ALTER TABLE vendor_doc_expiry
  DROP CONSTRAINT IF EXISTS vendor_doc_expiry_vendor_id_doc_type_key;

-- 2. Convert vendor_id: int → text  (any existing integer rows become VEN-000026 etc.)
ALTER TABLE vendor_doc_expiry
  ALTER COLUMN vendor_id TYPE text
  USING 'VEN-' || lpad(vendor_id::text, 6, '0');

-- 3. Restore the unique constraint
ALTER TABLE vendor_doc_expiry
  ADD CONSTRAINT vendor_doc_expiry_vendor_id_doc_type_key
  UNIQUE (vendor_id, doc_type);

-- 4. Add FK to vendors(vendor_code) so referential integrity is maintained
ALTER TABLE vendor_doc_expiry
  DROP CONSTRAINT IF EXISTS vendor_doc_expiry_vendor_id_fkey;
ALTER TABLE vendor_doc_expiry
  ADD CONSTRAINT vendor_doc_expiry_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_code) ON DELETE CASCADE;

COMMIT;
