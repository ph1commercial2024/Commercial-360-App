-- Drop all foreign key constraints that reference vendors.vendor_code.
-- With Option B, vendor_code is NULL until accreditation, so any child table
-- that has a FK to vendors.vendor_code will fail on insert/update for drafts.
-- These are all application-level references and don't need DB enforcement.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage kcu_foreign
      ON kcu_foreign.constraint_name = rc.unique_constraint_name
      AND kcu_foreign.table_name = 'vendors'
      AND kcu_foreign.column_name = 'vendor_code'
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      r.table_name, r.constraint_name
    );
    RAISE NOTICE 'Dropped FK % on table %', r.constraint_name, r.table_name;
  END LOOP;
END $$;
