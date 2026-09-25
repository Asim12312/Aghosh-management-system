"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, tx, type Queryable } from "@/lib/db";
import { audit, requireAdmin, requireUser } from "@/lib/dal/auth";
import { fmt, fmtKm } from "@/lib/i18n";
import { getRequestDictionary } from "@/lib/i18n/server";
import { fail, fieldsFor, parseForm, success, type ActionState } from "@/lib/validation";

/** Highest odometer reading known for a vehicle, excluding one trip (when editing it). */
async function lastReading(q: Queryable, vehicleId: number, excludeTripId: number | null) {
  const [row] = await q.query<{ km: number }>(
    `SELECT GREATEST(
              (SELECT opening_odometer_km FROM vehicles WHERE id = $1),
              COALESCE((SELECT MAX(COALESCE(end_km, start_km)) FROM vehicle_trips WHERE vehicle_id = $1 AND id <> COALESCE($2, -1)), 0),
              COALESCE((SELECT MAX(odometer_km) FROM fuel_logs WHERE vehicle_id = $1), 0)
            ) AS km`,
    [vehicleId, excludeTripId],
  );
  return row?.km ?? 0;
}

export async function saveTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      id: f.optId,
      vehicle_id: f.id,
      driver_id: f.id,
      department_id: f.id,
      departed_at: f.datetime,
      returned_at: f.optDatetime,
      purpose: f.str,
      destination: f.optStr,
      start_km: f.nonNegNum,
      end_km: f.optNum,
      remarks: f.optStr,
      override_odometer: f.bool,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  if (v.id && user.role !== "admin") return fail(d.auth.forbidden);
  if (v.end_km !== null && v.end_km < v.start_km) return fail(d.validation.fixErrors, { end_km: d.fleet.endBeforeStart });
  if (v.returned_at && v.returned_at < v.departed_at) return fail(d.validation.fixErrors, { returned_at: d.fleet.timeBeforeStart });
  if ((v.end_km === null) !== (v.returned_at === null)) {
    return fail(d.validation.fixErrors, v.end_km === null ? { end_km: d.validation.required } : { returned_at: d.validation.required });
  }

  const result = await tx(async (q) => {
    await q.query("SELECT id FROM vehicles WHERE id = $1 FOR UPDATE", [v.vehicle_id]);
    const open = await q.query<{ id: number }>(
      "SELECT id FROM vehicle_trips WHERE vehicle_id = $1 AND end_km IS NULL AND id <> COALESCE($2, -1)",
      [v.vehicle_id, v.id],
    );
    if (open.length) return fail(d.validation.fixErrors, { vehicle_id: d.fleet.vehicleBusy });
    if (!v.id) {
      const last = await lastReading(q, v.vehicle_id, null);
      const canOverride = user.role === "admin" && v.override_odometer;
      if (v.start_km < last && !canOverride)
        return fail(d.validation.fixErrors, { start_km: fmt(d.fleet.odometerBehind, { n: fmtKm(last) }) });
    }
    const params = [
      v.vehicle_id,
      v.driver_id,
      v.department_id,
      v.departed_at,
      v.returned_at,
      v.purpose,
      v.destination,
      v.start_km,
      v.end_km,
      v.remarks,
    ];
    if (v.id) {
      await q.query(
        `UPDATE vehicle_trips SET vehicle_id=$1, driver_id=$2, department_id=$3, departed_at=$4::timestamptz,
                trip_date=($4::timestamptz)::date, returned_at=$5::timestamptz, purpose=$6, destination=$7, start_km=$8, end_km=$9, remarks=$10
          WHERE id=$11`,
        [...params, v.id],
      );
      await audit(user.id, "update", "vehicle_trips", v.id, v, q);
    } else {
      const [row] = await q.query<{ id: number }>(
        `INSERT INTO vehicle_trips (vehicle_id, driver_id, department_id, departed_at, trip_date, returned_at, purpose, destination,
                                    start_km, end_km, remarks, created_by)
         VALUES ($1,$2,$3,$4::timestamptz,($4::timestamptz)::date,$5::timestamptz,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [...params, user.id],
      );
      await audit(user.id, "create", "vehicle_trips", row.id, v, q);
    }
    return null;
  });
  if (result) return result;
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/fleet/trips?saved=1`);
}

export async function closeTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(z.object({ id: f.id, returned_at: f.datetime, end_km: f.nonNegNum }), formData, d);
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  const trip = await one<{ start_km: number; departed_local: string; end_km: number | null }>(
    `SELECT start_km, to_char(departed_at, 'YYYY-MM-DD"T"HH24:MI') AS departed_local, end_km FROM vehicle_trips WHERE id = $1`,
    [v.id],
  );
  if (!trip || trip.end_km !== null) return fail(d.common.unexpectedError);
  if (v.end_km < trip.start_km) return fail(d.validation.fixErrors, { end_km: d.fleet.endBeforeStart });
  if (v.returned_at < trip.departed_local) return fail(d.validation.fixErrors, { returned_at: d.fleet.timeBeforeStart });
  await one("UPDATE vehicle_trips SET end_km = $2, returned_at = $3::timestamptz WHERE id = $1 AND end_km IS NULL", [
    v.id,
    v.end_km,
    v.returned_at,
  ]);
  await audit(user.id, "close", "vehicle_trips", v.id, v);
  revalidatePath(`/${locale}`, "layout");
  return success(d.common.saved);
}

export async function recordFuel(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      vehicle_id: f.id,
      fill_date: f.date,
      odometer_km: f.nonNegNum,
      litres: f.posNum,
      amount: f.nonNegNum,
      is_full_tank: f.bool,
      fund_source_id: f.optId,
      receipt_no: f.optStr,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  const row = await one<{ id: number }>(
    `INSERT INTO fuel_logs (vehicle_id, fill_date, odometer_km, litres, amount, is_full_tank, fund_source_id, receipt_no, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [v.vehicle_id, v.fill_date, v.odometer_km, v.litres, v.amount, v.is_full_tank, v.fund_source_id, v.receipt_no, user.id],
  );
  await audit(user.id, "create", "fuel_logs", row!.id, v);
  revalidatePath(`/${locale}`, "layout");
  return success(d.common.saved);
}

export async function deleteFuel(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const id = Number(formData.get("id"));
  const row = await one<Record<string, unknown>>("DELETE FROM fuel_logs WHERE id = $1 RETURNING *", [id]);
  if (row) await audit(user.id, "delete", "fuel_logs", id, { ...row, reason: formData.get("reason") });
  revalidatePath(`/${locale}`, "layout");
  return success(d.common.saved);
}
