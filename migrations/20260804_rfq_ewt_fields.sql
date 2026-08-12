-- Add EWT fields to rfq_submissions
-- atc_code stores predefined codes (e.g. "WC010") or custom as "custom|CODE|RATE_PCT"
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS atc_code text,
  ADD COLUMN IF NOT EXISTS ewt_proof_url text,
  ADD COLUMN IF NOT EXISTS ewt_proof_name text;
