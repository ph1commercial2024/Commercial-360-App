-- Make pr_number the primary key of purchase_requests,
-- replacing the integer id as the FK target in all child tables.
--
-- Child tables migrated: scope_items, rfqs, rfas, rfp_prs, rfa_documents,
--                        pr_documents
--
-- After running this migration, update app code:
--   - Replace pr.id  → pr.pr_number  everywhere it is used as an identifier
--   - Replace prId (integer) → prNumber (text) in route/state params
--   - The old integer `id` column is kept on purchase_requests as a regular
--     column (not PK) so the app continues to work until code is updated.
--     Drop it separately once all code references are removed.

BEGIN;

-- ── 0a. Pre-flight: every row must have a pr_number ───────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM purchase_requests
    WHERE pr_number IS NULL OR trim(pr_number) = ''
  ) THEN
    RAISE EXCEPTION
      'Aborting: one or more purchase_requests rows have a NULL or empty pr_number. '
      'Populate pr_number for all rows before running this migration.';
  END IF;
END $$;

-- ── 0b. Pre-flight: show any remaining unknown FKs that would block the PK drop ─
-- If the query below returns rows after this migration runs, re-add those tables
-- to the steps below and run again.
DO $$
DECLARE
  rec record;
  found_unknown boolean := false;
BEGIN
  FOR rec IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.table_constraints tc2
      ON rc.unique_constraint_name = tc2.constraint_name
    WHERE tc2.table_name = 'purchase_requests'
      AND tc.table_name NOT IN (
        'scope_items', 'rfqs', 'rfas', 'rfp_prs', 'rfa_documents', 'pr_documents'
      )
  LOOP
    RAISE WARNING 'Unknown FK found: %.% — add this table to the migration.',
      rec.table_name, rec.constraint_name;
    found_unknown := true;
  END LOOP;
  IF found_unknown THEN
    RAISE EXCEPTION 'Aborting: unknown FK dependencies found (see warnings above). '
      'Add the affected tables to this migration and re-run.';
  END IF;
END $$;

-- ── 1. Drop existing FK constraints on all child tables ───────────────────────
ALTER TABLE scope_items   DROP CONSTRAINT IF EXISTS scope_items_pr_id_fkey;
ALTER TABLE rfqs           DROP CONSTRAINT IF EXISTS rfqs_pr_id_fkey;
ALTER TABLE rfas           DROP CONSTRAINT IF EXISTS rfas_pr_id_fkey;
ALTER TABLE rfp_prs        DROP CONSTRAINT IF EXISTS rfp_prs_pr_id_fkey;
ALTER TABLE rfa_documents  DROP CONSTRAINT IF EXISTS rfa_documents_pr_id_fkey;
ALTER TABLE pr_documents   DROP CONSTRAINT IF EXISTS pr_documents_pr_id_fkey;

-- ── 2. Drop the current PK on purchase_requests.id ────────────────────────────
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_pkey;

-- ── 3. Add temporary text columns to child tables ─────────────────────────────
ALTER TABLE scope_items   ADD COLUMN pr_id_new text;
ALTER TABLE rfqs           ADD COLUMN pr_id_new text;
ALTER TABLE rfas           ADD COLUMN pr_id_new text;
ALTER TABLE rfp_prs        ADD COLUMN pr_id_new text;
ALTER TABLE rfa_documents  ADD COLUMN pr_id_new text;
ALTER TABLE pr_documents   ADD COLUMN pr_id_new text;

-- ── 4. Back-fill pr_id_new from purchase_requests.pr_number ───────────────────
UPDATE scope_items
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = scope_items.pr_id;

UPDATE rfqs
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = rfqs.pr_id;

UPDATE rfas
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = rfas.pr_id;

UPDATE rfp_prs
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = rfp_prs.pr_id;

UPDATE rfa_documents
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = rfa_documents.pr_id;

UPDATE pr_documents
  SET pr_id_new = p.pr_number
  FROM purchase_requests p WHERE p.id = pr_documents.pr_id;

-- ── 5. Drop old integer pr_id columns ────────────────────────────────────────
ALTER TABLE scope_items   DROP COLUMN pr_id;
ALTER TABLE rfqs           DROP COLUMN pr_id;
ALTER TABLE rfas           DROP COLUMN pr_id;
ALTER TABLE rfp_prs        DROP COLUMN pr_id;
ALTER TABLE rfa_documents  DROP COLUMN pr_id;
ALTER TABLE pr_documents   DROP COLUMN pr_id;

-- ── 6. Rename new columns back to pr_id ──────────────────────────────────────
ALTER TABLE scope_items   RENAME COLUMN pr_id_new TO pr_id;
ALTER TABLE rfqs           RENAME COLUMN pr_id_new TO pr_id;
ALTER TABLE rfas           RENAME COLUMN pr_id_new TO pr_id;
ALTER TABLE rfp_prs        RENAME COLUMN pr_id_new TO pr_id;
ALTER TABLE rfa_documents  RENAME COLUMN pr_id_new TO pr_id;
ALTER TABLE pr_documents   RENAME COLUMN pr_id_new TO pr_id;

-- ── 7. Re-apply NOT NULL constraints ─────────────────────────────────────────
--   rfas.pr_id stays nullable (some RFAs may not be linked to a PR)
--   pr_documents.pr_id stays nullable (unknown usage, safe default)
ALTER TABLE scope_items   ALTER COLUMN pr_id SET NOT NULL;
ALTER TABLE rfqs           ALTER COLUMN pr_id SET NOT NULL;
ALTER TABLE rfp_prs        ALTER COLUMN pr_id SET NOT NULL;
ALTER TABLE rfa_documents  ALTER COLUMN pr_id SET NOT NULL;

-- ── 8. Add primary key on purchase_requests.pr_number ────────────────────────
ALTER TABLE purchase_requests ADD PRIMARY KEY (pr_number);

-- ── 9. Re-add FK constraints pointing to purchase_requests(pr_number) ─────────
ALTER TABLE scope_items
  ADD CONSTRAINT scope_items_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE CASCADE;

ALTER TABLE rfqs
  ADD CONSTRAINT rfqs_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE RESTRICT;

ALTER TABLE rfas
  ADD CONSTRAINT rfas_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE RESTRICT;

ALTER TABLE rfp_prs
  ADD CONSTRAINT rfp_prs_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE CASCADE;

ALTER TABLE rfa_documents
  ADD CONSTRAINT rfa_documents_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE CASCADE;

ALTER TABLE pr_documents
  ADD CONSTRAINT pr_documents_pr_id_fkey
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_number) ON DELETE CASCADE;

-- ── 10. purchase_requests.id stays as a plain column (no longer PK) ───────────
-- Drop it once all app code is updated:
--
--   ALTER TABLE purchase_requests DROP COLUMN id;

COMMIT;
