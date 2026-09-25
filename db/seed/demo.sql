-- Demo data for testing. Loaded only when SEED_DEMO_DATA=true and the database has no users.
-- All dates are relative to current_date, so alerts and due demands always look "live".
-- Users are inserted beforehand by lib/db/seed-demo.ts (passwords must be hashed in Node).

-- ───────────── Vendors, vehicles, drivers ─────────────
INSERT INTO vendors (name, contact_person, phone, address) VALUES
  ('Al-Madina Traders',      'Haji Rafiq',  '0300-1234567', 'Main Bazar, Sheikhupura'),
  ('Sheikhupura Dairy Farm', 'Imran Ali',   '0321-7654321', 'Lahore Road, Sheikhupura'),
  ('City Stationers',        'Bilal Ahmed', '0333-1112233', 'Civil Lines, Sheikhupura');

INSERT INTO vehicles (registration_no, make_model, vehicle_type, fuel_type, seating_capacity, opening_odometer_km) VALUES
  ('LEB-1234', 'Toyota Hiace',  'Van',  'diesel', 14, 45210),
  ('LEA-5678', 'Suzuki Bolan',  'Van',  'petrol', 8,  88030);

INSERT INTO drivers (full_name, phone, cnic, license_no, license_expiry) VALUES
  ('Muhammad Akram', '0301-5556667', '35401-1234567-1', 'LHR-123456', current_date + 400),
  ('Zafar Iqbal',    '0302-4445556', '35401-7654321-3', 'LHR-654321', current_date + 45);

-- ───────────── Items ─────────────
INSERT INTO items (code, name_en, name_ur, category_id, unit_id, default_vendor_id, min_stock_level, reorder_qty, lead_time_days, is_perishable)
SELECT v.code, v.en, v.ur, c.id, u.id, vd.id, v.min_level, v.reorder, v.lead, v.perishable
  FROM (VALUES
    ('GRC-001', 'Rice',          'چاول',       'Grocery / Ration',     'KG',     'Al-Madina Traders',      50,  200, 3, false),
    ('GRC-002', 'Flour (Atta)',  'آٹا',        'Grocery / Ration',     'KG',     'Al-Madina Traders',      80,  300, 2, false),
    ('GRC-003', 'Cooking Oil',   'خوردنی تیل', 'Grocery / Ration',     'LITRE',  'Al-Madina Traders',      20,  60,  3, false),
    ('GRC-004', 'Sugar',         'چینی',       'Grocery / Ration',     'KG',     'Al-Madina Traders',      25,  100, 3, false),
    ('GRC-005', 'Lentils (Daal)','دال',        'Grocery / Ration',     'KG',     'Al-Madina Traders',      20,  60,  3, false),
    ('DRY-001', 'Milk',          'دودھ',       'Dairy & Fresh',        'LITRE',  'Sheikhupura Dairy Farm', 30,  NULL, 1, true),
    ('DRY-002', 'Eggs',          'انڈے',       'Dairy & Fresh',        'DOZEN',  'Sheikhupura Dairy Farm', 10,  30,  1, true),
    ('HYG-001', 'Soap',          'صابن',       'Toiletries & Hygiene', 'PCS',    NULL,                     40,  150, 5, false),
    ('HYG-002', 'Toothpaste',    'ٹوتھ پیسٹ',  'Toiletries & Hygiene', 'PCS',    NULL,                     20,  80,  5, false),
    ('STN-001', 'Notebooks',     'کاپیاں',     'Stationery',           'PCS',    'City Stationers',        100, 300, 7, false),
    ('STN-002', 'Pencils',       'پنسلیں',     'Stationery',           'BOX',    'City Stationers',        10,  30,  7, false),
    ('CLN-001', 'Detergent',     'سرف',        'Cleaning Supplies',    'KG',     NULL,                     15,  50,  4, false)
  ) AS v(code, en, ur, cat, unit, vendor, min_level, reorder, lead, perishable)
  JOIN item_categories c ON c.name_en = v.cat
  JOIN units u ON u.code = v.unit
  LEFT JOIN vendors vd ON vd.name = v.vendor;

