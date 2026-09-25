import "server-only";
import { query } from "@/lib/db";

export type TripRow = {
  id: number;
  trip_date: string;
  vehicle_id: number;
  registration_no: string;
  driver_name: string;
  dept_en: string;
  dept_ur: string;
  purpose: string;
  destination: string | null;
  departed_at: Date;
  returned_at: Date | null;
  start_km: number;
  end_km: number | null;
  distance_km: number | null;
  remarks: string | null;
};

export type TripFilters = {
  from?: string;
  to?: string;
  vehicleId?: number;
  departmentId?: number;
  minKm?: number;
  maxKm?: number;
  openOnly?: boolean;
  limit?: number;
};

export async function getTrips(f: TripFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replaceAll("?", `$${params.length}`));
  };
  if (f.from) add("t.trip_date >= ?", f.from);
  if (f.to) add("t.trip_date <= ?", f.to);
  if (f.vehicleId) add("t.vehicle_id = ?", f.vehicleId);
  if (f.departmentId) add("t.department_id = ?", f.departmentId);
  if (f.minKm !== undefined) add("t.distance_km >= ?", f.minKm);
  if (f.maxKm !== undefined) add("t.distance_km <= ?", f.maxKm);
  if (f.openOnly) where.push("t.end_km IS NULL");
  params.push(f.limit ?? 1000);
  return query<TripRow>(
    `SELECT t.id, t.trip_date, t.vehicle_id, v.registration_no, dr.full_name AS driver_name, dp.name_en AS dept_en, dp.name_ur AS dept_ur,
            t.purpose, t.destination, t.departed_at, t.returned_at, t.start_km, t.end_km, t.distance_km, t.remarks
       FROM vehicle_trips t
       JOIN vehicles v ON v.id = t.vehicle_id
       JOIN drivers dr ON dr.id = t.driver_id
       JOIN departments dp ON dp.id = t.department_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY t.departed_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

/** Latest known odometer reading per vehicle (opening reading, trips and fuel fills). */
export async function getLastReadings(): Promise<Record<string, number>> {
  const rows = await query<{ id: number; km: number }>(
    `SELECT v.id, GREATEST(v.opening_odometer_km,
                           COALESCE(MAX(COALESCE(t.end_km, t.start_km)), 0),
                           COALESCE((SELECT MAX(odometer_km) FROM fuel_logs f WHERE f.vehicle_id = v.id), 0)) AS km
       FROM vehicles v LEFT JOIN vehicle_trips t ON t.vehicle_id = v.id
      GROUP BY v.id`,
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.km]));
}
