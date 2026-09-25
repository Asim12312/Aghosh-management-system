import { requireUser } from "@/lib/dal/auth";
import { getTrips } from "@/lib/dal/fleet";
import { getDepartments, getVehicles } from "@/lib/dal/lookups";
import { fmt, fmtDateTime, fmtKm, getDictionary, nm, nowLocalInput, type Locale } from "@/lib/i18n";
import { CloseTripForm } from "@/components/fleet-forms";
import { TripsTable } from "@/components/trips-table";
import { Alert, buttonCls, Card, inputCls, LinkButton, PageHeader } from "@/components/ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TripsPage({ params, searchParams }: PageProps<"/[locale]/fleet/trips">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const t = d.fleet;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = {
    from: DATE_RE.test(str("from")) ? str("from") : undefined,
    to: DATE_RE.test(str("to")) ? str("to") : undefined,
    vehicleId: /^\d+$/.test(str("vehicle")) ? Number(str("vehicle")) : undefined,
    departmentId: /^\d+$/.test(str("department")) ? Number(str("department")) : undefined,
    limit: 300,
  };
  const [vehicles, departments, open, trips] = await Promise.all([
    getVehicles(false),
    getDepartments(false),
    getTrips({ openOnly: true }),
    getTrips(filters),
  ]);
  const now = nowLocalInput();
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <>
      <PageHeader title={t.tripsTitle} subtitle={t.tripsSubtitle} actions={<LinkButton href={`/${locale}/fleet/trips/new`}>{t.newTrip}</LinkButton>} />
      {sp.saved === "1" && (
        <div className="mb-4">
          <Alert tone="green">{d.common.saved}</Alert>
        </div>
      )}

      {open.length > 0 && (
        <Card title={d.dashboard.vehiclesOut} className="mb-6">
          <ul className="divide-y divide-slate-100">
            {open.map((o) => (
              <li key={o.id} className="flex flex-wrap items-end justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="text-sm">
                  <div className="font-medium">
                    <span className="ltr-nums">{o.registration_no}</span> · {o.driver_name}
                  </div>
                  <div className="text-slate-500">
                    {o.purpose} · {locale === "ur" ? o.dept_ur : o.dept_en}
                  </div>
                  <div className="text-xs text-slate-500">
                    {d.dashboard.since}: <span className="ltr-nums">{fmtDateTime(o.departed_at)}</span> · {t.startKm}:{" "}
                    <span className="ltr-nums">{fmtKm(o.start_km)}</span>
                  </div>
                </div>
                <CloseTripForm id={o.id} startKm={o.start_km} now={now} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card bodyClassName="p-0">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div>
            <label className={label} htmlFor="from">{d.common.from}</label>
            <input id="from" type="date" name="from" defaultValue={filters.from} className={inputCls} />
          </div>
          <div>
            <label className={label} htmlFor="to">{d.common.to}</label>
            <input id="to" type="date" name="to" defaultValue={filters.to} className={inputCls} />
          </div>
          <div>
            <label className={label} htmlFor="vehicle">{t.vehicle}</label>
            <select id="vehicle" name="vehicle" defaultValue={filters.vehicleId ?? ""} className={inputCls}>
              <option value="">{d.common.all}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registration_no}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="department">{t.department}</label>
            <select id="department" name="department" defaultValue={filters.departmentId ?? ""} className={inputCls}>
              <option value="">{d.common.all}</option>
              {departments.map((x) => (
                <option key={x.id} value={x.id}>{nm(x, locale)}</option>
              ))}
            </select>
          </div>
          <button className={buttonCls("secondary")}>{d.common.applyFilters}</button>
          <span className="pb-2 text-xs text-slate-500">{fmt(d.common.showing, { n: trips.length })}</span>
        </form>
        <TripsTable rows={trips} locale={locale} editable={user.role === "admin"} />
      </Card>
    </>
  );
}