-- ───────────── Stock received ─────────────
INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, fund_source_id, vendor_id, unit_cost, reference_no, donor_name, created_by)
SELECT 'IN', i.id, current_date - v.days_ago, v.qty, fs.id, CASE WHEN v.donor IS NULL THEN i.default_vendor_id END,
       v.cost, v.ref, v.donor, (SELECT id FROM users WHERE username = 'admin')
  FROM (VALUES
    ('GRC-001', 30, 300, 'ALKHIDMAT_GRANT',  280,  'GRN-1001', NULL),
    ('GRC-002', 30, 400, 'ALKHIDMAT_GRANT',  120,  'GRN-1002', NULL),
    ('GRC-002', 10, 150, 'GENERAL_DONATION', NULL, NULL,       'Chaudhry Aslam'),
    ('GRC-003', 30, 50,  'ALKHIDMAT_GRANT',  560,  'GRN-1003', NULL),
    ('GRC-004', 30, 80,  'ZAKAT',            150,  'GRN-1004', NULL),
    ('GRC-005', 30, 60,  'ALKHIDMAT_GRANT',  320,  'GRN-1005', NULL),
    ('GRC-005', 12, 30,  'SADQAH',           NULL, NULL,       'Anonymous donor'),
    ('DRY-001', 30, 20,  'GENERAL_DONATION', 200,  NULL,       NULL),
    ('DRY-002', 30, 60,  'GENERAL_DONATION', 330,  'INV-2201', NULL),
    ('DRY-002', 14, 30,  'GENERAL_DONATION', 330,  'INV-2215', NULL),
    ('HYG-001', 30, 200, 'IN_KIND',          NULL, NULL,       'Ittefaq Traders'),
    ('HYG-002', 30, 100, 'ALKHIDMAT_GRANT',  95,   'GRN-1006', NULL),
    ('STN-001', 30, 500, 'GENERAL_DONATION', NULL, NULL,       'Mr. Tariq Mehmood'),
    ('STN-002', 30, 40,  'ALKHIDMAT_GRANT',  250,  'GRN-1007', NULL),
    ('CLN-001', 30, 60,  'ALKHIDMAT_GRANT',  340,  'GRN-1008', NULL)
  ) AS v(code, days_ago, qty, src, cost, ref, donor)
  JOIN items i ON i.code = v.code
  JOIN fund_sources fs ON fs.code = v.src;

-- Fresh milk arrives every day.
INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, fund_source_id, vendor_id, unit_cost, created_by)
SELECT 'IN', i.id, current_date - g.d, 12, fs.id, i.default_vendor_id, 200, (SELECT id FROM users WHERE username = 'admin')
  FROM items i CROSS JOIN generate_series(1, 28) AS g(d)
  JOIN fund_sources fs ON fs.code = 'GENERAL_DONATION'
 WHERE i.code = 'DRY-001';

-- ───────────── Daily and weekly consumption ─────────────
INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, department_id, issued_to, created_by)
SELECT 'OUT', i.id, current_date - g.d, r.qty, dp.id, r.issued_to, (SELECT id FROM users WHERE username = 'staff')
  FROM (VALUES
    ('GRC-001', 'BOYS_HOSTEL',  4,   'Boys hostel kitchen'),
    ('GRC-001', 'GIRLS_HOSTEL', 3,   'Girls hostel kitchen'),
    ('GRC-002', 'BOYS_HOSTEL',  6,   'Boys hostel kitchen'),
    ('GRC-002', 'GIRLS_HOSTEL', 5,   'Girls hostel kitchen'),
    ('GRC-003', 'ADMIN',        1.2, 'Main kitchen'),
    ('GRC-004', 'ADMIN',        1.5, 'Main kitchen'),
    ('GRC-005', 'ADMIN',        1,   'Main kitchen'),
    ('DRY-001', 'BOYS_HOSTEL',  6,   'Boys hostel kitchen'),
    ('DRY-001', 'GIRLS_HOSTEL', 5,   'Girls hostel kitchen'),
    ('DRY-002', 'ADMIN',        1.5, 'Main kitchen')
  ) AS r(code, dept, qty, issued_to)
  CROSS JOIN generate_series(1, 28) AS g(d)
  JOIN items i ON i.code = r.code
  JOIN departments dp ON dp.code = r.dept;

INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, department_id, issued_to, created_by)
SELECT 'OUT', i.id, current_date - g.d, r.qty, dp.id, r.issued_to, (SELECT id FROM users WHERE username = 'staff')
  FROM (VALUES
    ('HYG-001', 'BOYS_HOSTEL',  20, 'Hostel warden (boys)'),
    ('HYG-001', 'GIRLS_HOSTEL', 20, 'Hostel warden (girls)'),
    ('HYG-002', 'BOYS_HOSTEL',  6,  'Hostel warden (boys)'),
    ('HYG-002', 'GIRLS_HOSTEL', 6,  'Hostel warden (girls)'),
    ('STN-001', 'SCHOOL',       60, 'School office'),
    ('STN-002', 'SCHOOL',       5,  'School office'),
    ('CLN-001', 'ADMIN',        12, 'Laundry')
  ) AS r(code, dept, qty, issued_to)
  CROSS JOIN generate_series(1, 28, 7) AS g(d)
  JOIN items i ON i.code = r.code
  JOIN departments dp ON dp.code = r.dept;

-- ───────────── Demand sheets ─────────────
INSERT INTO demand_sheets (demand_no, created_on, required_by, department_id, status, purpose, requested_by, approved_by, approved_at)
SELECT 'DS-' || to_char(current_date, 'YYYY') || '-' || v.seq, current_date + v.created, current_date + v.required,
       (SELECT id FROM departments WHERE code = v.dept), v.status::demand_status, v.purpose,
       (SELECT id FROM users WHERE username = 'staff'),
       CASE WHEN v.status IN ('approved', 'partially_fulfilled', 'fulfilled') THEN (SELECT id FROM users WHERE username = 'admin') END,
       CASE WHEN v.status IN ('approved', 'partially_fulfilled', 'fulfilled') THEN now() - interval '1 day' END
  FROM (VALUES
    ('0001', -20, -15, NULL,           'fulfilled',           'Monthly toiletries for both hostels'),
    ('0002', -3,  2,   'BOYS_HOSTEL',  'partially_fulfilled', 'Weekend breakfast'),
    ('0003', 0,   1,   'ADMIN',        'submitted',           'Kitchen restock for Friday'),
    ('0004', -5,  -1,  'SCHOOL',       'approved',            'New term stationery'),
    ('0005', 0,   10,  'ADMIN',        'draft',               'Laundry supplies')
  ) AS v(seq, created, required, dept, status, purpose);

INSERT INTO demand_items (demand_sheet_id, item_id, qty_boys, qty_girls)
SELECT ds.id, i.id, v.boys, v.girls
  FROM (VALUES
    ('0001', 'HYG-002', 10, 10),
    ('0002', 'DRY-002', 10, 8),
    ('0002', 'GRC-004', 5,  5),
    ('0003', 'GRC-003', 10, 10),
    ('0004', 'STN-001', 40, 35),
    ('0005', 'CLN-001', 10, 10)
  ) AS v(seq, code, boys, girls)
  JOIN demand_sheets ds ON ds.demand_no = 'DS-' || to_char(current_date, 'YYYY') || '-' || v.seq
  JOIN items i ON i.code = v.code;

-- Stock issued against demands 0001 (fully) and 0002 (eggs only).
INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, department_id, demand_item_id, issued_to, created_by)
SELECT 'OUT', di.item_id, current_date + v.day, v.qty, (SELECT id FROM departments WHERE code = v.dept), di.id, v.issued_to,
       (SELECT id FROM users WHERE username = 'staff')
  FROM (VALUES
    ('0001', 'HYG-002', -16, 20, 'BOYS_HOSTEL', 'Hostel wardens'),
    ('0002', 'DRY-002', -1,  10, 'BOYS_HOSTEL', 'Boys hostel kitchen')
  ) AS v(seq, code, day, qty, dept, issued_to)
  JOIN demand_sheets ds ON ds.demand_no = 'DS-' || to_char(current_date, 'YYYY') || '-' || v.seq
  JOIN items i ON i.code = v.code
  JOIN demand_items di ON di.demand_sheet_id = ds.id AND di.item_id = i.id;

