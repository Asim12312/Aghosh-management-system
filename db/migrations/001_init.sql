-- Aghosh Sheikhupura MIS: initial schema
CREATE TYPE user_role      AS ENUM ('admin', 'staff');
CREATE TYPE locale_code    AS ENUM ('en', 'ur');
CREATE TYPE stock_txn_type AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE demand_status  AS ENUM ('draft','submitted','approved','partially_fulfilled','fulfilled','cancelled');
CREATE TYPE fuel_type      AS ENUM ('petrol','diesel','cng','electric');

-- ───────────── Auth & settings ─────────────
CREATE TABLE users (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name        text        NOT NULL,
  username         text        NOT NULL,
  email            text,
  password_hash    text        NOT NULL,
  role             user_role   NOT NULL DEFAULT 'staff',
  preferred_locale locale_code NOT NULL DEFAULT 'ur',
  is_active        boolean     NOT NULL DEFAULT true,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uq ON users (lower(username));

CREATE TABLE sessions (
  id          text PRIMARY KEY,                       -- SHA-256 of the cookie token
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON sessions (user_id);

CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by bigint REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint REFERENCES users(id),
  action     text   NOT NULL,
  entity     text   NOT NULL,
  entity_id  text,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs (created_at DESC);

-- ───────────── Shared master data ─────────────
CREATE TABLE departments (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code      text NOT NULL UNIQUE,
  name_en   text NOT NULL,
  name_ur   text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE fund_sources (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code      text NOT NULL UNIQUE,
  name_en   text NOT NULL,
  name_ur   text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- ───────────── Inventory ─────────────
CREATE TABLE item_categories (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_en   text NOT NULL UNIQUE,
  name_ur   text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE units (
  id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code    text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ur text NOT NULL
);

CREATE TABLE vendors (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           text NOT NULL,
  contact_person text,
  phone          text,
  ntn_cnic       text,
  address        text,
  notes          text,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              text     NOT NULL UNIQUE,
  name_en           text     NOT NULL,
  name_ur           text     NOT NULL,
  category_id       smallint NOT NULL REFERENCES item_categories(id),
  unit_id           smallint NOT NULL REFERENCES units(id),
  default_vendor_id bigint   REFERENCES vendors(id),
  min_stock_level   numeric(12,3) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
  reorder_qty       numeric(12,3),
  lead_time_days    smallint NOT NULL DEFAULT 2 CHECK (lead_time_days >= 0),
  is_perishable     boolean  NOT NULL DEFAULT false,
  is_active         boolean  NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Demand sheets ─────────────
CREATE TABLE demand_sheets (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  demand_no     text NOT NULL UNIQUE,
  created_on    date NOT NULL DEFAULT current_date,
  required_by   date NOT NULL,
  department_id smallint REFERENCES departments(id),
  status        demand_status NOT NULL DEFAULT 'draft',
  purpose       text,
  requested_by  bigint NOT NULL REFERENCES users(id),
  approved_by   bigint REFERENCES users(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (required_by >= created_on)
);
CREATE INDEX ON demand_sheets (status, required_by);

CREATE TABLE demand_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  demand_sheet_id bigint NOT NULL REFERENCES demand_sheets(id) ON DELETE CASCADE,
  item_id         bigint NOT NULL REFERENCES items(id),
  qty_boys        numeric(12,3) NOT NULL DEFAULT 0 CHECK (qty_boys  >= 0),
  qty_girls       numeric(12,3) NOT NULL DEFAULT 0 CHECK (qty_girls >= 0),
  qty_total       numeric(12,3) GENERATED ALWAYS AS (qty_boys + qty_girls) STORED,
  remarks         text,
  UNIQUE (demand_sheet_id, item_id),
  CHECK (qty_boys + qty_girls > 0)
);

-- Stock ledger: one row per IN/OUT/ADJUST; rows are voided, never edited or deleted.
CREATE TABLE stock_transactions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  txn_type       stock_txn_type NOT NULL,
  item_id        bigint NOT NULL REFERENCES items(id),
  txn_date       date   NOT NULL,
  quantity       numeric(12,3) NOT NULL CHECK (quantity <> 0),  -- ADJUST may be negative
  fund_source_id smallint REFERENCES fund_sources(id),
  vendor_id      bigint   REFERENCES vendors(id),
  donor_name     text,
  unit_cost      numeric(12,2) CHECK (unit_cost >= 0),
  reference_no   text,
  expiry_date    date,
  department_id  smallint REFERENCES departments(id),
  demand_item_id bigint   REFERENCES demand_items(id),
  issued_to      text,
  remarks        text,
  created_by     bigint NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  voided_at      timestamptz,
  voided_by      bigint REFERENCES users(id),
  void_reason    text,
  CONSTRAINT chk_in     CHECK (txn_type <> 'IN'     OR (quantity > 0 AND fund_source_id IS NOT NULL)),
  CONSTRAINT chk_out    CHECK (txn_type <> 'OUT'    OR (quantity > 0 AND department_id IS NOT NULL)),
  CONSTRAINT chk_adjust CHECK (txn_type <> 'ADJUST' OR remarks IS NOT NULL),
  CONSTRAINT chk_void   CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);
CREATE INDEX ON stock_transactions (item_id, txn_date);
CREATE INDEX ON stock_transactions (txn_type, txn_date);
CREATE INDEX ON stock_transactions (demand_item_id) WHERE demand_item_id IS NOT NULL;

-- ───────────── Fleet ─────────────
CREATE TABLE vehicles (
  id                  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_no     text NOT NULL UNIQUE,
  make_model          text,
  vehicle_type        text,
  fuel_type           fuel_type,
  seating_capacity    smallint,
  opening_odometer_km numeric(10,1) NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true
);

CREATE TABLE drivers (
  id             smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      text NOT NULL,
  phone          text,
  cnic           text UNIQUE,
  license_no     text,
  license_expiry date,
  is_active      boolean NOT NULL DEFAULT true
);

CREATE TABLE vehicle_trips (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id    smallint NOT NULL REFERENCES vehicles(id),
  driver_id     smallint NOT NULL REFERENCES drivers(id),
  department_id smallint NOT NULL REFERENCES departments(id),
  trip_date     date NOT NULL,
  departed_at   timestamptz NOT NULL,
  returned_at   timestamptz,                          -- NULL = vehicle still out
  purpose       text NOT NULL,
  destination   text,
  start_km      numeric(10,1) NOT NULL CHECK (start_km >= 0),
  end_km        numeric(10,1),
  distance_km   numeric(10,1) GENERATED ALWAYS AS (end_km - start_km) STORED,
  remarks       text,
  created_by    bigint NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_km IS NULL OR end_km >= start_km),
  CHECK (returned_at IS NULL OR returned_at >= departed_at)
);
CREATE INDEX ON vehicle_trips (vehicle_id, trip_date);
CREATE INDEX ON vehicle_trips (department_id, trip_date);

CREATE TABLE fuel_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id     smallint NOT NULL REFERENCES vehicles(id),
  fill_date      date NOT NULL,
  odometer_km    numeric(10,1) NOT NULL,
  litres         numeric(8,2)  NOT NULL CHECK (litres > 0),
  amount         numeric(12,2) NOT NULL CHECK (amount >= 0),
  is_full_tank   boolean NOT NULL DEFAULT true,
  fund_source_id smallint REFERENCES fund_sources(id),
  receipt_no     text,
  created_by     bigint NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON fuel_logs (vehicle_id, fill_date);

-- ───────────── Views ─────────────
CREATE VIEW v_item_stock AS
SELECT i.id AS item_id,
       COALESCE(SUM(CASE WHEN t.txn_type = 'OUT' THEN -t.quantity ELSE t.quantity END), 0) AS current_stock
FROM items i
LEFT JOIN stock_transactions t ON t.item_id = i.id AND t.voided_at IS NULL
GROUP BY i.id;

-- Below minimum now, or projected to reach the minimum within (horizon + lead time) days
-- at the average daily consumption rate.
CREATE VIEW v_stock_alerts AS
WITH cfg AS (
  SELECT COALESCE((SELECT value::int FROM app_settings WHERE key = 'consumption_window_days'), 30)  AS win,
         COALESCE((SELECT value::int FROM app_settings WHERE key = 'stock_alert_horizon_days'), 7) AS horizon
), usage AS (
  SELECT t.item_id, SUM(t.quantity) / MAX(cfg.win) AS avg_daily_out
  FROM stock_transactions t CROSS JOIN cfg
  WHERE t.txn_type = 'OUT' AND t.voided_at IS NULL
    AND t.txn_date > current_date - cfg.win
  GROUP BY t.item_id
)
SELECT i.id AS item_id, i.code, i.name_en, i.name_ur, i.unit_id,
       s.current_stock, i.min_stock_level, u.avg_daily_out,
       CASE WHEN u.avg_daily_out > 0 THEN FLOOR(s.current_stock / u.avg_daily_out) END AS days_of_cover,
       CASE WHEN s.current_stock <= 0                 THEN 'OUT_OF_STOCK'
            WHEN s.current_stock <= i.min_stock_level THEN 'BELOW_MIN'
            ELSE 'RUNNING_LOW' END AS alert_level
FROM items i
JOIN v_item_stock s ON s.item_id = i.id
LEFT JOIN usage u  ON u.item_id = i.id
CROSS JOIN cfg
WHERE i.is_active
  AND ( s.current_stock <= i.min_stock_level
     OR (u.avg_daily_out > 0
         AND (s.current_stock - i.min_stock_level) / u.avg_daily_out <= cfg.horizon + i.lead_time_days) );

CREATE VIEW v_demand_item_progress AS
SELECT di.*,
       COALESCE(SUM(t.quantity) FILTER (WHERE t.voided_at IS NULL), 0) AS qty_issued
FROM demand_items di
LEFT JOIN stock_transactions t ON t.demand_item_id = di.id AND t.txn_type = 'OUT'
GROUP BY di.id;

CREATE VIEW v_upcoming_demands AS
SELECT ds.id AS demand_sheet_id, ds.demand_no, ds.required_by, ds.status, ds.department_id,
       (ds.required_by - current_date)                           AS days_left,     -- negative = overdue
       p.id AS demand_item_id, p.item_id, p.qty_boys, p.qty_girls, p.qty_total, p.qty_issued,
       p.qty_total - p.qty_issued                                AS qty_pending,
       s.current_stock,
       GREATEST(p.qty_total - p.qty_issued - s.current_stock, 0) AS shortfall
FROM demand_sheets ds
JOIN v_demand_item_progress p ON p.demand_sheet_id = ds.id
JOIN v_item_stock s           ON s.item_id = p.item_id
WHERE ds.status IN ('submitted','approved','partially_fulfilled')
  AND p.qty_issued < p.qty_total;
