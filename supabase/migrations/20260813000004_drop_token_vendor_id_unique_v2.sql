-- Drop unique constraint on vendor_accreditation_tokens.vendor_id using pg_catalog
-- (more reliable than information_schema for finding constraints by column).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class     rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid
                          AND att.attnum = ANY(con.conkey)
    WHERE ns.nspname  = 'public'
      AND rel.relname = 'vendor_accreditation_tokens'
      AND con.contype = 'u'          -- unique constraint
      AND att.attname = 'vendor_id'
  LOOP
    EXECUTE 'ALTER TABLE vendor_accreditation_tokens DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;
