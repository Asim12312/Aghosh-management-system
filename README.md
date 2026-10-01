# Aghosh Sheikhupura MIS

Management Information System for Alkhidmat Foundation's Aghosh Sheikhupura branch. It covers inventory, demand sheets, the vehicle log and printable reports, with a bilingual English / Urdu (RTL) interface.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first visit shows **First-time setup**, where you create the administrator account. That form works only while no users exist.

With no `DATABASE_URL`, the app uses an embedded PostgreSQL (PGlite) stored in `./.data/pglite`. This is fine for development. Only one process can open that folder at a time, so stop `next dev` before running `npm run db:migrate` against it. To reset the local database, stop the server and delete `.data/`.

For production, point the app at a real PostgreSQL 14+ server:

```bash
cp .env.example .env    # set DATABASE_URL and CRON_SECRET
npm run db:migrate      # optional: the app also migrates on the first request
npm run build && npm start
```

## Demo data (testing)

Set `SEED_DEMO_DATA=true` and the app fills an **empty** database (no users yet) on its first request. It adds a month of stock movements, demand sheets, trips and fuel, with dates relative to today. It also creates two logins:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@12345` |
| Staff | `staff` | `Staff@12345` |

You can also load it manually with `npm run db:seed-demo`. The data lives in [db/seed/demo.sql](db/seed/demo.sql). Demo data never loads on a Vercel **production** deployment (`VERCEL_ENV=production`), even if the variable is set. It still works locally and on preview deployments.

To go live on a database that already contains demo data, run [db/scripts/clear-demo-data.sql](db/scripts/clear-demo-data.sql) once in the Neon SQL Editor. It deletes all users and operational data but keeps departments, sources, units, categories and settings. The app then shows **First-time setup** so you can create the real administrator.

## Deploying on Vercel

1. Create a hosted PostgreSQL database (Vercel → Storage → Neon, or Supabase) so that `DATABASE_URL` is set.
2. Add the environment variables `APP_TIMEZONE=Asia/Karachi`, `NEXT_PUBLIC_APP_TIMEZONE=Asia/Karachi`, `CRON_SECRET` and, for testing, `SEED_DEMO_DATA=true`.
3. Deploy. The first request creates the tables and, if enabled, loads the demo data.

## Modules

| Area | What it does |
|---|---|
| Dashboard | KPIs; stock alerts (below minimum, or expected to reach it within the alert horizon plus the item's lead time, based on average daily consumption); unfulfilled demands due within N days (including overdue ones), with shortfall; vehicles currently out |
| Inventory | Item master (English and Urdu names, category, unit, default vendor, minimum level, lead time); receive stock with its source (General Donation, Alkhidmat Grant, Zakat…); issue stock to a department, optionally against a demand line; admin-only adjustments; entries are voided, never deleted |
| Demand sheets | Draft → submitted → approved (admin) → partially fulfilled / fulfilled; quantities split by Boys and Girls; stock issued from the sheet; printable demand form |
| Fleet | Start and close trips (vehicle, driver, department, purpose, time out/in, start/end km; km driven is calculated); a vehicle can have only one open trip; odometer continuity check; fuel log for km/litre |
| Reports | Stock summary, item ledger, receipts by source, consumption by department, low stock, demand status, trip log, vehicle usage & mileage, km by department. Filters: date range, vehicle, department, km range, item, category, source, status. Every report can be printed (A4, letterhead, filters, signature lines) or exported to CSV |
| Excel import | Download a template (with dropdowns of valid values), fill it in, and upload it to bulk-add items, stock received, stock issued, trips, vendors, vehicles or drivers. Every row is checked first; if any row has a problem, nothing is imported and the rows to fix are listed |
| Administration | Users and roles, master data (categories, units, vendors, departments, sources, vehicles, drivers), alert settings, audit log |

**Roles.** An **Admin** has full access. **Staff / Manager** covers day-to-day work: receive and issue stock, create demands, log trips and fuel, and run reports. Staff can't adjust or void stock entries, approve demands, edit closed trips, change item minimum levels, or manage users, master data or settings.

## Project layout

```
db/migrations/        SQL schema, views and reference data (applied in order, tracked in _migrations)
proxy.ts              locale prefix + optimistic login redirect (real checks live in lib/dal)
lib/db/               pg / PGlite driver, query helpers, migrations runner
lib/dal/              server-only data access; requireUser()/requireAdmin() guard every page and action
lib/actions/          Server Actions (all mutations), validated with zod
lib/reports.ts        report registry: one definition drives the screen, print page and CSV export
lib/master.ts         config for the generic master-data screens
lib/i18n/             en.ts / ur.ts dictionaries, formatters (Western digits, dd/MM/yyyy, Asia/Karachi)
app/[locale]/(app)/   authenticated screens
app/[locale]/print/   print-only layouts (reports, demand sheet)
app/api/              CSV export, daily-alerts JSON for a scheduler
```

## Notes

- **Timezone.** "Today", overdue calculations and timestamps use `APP_TIMEZONE` (default `Asia/Karachi`).
- **Printing.** Uses the browser's print dialog, which shapes Nastaliq correctly. Choose "Save as PDF" to get a PDF. Wide reports switch to A4 landscape automatically.
- **Daily alerts.** `GET /api/cron/daily-alerts` with `Authorization: Bearer $CRON_SECRET` returns the day's stock alerts and due demands as JSON, ready to hook into email or WhatsApp later.
- **Backups.** In production, schedule a nightly `pg_dump` to off-site storage.
