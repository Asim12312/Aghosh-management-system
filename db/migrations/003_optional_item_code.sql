-- Item codes are no longer entered in the app; items are identified by name.
-- The column stays (still unique when present) so existing codes are kept.
ALTER TABLE items ALTER COLUMN code DROP NOT NULL;