-- ───────────── Vehicle trips (last 20 days) ─────────────
WITH base AS (
  SELECT v.id AS vehicle_id, v.registration_no, v.opening_odometer_km AS opening, g.n,
         (CASE WHEN v.registration_no = 'LEB-1234' THEN 15 + (g.n * 7) % 23 ELSE 8 + (g.n * 5) % 17 END)::numeric AS dist,
         (ARRAY['School supplies pickup', 'Hospital visit (children)', 'Grocery purchase', 'School drop-off', 'Bank / office work'])[1 + g.n % 5] AS purpose,
         (ARRAY['Sheikhupura city', 'DHQ Hospital', 'Main Bazar', 'Aghosh School', 'Civil Lines'])[1 + g.n % 5] AS destination,
         (ARRAY['SCHOOL', 'GIRLS_HOSTEL', 'ADMIN', 'BOYS_HOSTEL', 'SCHOOL'])[1 + g.n % 5] AS dept,
         (current_date - (21 - g.n)) + time '09:00' + (g.n % 3) * interval '1 hour' AS departed
    FROM vehicles v CROSS JOIN generate_series(1, 20) AS g(n)
), w AS (
  SELECT *, opening + SUM(dist) OVER (PARTITION BY vehicle_id ORDER BY n) - dist AS start_km FROM base
)
INSERT INTO vehicle_trips (vehicle_id, driver_id, department_id, trip_date, departed_at, returned_at, purpose, destination,
                           start_km, end_km, created_by)
SELECT w.vehicle_id,
       (SELECT id FROM drivers WHERE full_name = CASE WHEN w.registration_no = 'LEB-1234' THEN 'Muhammad Akram' ELSE 'Zafar Iqbal' END),
       (SELECT id FROM departments WHERE code = w.dept),
       w.departed::date, w.departed, w.departed + interval '1 hour' + w.dist * interval '3 minutes',
       w.purpose, w.destination, w.start_km, w.start_km + w.dist,
       (SELECT id FROM users WHERE username = 'staff')
  FROM w;

-- One van is out right now.
INSERT INTO vehicle_trips (vehicle_id, driver_id, department_id, trip_date, departed_at, purpose, destination, start_km, created_by)
SELECT v.id, (SELECT id FROM drivers WHERE full_name = 'Zafar Iqbal'), (SELECT id FROM departments WHERE code = 'GIRLS_HOSTEL'),
       (now() - interval '90 minutes')::date, now() - interval '90 minutes', 'Medical check-up (girls)', 'DHQ Hospital',
       (SELECT MAX(end_km) FROM vehicle_trips t WHERE t.vehicle_id = v.id), (SELECT id FROM users WHERE username = 'staff')
  FROM vehicles v WHERE v.registration_no = 'LEA-5678';

-- ───────────── Fuel (every 5th trip day) ─────────────
INSERT INTO fuel_logs (vehicle_id, fill_date, odometer_km, litres, amount, is_full_tank, fund_source_id, receipt_no, created_by)
SELECT t.vehicle_id, t.trip_date, t.end_km,
       CASE WHEN v.fuel_type = 'diesel' THEN 25 ELSE 15 END,
       CASE WHEN v.fuel_type = 'diesel' THEN 25 * 285 ELSE 15 * 270 END,
       true, (SELECT id FROM fund_sources WHERE code = 'ALKHIDMAT_GRANT'),
       'PSO-' || t.id, (SELECT id FROM users WHERE username = 'staff')
  FROM vehicle_trips t JOIN vehicles v ON v.id = t.vehicle_id
 WHERE t.end_km IS NOT NULL AND (current_date - t.trip_date) IN (1, 6, 11, 16);

INSERT INTO audit_logs (user_id, action, entity, details)
VALUES ((SELECT id FROM users WHERE username = 'admin'), 'seed', 'demo_data', '{"source": "db/seed/demo.sql"}');
