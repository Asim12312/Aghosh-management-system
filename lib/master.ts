// Config for the simple lookup tables edited through the generic Master data screens.
// Table and column names come only from this file, never from user input.
import type { L } from "@/lib/i18n";

export type MasterField = {
  name: string;
  label: L;
  type: "text" | "number" | "date" | "bool" | "select";
  required?: boolean;
  options?: { value: string; label: L }[];
  /** Show as a column in the list view. */
  list?: boolean;
  dir?: "ltr";
};

export type MasterEntity = {
  key: string;
  table: string;
  title: L;
  singular: L;
  fields: MasterField[];
  orderBy: string;
  hasActive: boolean;
};

const code: MasterField = { name: "code", label: { en: "Code", ur: "کوڈ" }, type: "text", required: true, list: true, dir: "ltr" };
const nameEn: MasterField = { name: "name_en", label: { en: "Name (English)", ur: "نام (انگریزی)" }, type: "text", required: true, list: true };
const nameUr: MasterField = { name: "name_ur", label: { en: "Name (Urdu)", ur: "نام (اردو)" }, type: "text", required: true, list: true };
const phone: MasterField = { name: "phone", label: { en: "Phone", ur: "فون" }, type: "text", list: true, dir: "ltr" };

export const masterEntities: MasterEntity[] = [
  {
    key: "categories",
    table: "item_categories",
    title: { en: "Item categories", ur: "اشیاء کے زمرے" },
    singular: { en: "Category", ur: "زمرہ" },
    fields: [nameEn, nameUr],
    orderBy: "name_en",
    hasActive: true,
  },
  {
    key: "units",
    table: "units",
    title: { en: "Units of measure", ur: "پیمائش کی اکائیاں" },
    singular: { en: "Unit", ur: "اکائی" },
    fields: [code, nameEn, nameUr],
    orderBy: "name_en",
    hasActive: false,
  },
  {
    key: "vendors",
    table: "vendors",
    title: { en: "Vendors / suppliers", ur: "سپلائرز" },
    singular: { en: "Vendor", ur: "سپلائر" },
    fields: [
      { name: "name", label: { en: "Name", ur: "نام" }, type: "text", required: true, list: true },
      { name: "contact_person", label: { en: "Contact person", ur: "رابطہ کار" }, type: "text", list: true },
      phone,
      { name: "ntn_cnic", label: { en: "NTN / CNIC", ur: "این ٹی این / شناختی کارڈ" }, type: "text", dir: "ltr" },
      { name: "address", label: { en: "Address", ur: "پتہ" }, type: "text" },
      { name: "notes", label: { en: "Notes", ur: "نوٹس" }, type: "text" },
    ],
    orderBy: "name",
    hasActive: true,
  },
  {
    key: "departments",
    table: "departments",
    title: { en: "Departments", ur: "شعبہ جات" },
    singular: { en: "Department", ur: "شعبہ" },
    fields: [code, nameEn, nameUr],
    orderBy: "id",
    hasActive: true,
  },
  {
    key: "fund-sources",
    table: "fund_sources",
    title: { en: "Sources of stock / funds", ur: "اسٹاک / فنڈز کے ذرائع" },
    singular: { en: "Source", ur: "ذریعہ" },
    fields: [code, nameEn, nameUr],
    orderBy: "id",
    hasActive: true,
  },
  {
    key: "vehicles",
    table: "vehicles",
    title: { en: "Vehicles", ur: "گاڑیاں" },
    singular: { en: "Vehicle", ur: "گاڑی" },
    fields: [
      { name: "registration_no", label: { en: "Vehicle number", ur: "گاڑی نمبر" }, type: "text", required: true, list: true, dir: "ltr" },
      { name: "make_model", label: { en: "Make / model", ur: "کمپنی / ماڈل" }, type: "text", list: true },
      { name: "vehicle_type", label: { en: "Type", ur: "قسم" }, type: "text", list: true },
      {
        name: "fuel_type",
        label: { en: "Fuel", ur: "ایندھن" },
        type: "select",
        list: true,
        options: [
          { value: "petrol", label: { en: "Petrol", ur: "پیٹرول" } },
          { value: "diesel", label: { en: "Diesel", ur: "ڈیزل" } },
          { value: "cng", label: { en: "CNG", ur: "سی این جی" } },
          { value: "electric", label: { en: "Electric", ur: "الیکٹرک" } },
        ],
      },
      { name: "seating_capacity", label: { en: "Seats", ur: "نشستیں" }, type: "number" },
      {
        name: "opening_odometer_km",
        label: { en: "Opening odometer (km)", ur: "ابتدائی میٹر ریڈنگ (کلومیٹر)" },
        type: "number",
        list: true,
      },
    ],
    orderBy: "registration_no",
    hasActive: true,
  },
  {
    key: "drivers",
    table: "drivers",
    title: { en: "Drivers", ur: "ڈرائیورز" },
    singular: { en: "Driver", ur: "ڈرائیور" },
    fields: [
      { name: "full_name", label: { en: "Full name", ur: "پورا نام" }, type: "text", required: true, list: true },
      phone,
      { name: "cnic", label: { en: "CNIC", ur: "شناختی کارڈ" }, type: "text", list: true, dir: "ltr" },
      { name: "license_no", label: { en: "License no.", ur: "لائسنس نمبر" }, type: "text", list: true, dir: "ltr" },
      { name: "license_expiry", label: { en: "License expiry", ur: "لائسنس کی میعاد" }, type: "date", list: true },
    ],
    orderBy: "full_name",
    hasActive: true,
  },
];

export function getMasterEntity(key: string) {
  return masterEntities.find((e) => e.key === key);
}
