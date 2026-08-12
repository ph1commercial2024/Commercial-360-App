-- Option A: Restructure vendors table so vendor_code is NOT part of the primary key.
-- This allows vendor_code to be NULL for draft/pending vendors and only written
-- to the DB when an admin accredits the vendor.
--
-- id (integer SERIAL) becomes the sole primary key.
-- vendor_code becomes a nullable unique column.
-- The trigger that auto-generated vendor_code on insert is dropped.

-- Step 1: Drop the existing primary key (vendor_code or composite including vendor_code).
--         Use a DO block so we don't need to hard-code the constraint name.
DO $$
DECLARE
  pk_name TEXT;
BEGIN
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name   = 'vendors'
    AND constraint_type = 'PRIMARY KEY';

  IF pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE vendors DROP CONSTRAINT ' || quote_ident(pk_name);
  END IF;
END $$;

-- Step 2: Make integer id the sole primary key (if id already has a PK this is a no-op guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name   = 'vendors'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'id'
  ) THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Step 3: Remove NOT NULL constraint from vendor_code (now nullable for drafts).
ALTER TABLE vendors ALTER COLUMN vendor_code DROP NOT NULL;

-- Step 4: Add a UNIQUE constraint on vendor_code (NULL values are allowed and not counted
--         as duplicates in PostgreSQL's standard UNIQUE constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'vendors'
      AND constraint_name = 'vendors_vendor_code_unique'
  ) THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_vendor_code_unique UNIQUE (vendor_code);
  END IF;
END $$;

-- Step 5: Drop any trigger that auto-generates vendor_code on insert.
DROP TRIGGER IF EXISTS set_vendor_code ON vendors;
DROP TRIGGER IF EXISTS set_vendor_code_on_insert ON vendors;
DROP TRIGGER IF EXISTS generate_vendor_code ON vendors;
DROP TRIGGER IF EXISTS vendor_code_trigger ON vendors;
DROP TRIGGER IF EXISTS trg_set_vendor_code ON vendors;

-- Step 6: Drop the associated trigger function(s).
DROP FUNCTION IF EXISTS set_vendor_code() CASCADE;
DROP FUNCTION IF EXISTS generate_vendor_code() CASCADE;
