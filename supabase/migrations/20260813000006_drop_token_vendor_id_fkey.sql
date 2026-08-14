-- Drop the foreign key constraint on vendor_accreditation_tokens.vendor_id.
-- This column stores the vendor_code TEXT for application-level lookup only;
-- it does not need referential enforcement. With Option B, vendor_code is NULL
-- in the vendors table until accreditation, so the FK would always fail for
-- new draft vendors.

ALTER TABLE vendor_accreditation_tokens
  DROP CONSTRAINT IF EXISTS vendor_accreditation_tokens_vendor_id_fkey;
