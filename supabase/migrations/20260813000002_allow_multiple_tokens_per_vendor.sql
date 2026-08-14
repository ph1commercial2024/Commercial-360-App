-- Allow multiple accreditation tokens to point to the same vendor.
-- A vendor invited more than once should be able to use any of their
-- invite links — all tokens for the same email should link to the
-- same vendor record without a uniqueness conflict.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT constraint_name INTO con_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name   = 'vendor_accreditation_tokens'
    AND constraint_type = 'UNIQUE'
    AND constraint_name ILIKE '%vendor_id%';

  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE vendor_accreditation_tokens DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;
END $$;
