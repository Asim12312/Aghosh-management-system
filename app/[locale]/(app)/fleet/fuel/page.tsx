import { requireUser } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { deleteFuel } from "@/lib/actions/fleet";
import { getFundSources, getVehicles, namedOptions, vehicleOptions } from "@/lib/dal/lookups";
import { fmtDate, fmtKm, fmtMoney, getDictionary, todayISO, type Locale } from "@/lib/i18n";
import { FuelForm } from "@/components/fleet-forms";
import { InlineActionForm } from "@/components/forms";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function FuelPage({ params }: PageProps<"/[locale]/fleet/fuel">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const t = d.fleet;
  const isAdmin = user.role === "admin";
  const [vehicles, sources, rows] = await Promise.all([
    getVehicles(),
    getFundSources(),
    query<{
      id: number;
      fill_date: string;
      registration_no: string;
      odometer_km: number;
      litres: number;
      amount: number;
      is_full_tank: boolean;
      receipt_no: string | null;
      source_en: string | null;
      source_ur: string | null;
      created_by_name: string;
    }>(
      `SELECT f.id, f.fill_date, v.registration_no, f.odometer_km, f.litres, f.amount, f.is_full_tank, f.receipt_no,
              fs.name_en AS source_en, fs.name_ur AS source_ur, u.full_name AS created_by_name
         FROM fuel_logs f JOIN vehicles v ON v.id = f.vehicle_id JOIN users u ON u.id = f.created_by
         LEFT JOIN fund_sources fs ON fs.id = f.fund_source_id
        ORDER BY f.fill_date DESC, f.id DESC LIMIT 100`,
    ),
  ]);
  return (
    <>
      <PageHeader title={t.fuelTitle} subtitle={t.fuelSubtitle} />
      <Card className="mb-6">
        <FuelForm vehicles={vehicleOptions(vehicles)} sources={namedOptions(sources, locale)} today={todayISO()} />
      </Card>
      <Card title={d.inventory.recent} bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>{t.fillDate}</Th>
              <Th>{t.vehicle}</Th>
              <Th numeric>{t.odometer}</Th>
              <Th numeric>{t.litres}</Th>
              <Th numeric>{t.amount}</Th>
              <Th numeric>Rs / L</Th>
              <Th>{t.source}</Th>
              <Th>{t.receiptNo}</Th>
              {isAdmin && <Th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={9}>{d.common.noRecords}</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="ltr-nums">{fmtDate(r.fill_date)}</Td>
                <Td className="ltr-nums font-medium">
                  {r.registration_no} {r.is_full_tank && <Badge tone="blue">{t.fullTank}</Badge>}
                </Td>
                <Td numeric className="ltr-nums">{fmtKm(r.odometer_km)}</Td>
                <Td numeric className="ltr-nums">{fmtMoney(r.litres)}</Td>
                <Td numeric className="ltr-nums">{fmtMoney(r.amount)}</Td>
                <Td numeric className="ltr-nums">{fmtMoney(r.amount / r.litres)}</Td>
                <Td>{(locale === "ur" ? r.source_ur : r.source_en) ?? "—"}</Td>
                <Td className="ltr-nums text-xs">{r.receipt_no ?? "—"}</Td>
                {isAdmin && (
                  <Td className="text-end">
                    <InlineActionForm
                      action={deleteFuel}
                      hidden={{ id: r.id }}
                      buttonLabel="✕"
                      fieldName="reason"
                      fieldLabel={d.common.reason}
                      submitLabel={d.inventory.void}
                    />
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
