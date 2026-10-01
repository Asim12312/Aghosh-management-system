import Link from "next/link";
import { AlertTriangle, ClipboardList, Package, Truck } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { one, query } from "@/lib/db";
import { getTrips } from "@/lib/dal/fleet";
import { getSetting } from "@/lib/dal/lookups";
import { fmt, fmtDate, fmtDateTime, fmtKm, fmtNum, getDictionary, nm, todayISO, type Locale } from "@/lib/i18n";
import { DueBadge } from "@/components/due-badge";
import { Alert, Badge, Card, EmptyRow, LinkButton, PageHeader, Stat, Table, Td, Th } from "@/components/ui";

type AlertRow = {
  item_id: number;
  code: string;
  name_en: string;
  name_ur: string;
  unit_en: string;
  unit_ur: string;
  current_stock: number;
  min_stock_level: number;
  avg_daily_out: number | null;
  days_of_cover: number | null;
  alert_level: "OUT_OF_STOCK" | "BELOW_MIN" | "RUNNING_LOW";
};

type DemandRow = {
  demand_sheet_id: number;
  demand_no: string;
  required_by: string;
  days_left: number;
  name_en: string;
  name_ur: string;
  unit_en: string;
  unit_ur: string;
  qty_pending: number;
  shortfall: number;
  dept_en: string | null;
  dept_ur: string | null;
};

