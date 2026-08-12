-- Trade categories master list.
-- Vendors pick from approved rows; custom vendor entries land here with is_approved=false
-- until admin approves them.

CREATE TABLE IF NOT EXISTS trade_categories (
  id                    serial PRIMARY KEY,
  name                  text NOT NULL,
  is_approved           boolean NOT NULL DEFAULT false,
  suggested_by_vendor_id text REFERENCES vendors(vendor_code) ON DELETE SET NULL,
  display_order         int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Vendor company info now stores selected trades as an array
ALTER TABLE vendor_company_info
  ADD COLUMN IF NOT EXISTS trade_categories text[] NOT NULL DEFAULT '{}';

-- ── Seed: pre-approved trade categories ───────────────────────────────────────
INSERT INTO trade_categories (name, is_approved, display_order) VALUES
  ('General Construction',              true,  1),
  ('Civil Works',                       true,  2),
  ('Architectural Works',               true,  3),
  ('Structural Works / Steel Fabrication', true, 4),
  ('Electrical Works',                  true,  5),
  ('Mechanical Works',                  true,  6),
  ('Plumbing & Sanitary Works',         true,  7),
  ('HVAC / Air Conditioning',           true,  8),
  ('Fire Protection & Detection',       true,  9),
  ('Elevator & Escalator Works',        true, 10),
  ('Landscaping & Site Development',    true, 11),
  ('Interior Works & Fit-out',          true, 12),
  ('Painting & Waterproofing',          true, 13),
  ('Tiling & Flooring',                 true, 14),
  ('Glazing, Aluminum & Curtain Wall',  true, 15),
  ('Earthworks & Excavation',           true, 16),
  ('Piling & Foundation Works',         true, 17),
  ('Roofing Works',                     true, 18),
  ('Carpentry & Joinery',               true, 19),
  ('Signage & Graphics',                true, 20),
  ('IT, Data & Communications',         true, 21),
  ('CCTV & Security Systems',           true, 22),
  ('Building Management Systems',       true, 23),
  ('Swimming Pool & Water Features',    true, 24),
  ('Geotechnical Services',             true, 25),
  ('Traffic Management',                true, 26),
  ('Equipment Rental & Hauling',        true, 27),
  ('Testing & Commissioning',           true, 28),
  ('Environmental Services',            true, 29),
  ('Supply of Construction Materials',  true, 30)
ON CONFLICT DO NOTHING;
