-- Primary activity type(s) for vendor: Dealer, Manufacturer, Service Provider.
-- Multi-value, stored as text array.

ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS primary_activities text[] NOT NULL DEFAULT '{}';
