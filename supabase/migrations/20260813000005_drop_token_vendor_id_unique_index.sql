-- Drop any unique index on vendor_accreditation_tokens.vendor_id
-- (covers standalone CREATE UNIQUE INDEX, not just UNIQUE constraints).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_index     ix
    JOIN pg_class     t  ON t.oid  = ix.indrelid
    JOIN pg_class     i  ON i.oid  = ix.indexrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_attribute a  ON a.attrelid = t.oid
                        AND a.attnum = ANY(ix.indkey)
    WHERE ns.nspname = 'public'
      AND t.relname  = 'vendor_accreditation_tokens'
      AND ix.indisunique = true
      AND ix.indisprimary = false   -- leave the PK alone
      AND a.attname  = 'vendor_id'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.index_name);
  END LOOP;
END $$;
