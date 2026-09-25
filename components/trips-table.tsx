import Link from "next/link";
import type { TripRow } from "@/lib/dal/fleet";
import { fmtDate, fmtKm, fmtTime, getDictionary, type Locale } from "@/lib/i18n";
import { Badge, EmptyRow, Table, Td, Th } from "./ui";

export function TripsTable({ rows, locale, editable = false }: { rows: TripRow[]; locale: Locale; editable?: boolean }) {
  const d = getDictionary(locale);
  const t = d.fleet;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t.tripDate}</Th>
          <Th>{t.vehicle}</Th>
          <Th>{t.driver}</Th>
          <Th>{t.department}</Th>
          <Th>{t.purpose}</Th>
          <Th>{t.timeFrom} – {t.timeTo}</Th>
          <Th numeric>{t.startKm}</Th>
          <Th numeric>{t.endKm}</Th>
          <Th numeric>{t.distance}</Th>
          {editable && <Th />}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={10}>{d.common.noRecords}</EmptyRow>}
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="ltr-nums whitespace-nowrap">{fmtDate(r.trip_date)}</Td>
            <Td className="ltr-nums font-medium whitespace-nowrap">{r.registration_no}</Td>
            <Td>{r.driver_name}</Td>
            <Td>{locale === "ur" ? r.dept_ur : r.dept_en}</Td>
            <Td>
              {r.purpose}
              {r.destination && <div className="text-xs text-slate-500">{r.destination}</div>}
            </Td>
            <Td className="whitespace-nowrap">
              <span className="ltr-nums">{fmtTime(r.departed_at)}</span> –{" "}
              {r.returned_at ? <span className="ltr-nums">{fmtTime(r.returned_at)}</span> : <Badge tone="amber">{t.inProgress}</Badge>}
            </Td>
            <Td numeric className="ltr-nums">{fmtKm(r.start_km)}</Td>
            <Td numeric className="ltr-nums">{fmtKm(r.end_km)}</Td>
            <Td numeric className="ltr-nums font-semibold">{fmtKm(r.distance_km)}</Td>
            {editable && (
              <Td className="text-end">
                <Link href={`/${locale}/fleet/trips/${r.id}/edit`} className="text-xs text-brand-700 hover:underline">
                  {d.common.edit}
                </Link>
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
