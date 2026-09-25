import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal/auth";
import { one } from "@/lib/db";
import { getLastReadings } from "@/lib/dal/fleet";
import { driverOptions, getDepartments, getDrivers, getVehicles, namedOptions, vehicleOptions } from "@/lib/dal/lookups";
import { getDictionary, nowLocalInput, type Locale } from "@/lib/i18n";
import { TripForm, type TripValues } from "@/components/fleet-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function EditTripPage({ params }: PageProps<"/[locale]/fleet/trips/[id]/edit">) {
  await requireAdmin();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const trip = await one<TripValues>(
    `SELECT id, vehicle_id, driver_id, department_id, purpose, destination, start_km, end_km, remarks,
            to_char(departed_at, 'YYYY-MM-DD"T"HH24:MI') AS departed_local,
            to_char(returned_at, 'YYYY-MM-DD"T"HH24:MI') AS returned_local
       FROM vehicle_trips WHERE id = $1`,
    [Number(id)],
  );
  if (!trip) notFound();
  const d = getDictionary(locale);
  const [vehicles, drivers, departments, lastReadings] = await Promise.all([
    getVehicles(false),
    getDrivers(false),
    getDepartments(false),
    getLastReadings(),
  ]);
  return (
    <>
      <PageHeader title={`${d.common.edit}: ${d.fleet.tripsTitle}`} />
      <Card>
        <TripForm
          trip={trip}
          vehicles={vehicleOptions(vehicles)}
          drivers={driverOptions(drivers)}
          departments={namedOptions(departments, locale)}
          lastReadings={lastReadings}
          now={nowLocalInput()}
          isAdmin
        />
      </Card>
    </>
  );
}
