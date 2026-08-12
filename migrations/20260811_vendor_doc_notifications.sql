-- Tracks which expiry notification emails have been sent per vendor/doc/trigger cycle.
-- trigger_day: days relative to expiry date (40=40 days before, 30=30 days before,
--              7=7 days before, 0=on expiry, -7=7 days after, -30=30 days after)
-- expiry_date_ref: the expiry date that started this notification cycle.
--   When vendor resubmits with a new expiry date, new rows will use the new date,
--   so the sequence starts fresh.

CREATE TABLE IF NOT EXISTS vendor_doc_notifications (
  id               BIGSERIAL PRIMARY KEY,
  vendor_id        TEXT        NOT NULL,
  doc_type         TEXT        NOT NULL,
  trigger_day      INTEGER     NOT NULL,
  expiry_date_ref  DATE        NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_to         TEXT        NOT NULL,
  UNIQUE (vendor_id, doc_type, trigger_day, expiry_date_ref)
);

CREATE INDEX IF NOT EXISTS vendor_doc_notifications_vendor_idx
  ON vendor_doc_notifications (vendor_id, doc_type);
