-- Removes ALL operational data and user accounts so the system can start with real data.
-- Keeps the schema and the reference lists (departments, sources of stock, units, item categories, settings).
--
-- Run once, in the Neon console → SQL Editor, against the production database.
-- Afterwards the app shows "First-time setup" so you can create the real administrator.
-- There is no undo: take a Neon branch/backup first if you might need the demo data again.

BEGIN;

TRUNCATE audit_logs, sessions, fuel_logs, vehicle_trips, stock_transactions, demand_items, demand_sheets,
         items, vendors, vehicles, drivers
  RESTART IDENTITY;

UPDATE app_settings SET updated_by = NULL;
DELETE FROM users;
ALTER TABLE users ALTER COLUMN id RESTART WITH 1;

COMMIT;

-- Check: every count should be 0.
SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM items) AS items,
       (SELECT count(*) FROM stock_transactions) AS stock_entries, (SELECT count(*) FROM vehicle_trips) AS trips;
