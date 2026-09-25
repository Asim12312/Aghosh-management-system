import { requireUser } from "@/lib/dal/auth";
import { getLastReadings } from "@/lib/dal/fleet";
import { driverOptions, getDepartments, getDrivers, getVehicles, namedOptions, vehicleOptions } from "@/lib/dal/lookups";
import { getDictionary, nowLocalInput, type Locale } from "@/lib/i18n";
import { TripForm } from "@/components/fleet-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function NewTripPage({ params }: PageProps<"/[locale]/fleet/trips/new">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const [vehicles, drivers, departments, lastReadings] = await Promise.all([getVehicles(), getDrivers(), getDepartments(), getLastReadings()]);
  return (
    <>
      <PageHeader title={d.fleet.newTrip} />
      <Card>
        <TripForm
          vehicles={vehicleOptions(vehicles)}
          drivers={driverOptions(drivers)}
          departments={namedOptions(departments, locale)}
          lastReadings={lastReadings}
          now={nowLocalInput()}
          isAdmin={user.role === "admin"}
        />
      </Card>
    </>
  );
}
