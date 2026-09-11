-- Vendor Portal: Grant anon role access to all tables the vendor portal touches.
--
-- The vendor portal (VendorApp) runs completely unauthenticated — vendors are
-- anonymous users. The invite link contains an unguessable UUID token that acts
-- as the authentication credential at the application level.
--
-- Two-layer fix:
--   1. GRANT — role-level privilege so PostgreSQL allows the operation at all
--              (missing grant = HTTP 401 from Supabase REST API)
--   2. POLICY — RLS row-level policy so rows are visible/writable when RLS is
--               enabled on the table (missing policy = 0 rows returned or 403)
--
-- Policies use USING(true) / WITH CHECK(true) because the token UUID is the
-- access credential; row-level scoping is enforced at the app layer, not DB.
-- The only exception is vendors INSERT, which constrains to status = 'Draft'.

-- ─── ROLE-LEVEL GRANTS ────────────────────────────────────────────────────────

-- Core accreditation tables
GRANT SELECT, INSERT, UPDATE ON vendors                     TO anon;
GRANT SELECT, INSERT, UPDATE ON vendor_company_info         TO anon;
GRANT SELECT, INSERT, UPDATE ON vendor_documents            TO anon;
GRANT SELECT, INSERT, UPDATE ON vendor_doc_expiry           TO anon;
GRANT SELECT,          UPDATE ON vendor_accreditation_tokens TO anon;

-- Read-only reference tables
GRANT SELECT ON settings         TO anon;
GRANT SELECT ON trade_categories TO anon;
GRANT SELECT ON business_units   TO anon;
GRANT SELECT ON scope_items      TO anon;

-- RFQ / RFA vendor-side tables
GRANT SELECT,          UPDATE ON rfq_vendors    TO anon;
GRANT SELECT, INSERT, UPDATE ON rfq_submissions TO anon;
GRANT SELECT,          UPDATE ON rfas           TO anon;
GRANT SELECT,          UPDATE ON rfa_vendors    TO anon;

-- Sequences — needed for INSERT into tables with auto-generated integer IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────
-- DROP IF EXISTS first so this script is safe to re-run.

-- vendor_accreditation_tokens
DROP POLICY IF EXISTS vendor_portal_anon_select ON vendor_accreditation_tokens;
DROP POLICY IF EXISTS vendor_portal_anon_update ON vendor_accreditation_tokens;
CREATE POLICY vendor_portal_anon_select ON vendor_accreditation_tokens
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_update ON vendor_accreditation_tokens
  FOR UPDATE TO anon USING (true);

-- vendors
DROP POLICY IF EXISTS vendor_portal_anon_select ON vendors;
DROP POLICY IF EXISTS vendor_portal_anon_insert ON vendors;
DROP POLICY IF EXISTS vendor_portal_anon_update ON vendors;
CREATE POLICY vendor_portal_anon_select ON vendors
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_insert ON vendors
  FOR INSERT TO anon WITH CHECK (accreditation_status = 'Draft');
CREATE POLICY vendor_portal_anon_update ON vendors
  FOR UPDATE TO anon USING (true);

-- vendor_company_info
DROP POLICY IF EXISTS vendor_portal_anon_select ON vendor_company_info;
DROP POLICY IF EXISTS vendor_portal_anon_insert ON vendor_company_info;
DROP POLICY IF EXISTS vendor_portal_anon_update ON vendor_company_info;
CREATE POLICY vendor_portal_anon_select ON vendor_company_info
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_insert ON vendor_company_info
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vendor_portal_anon_update ON vendor_company_info
  FOR UPDATE TO anon USING (true);

-- vendor_documents
DROP POLICY IF EXISTS vendor_portal_anon_select ON vendor_documents;
DROP POLICY IF EXISTS vendor_portal_anon_insert ON vendor_documents;
DROP POLICY IF EXISTS vendor_portal_anon_update ON vendor_documents;
CREATE POLICY vendor_portal_anon_select ON vendor_documents
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_insert ON vendor_documents
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vendor_portal_anon_update ON vendor_documents
  FOR UPDATE TO anon USING (true);

-- vendor_doc_expiry
DROP POLICY IF EXISTS vendor_portal_anon_select ON vendor_doc_expiry;
DROP POLICY IF EXISTS vendor_portal_anon_insert ON vendor_doc_expiry;
DROP POLICY IF EXISTS vendor_portal_anon_update ON vendor_doc_expiry;
CREATE POLICY vendor_portal_anon_select ON vendor_doc_expiry
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_insert ON vendor_doc_expiry
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vendor_portal_anon_update ON vendor_doc_expiry
  FOR UPDATE TO anon USING (true);

-- settings (read-only for anon)
DROP POLICY IF EXISTS vendor_portal_anon_select ON settings;
CREATE POLICY vendor_portal_anon_select ON settings
  FOR SELECT TO anon USING (true);

-- trade_categories (read-only for anon)
DROP POLICY IF EXISTS vendor_portal_anon_select ON trade_categories;
CREATE POLICY vendor_portal_anon_select ON trade_categories
  FOR SELECT TO anon USING (true);

-- business_units (read-only for anon)
DROP POLICY IF EXISTS vendor_portal_anon_select ON business_units;
CREATE POLICY vendor_portal_anon_select ON business_units
  FOR SELECT TO anon USING (true);

-- scope_items (read-only for anon — used in RFQ response view)
DROP POLICY IF EXISTS vendor_portal_anon_select ON scope_items;
CREATE POLICY vendor_portal_anon_select ON scope_items
  FOR SELECT TO anon USING (true);

-- rfq_vendors
DROP POLICY IF EXISTS vendor_portal_anon_select ON rfq_vendors;
DROP POLICY IF EXISTS vendor_portal_anon_update ON rfq_vendors;
CREATE POLICY vendor_portal_anon_select ON rfq_vendors
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_update ON rfq_vendors
  FOR UPDATE TO anon USING (true);

-- rfq_submissions
DROP POLICY IF EXISTS vendor_portal_anon_select ON rfq_submissions;
DROP POLICY IF EXISTS vendor_portal_anon_insert ON rfq_submissions;
DROP POLICY IF EXISTS vendor_portal_anon_update ON rfq_submissions;
CREATE POLICY vendor_portal_anon_select ON rfq_submissions
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_insert ON rfq_submissions
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vendor_portal_anon_update ON rfq_submissions
  FOR UPDATE TO anon USING (true);

-- rfas
DROP POLICY IF EXISTS vendor_portal_anon_select ON rfas;
DROP POLICY IF EXISTS vendor_portal_anon_update ON rfas;
CREATE POLICY vendor_portal_anon_select ON rfas
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_update ON rfas
  FOR UPDATE TO anon USING (true);

-- rfa_vendors
DROP POLICY IF EXISTS vendor_portal_anon_select ON rfa_vendors;
DROP POLICY IF EXISTS vendor_portal_anon_update ON rfa_vendors;
CREATE POLICY vendor_portal_anon_select ON rfa_vendors
  FOR SELECT TO anon USING (true);
CREATE POLICY vendor_portal_anon_update ON rfa_vendors
  FOR UPDATE TO anon USING (true);
