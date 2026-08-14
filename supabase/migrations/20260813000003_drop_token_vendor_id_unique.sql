-- Drop any unique constraint on vendor_accreditation_tokens.vendor_id.
-- Searches by column name so it works regardless of constraint name.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
    WHERE tc.table_schema  = 'public'
      AND tc.table_name    = 'vendor_accreditation_tokens'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name  = 'vendor_id'
  LOOP
    EXECUTE 'ALTER TABLE vendor_accreditation_tokens DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
  END LOOP;
END $$;
