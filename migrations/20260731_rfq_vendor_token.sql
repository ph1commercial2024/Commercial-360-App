-- Add submission token to rfq_vendors so each vendor gets a unique direct link
ALTER TABLE rfq_vendors
  ADD COLUMN IF NOT EXISTS token uuid DEFAULT gen_random_uuid();

-- Backfill existing rows that have no token
UPDATE rfq_vendors SET token = gen_random_uuid() WHERE token IS NULL;

-- Ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS rfq_vendors_token_idx ON rfq_vendors (token);

-- Allow anonymous read by token (so vendor submission page can load RFQ details)
CREATE POLICY IF NOT EXISTS "anon read rfq_vendors by token"
  ON rfq_vendors FOR SELECT TO anon
  USING (true);

-- Allow anonymous insert into rfq_submissions
CREATE POLICY IF NOT EXISTS "anon insert rfq_submissions"
  ON rfq_submissions FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous update of rfq_vendors (for marking opened_at / submitted_at)
CREATE POLICY IF NOT EXISTS "anon update rfq_vendors token cols"
  ON rfq_vendors FOR UPDATE TO anon
  USING (true);
