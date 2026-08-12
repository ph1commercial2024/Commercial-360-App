-- Add VAT status and BIR certificate fields to rfq_submissions
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS vat_status text DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS bir_doc_url text,
  ADD COLUMN IF NOT EXISTS bir_doc_name text;
