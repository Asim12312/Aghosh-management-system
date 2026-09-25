-- Reference data every installation needs. Admins can edit these later from Admin → Master data.
INSERT INTO departments (code, name_en, name_ur) VALUES
  ('BOYS_HOSTEL',  'Boys Hostel',  'بوائز ہاسٹل'),
  ('GIRLS_HOSTEL', 'Girls Hostel', 'گرلز ہاسٹل'),
  ('SCHOOL',       'School',       'اسکول'),
  ('ADMIN',        'Administration / Kitchen', 'انتظامیہ / کچن');

INSERT INTO fund_sources (code, name_en, name_ur) VALUES
  ('GENERAL_DONATION', 'General Donation',          'عمومی عطیہ'),
  ('ALKHIDMAT_GRANT',  'Alkhidmat Provided Grant',  'الخدمت فراہم کردہ گرانٹ'),
  ('ZAKAT',            'Zakat',                     'زکوٰۃ'),
  ('SADQAH',           'Sadqah',                    'صدقہ'),
  ('IN_KIND',          'In-kind Donation',          'اشیاء کی صورت میں عطیہ');

INSERT INTO units (code, name_en, name_ur) VALUES
  ('KG',     'Kilogram', 'کلوگرام'),
  ('LITRE',  'Litre',    'لیٹر'),
  ('PCS',    'Pieces',   'عدد'),
  ('DOZEN',  'Dozen',    'درجن'),
  ('PACKET', 'Packet',   'پیکٹ'),
  ('BOX',    'Box',      'ڈبہ');

INSERT INTO item_categories (name_en, name_ur) VALUES
  ('Grocery / Ration',       'راشن'),
  ('Dairy & Fresh',          'دودھ و تازہ اشیاء'),
  ('Toiletries & Hygiene',   'صفائی و حفظان صحت'),
  ('Stationery',             'اسٹیشنری'),
  ('Clothing & Bedding',     'کپڑے و بستر'),
  ('Medicine',               'ادویات'),
  ('Cleaning Supplies',      'صفائی کا سامان');

INSERT INTO app_settings (key, value) VALUES
  ('stock_alert_horizon_days', '7'),
  ('consumption_window_days',  '30'),
  ('demand_reminder_days',     '3'),
  ('org_name_en', '"Alkhidmat Foundation — Aghosh Sheikhupura"'),
  ('org_name_ur', '"الخدمت فاؤنڈیشن — آغوش شیخوپورہ"');
