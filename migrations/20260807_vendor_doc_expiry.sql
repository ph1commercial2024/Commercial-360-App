-- Per-document expiry tracking for vendor accreditation docs.
-- AI reads the date on upload; vendor can request a correction; admin approves/rejects.

CREATE TABLE IF NOT EXISTS vendor_doc_expiry (
  id                serial PRIMARY KEY,
  vendor_id         int NOT NULL,
  doc_type          text NOT NULL,
  expiry_date       date,                        -- active date (AI-read or admin-approved)
  source            text NOT NULL DEFAULT 'ai'   -- 'ai' | 'manual' | 'admin'
                    CHECK (source IN ('ai', 'manual', 'admin')),
  ai_read_date      date,                        -- original AI result, kept for reference
  correction_date   date,                        -- vendor's proposed correction
  correction_status text                         -- 'pending' | 'approved' | 'rejected' | null
                    CHECK (correction_status IN ('pending', 'approved', 'rejected')),
  correction_note   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, doc_type)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS vendor_doc_expiry_updated_at ON vendor_doc_expiry;
CREATE TRIGGER vendor_doc_expiry_updated_at
  BEFORE UPDATE ON vendor_doc_expiry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE vendor_doc_expiry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON vendor_doc_expiry FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON vendor_doc_expiry FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON vendor_doc_expiry FOR UPDATE USING (true);
CREATE POLICY "auth_all"    ON vendor_doc_expiry FOR ALL TO authenticated USING (true);