export default async function DashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard">) {
  await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const t = d.dashboard;
  const ur = locale === "ur";

  const [horizon, reminder] = await Promise.all([getSetting("stock_alert_horizon_days", 7), getSetting("demand_reminder_days", 3)]);
  const monthStart = todayISO().slice(0, 8) + "01";

  const [kpi, alerts, demands, out] = await Promise.all([
    one<{ items: number; open_demands: number; km_month: number }>(
      `SELECT (SELECT count(*)::int FROM items WHERE is_active) AS items,
              (SELECT count(*)::int FROM demand_sheets WHERE status IN ('submitted','approved','partially_fulfilled')) AS open_demands,
              (SELECT COALESCE(SUM(distance_km), 0) FROM vehicle_trips WHERE trip_date >= $1) AS km_month`,
      [monthStart],
    ),
    query<AlertRow>(
      `SELECT a.item_id, a.code, a.name_en, a.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur, a.current_stock, a.min_stock_level,
              a.avg_daily_out, a.days_of_cover, a.alert_level
         FROM v_stock_alerts a JOIN units u ON u.id = a.unit_id
        ORDER BY CASE a.alert_level WHEN 'OUT_OF_STOCK' THEN 0 WHEN 'BELOW_MIN' THEN 1 ELSE 2 END, a.days_of_cover NULLS FIRST, a.name_en`,
    ),
    query<DemandRow>(
      `SELECT u.demand_sheet_id, u.demand_no, u.required_by, u.days_left, i.name_en, i.name_ur, un.name_en AS unit_en, un.name_ur AS unit_ur,
              u.qty_pending, u.shortfall, dp.name_en AS dept_en, dp.name_ur AS dept_ur
         FROM v_upcoming_demands u
         JOIN items i ON i.id = u.item_id
         JOIN units un ON un.id = i.unit_id
         LEFT JOIN departments dp ON dp.id = u.department_id
        WHERE u.days_left <= $1
        ORDER BY u.required_by, u.demand_no, i.name_en`,
      [reminder],
    ),
    getTrips({ openOnly: true }),
  ]);

  const levelTone = { OUT_OF_STOCK: "red", BELOW_MIN: "red", RUNNING_LOW: "amber" } as const;

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      {sp.denied === "1" && (
        <div className="mb-4">
          <Alert tone="amber">{d.auth.forbidden}</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label={t.kpiItems} value={fmtNum(kpi?.items)} href={`/${locale}/inventory/items`} icon={Package} />
        <Stat label={t.kpiAlerts} value={fmtNum(alerts.length)} tone={alerts.length ? "red" : "green"} href="#stock-alerts" icon={AlertTriangle} />
        <Stat label={t.kpiDemands} value={fmtNum(kpi?.open_demands)} tone="violet" href={`/${locale}/demands`} icon={ClipboardList} />
        <Stat label={t.kpiKmMonth} value={fmtKm(kpi?.km_month)} tone="blue" href={`/${locale}/fleet/trips?from=${monthStart}`} icon={Truck} />
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card
          title={t.stockAlerts}
          subtitle={fmt(t.stockAlertsHint, { n: horizon })}
          bodyClassName="p-0"
          className="scroll-mt-20"
          actions={<LinkButton href={`/${locale}/inventory/stock-in`} variant="secondary" size="sm">{d.nav.stockIn}</LinkButton>}
        >
          <div id="stock-alerts" />
          <Table>
            <thead>
              <tr>
                <Th>{d.inventory.item}</Th>
                <Th numeric>{t.currentStock}</Th>
                <Th numeric>{t.minLevel}</Th>
                <Th numeric>{t.daysOfCover}</Th>
                <Th>{d.common.status}</Th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && <EmptyRow colSpan={5}>{t.noAlerts}</EmptyRow>}
              {alerts.map((a) => (
                <tr key={a.item_id}>
                  <Td>
                    <Link href={`/${locale}/inventory/items/${a.item_id}`} className="font-medium text-brand-700 hover:underline">
                      {nm(a, locale)}
                    </Link>
                    {a.avg_daily_out !== null && (
                      <div className="text-xs text-slate-500">
                        {t.avgDaily}: <span className="ltr-nums">{fmtNum(Math.round(a.avg_daily_out * 100) / 100)}</span> {ur ? a.unit_ur : a.unit_en}
                      </div>
                    )}
                  </Td>
                  <Td numeric>
                    <span className="ltr-nums font-semibold">{fmtNum(a.current_stock)}</span>{" "}
                    <span className="text-xs text-slate-400">{ur ? a.unit_ur : a.unit_en}</span>
                  </Td>
                  <Td numeric className="ltr-nums">{fmtNum(a.min_stock_level)}</Td>
                  <Td numeric className="ltr-nums">{a.days_of_cover === null ? "—" : fmtNum(a.days_of_cover)}</Td>
                  <Td>
                    <Badge tone={levelTone[a.alert_level]}>{t[a.alert_level]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card
          title={t.upcomingDemands}
          subtitle={fmt(t.upcomingDemandsHint, { n: reminder })}
          bodyClassName="p-0"
          actions={<LinkButton href={`/${locale}/demands`} variant="secondary" size="sm">{d.nav.demands}</LinkButton>}
        >
          <Table>
            <thead>
              <tr>
                <Th>{d.demands.demandNo}</Th>
                <Th>{d.inventory.item}</Th>
                <Th>{d.demands.requiredBy}</Th>
                <Th numeric>{t.pending}</Th>
                <Th numeric>{t.shortfall}</Th>
              </tr>
            </thead>
            <tbody>
              {demands.length === 0 && <EmptyRow colSpan={5}>{t.noDemands}</EmptyRow>}
              {demands.map((r, i) => (
                <tr key={i}>
                  <Td>
                    <Link href={`/${locale}/demands/${r.demand_sheet_id}`} className="ltr-nums font-medium whitespace-nowrap text-brand-700 hover:underline">
                      {r.demand_no}
                    </Link>
                    <div className="text-xs text-slate-500">{(ur ? r.dept_ur : r.dept_en) ?? ""}</div>
                  </Td>
                  <Td>{nm(r, locale)}</Td>
                  <Td>
                    <div className="ltr-nums">{fmtDate(r.required_by)}</div>
                    <DueBadge daysLeft={r.days_left} d={d} />
                  </Td>
                  <Td numeric>
                    <span className="ltr-nums">{fmtNum(r.qty_pending)}</span> <span className="text-xs text-slate-400">{ur ? r.unit_ur : r.unit_en}</span>
                  </Td>
                  <Td numeric className={r.shortfall > 0 ? "ltr-nums font-semibold text-red-600" : "ltr-nums text-slate-400"}>
                    {fmtNum(r.shortfall)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card
          title={t.vehiclesOut}
          className="xl:col-span-2"
          actions={<LinkButton href={`/${locale}/fleet/trips`} variant="secondary" size="sm">{d.nav.trips}</LinkButton>}
        >
          {out.length === 0 ? (
            <p className="text-sm text-slate-500">{t.noVehiclesOut}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {out.map((o) => (
                <li key={o.id} className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm">
                  <div className="ltr-nums font-semibold">{o.registration_no}</div>
                  <div>{o.driver_name} · {ur ? o.dept_ur : o.dept_en}</div>
                  <div className="text-slate-600">{o.purpose}</div>
                  <div className="text-xs text-slate-500">
                    {t.since}: <span className="ltr-nums">{fmtDateTime(o.departed_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
