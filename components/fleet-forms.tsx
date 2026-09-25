"use client";

import { useState } from "react";
import { closeTrip, recordFuel, saveTrip } from "@/lib/actions/fleet";
import { fmt, fmtKm } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField, type Option } from "./forms";
import { FormGrid, LinkButton } from "./ui";

export type TripValues = {
  id: number;
  vehicle_id: number;
  driver_id: number;
  department_id: number;
  departed_local: string;
  returned_local: string | null;
  purpose: string;
  destination: string | null;
  start_km: number;
  end_km: number | null;
  remarks: string | null;
};

export function TripForm({
  trip,
  vehicles,
  drivers,
  departments,
  lastReadings,
  now,
  isAdmin,
}: {
  trip?: TripValues;
  vehicles: Option[];
  drivers: Option[];
  departments: Option[];
  lastReadings: Record<string, number>;
  now: string;
  isAdmin: boolean;
}) {
  const { locale, d } = useI18n();
  const t = d.fleet;
  const [vehicle, setVehicle] = useState(trip ? String(trip.vehicle_id) : "");
  const [startKm, setStartKm] = useState(trip ? String(trip.start_km) : "");
  const [endKm, setEndKm] = useState(trip?.end_km !== null && trip?.end_km !== undefined ? String(trip.end_km) : "");
  const last = vehicle ? lastReadings[vehicle] : undefined;
  const distance = startKm && endKm && Number(endKm) >= Number(startKm) ? Number(endKm) - Number(startKm) : null;

  return (
    <ActionForm action={saveTrip} className="space-y-5">
      {trip && <input type="hidden" name="id" value={trip.id} />}
      <FormGrid cols={3}>
        <SelectField
          name="vehicle_id"
          label={t.vehicle}
          required
          options={vehicles}
          value={vehicle}
          onChange={(e) => {
            setVehicle(e.target.value);
            const reading = lastReadings[e.target.value];
            if (!trip && reading !== undefined) setStartKm(String(reading));
          }}
          hint={last !== undefined ? fmt(t.lastOdometer, { n: fmtKm(last) }) : undefined}
        />
        <SelectField name="driver_id" label={t.driver} required options={drivers} defaultValue={trip?.driver_id} />
        <SelectField name="department_id" label={t.department} required options={departments} defaultValue={trip?.department_id} />
        <TextField name="purpose" label={t.purpose} required defaultValue={trip?.purpose} wrapperClassName="sm:col-span-2" />
        <TextField name="destination" label={t.destination} defaultValue={trip?.destination ?? undefined} />
        <TextField name="departed_at" label={t.timeFrom} type="datetime-local" required defaultValue={trip?.departed_local ?? now} />
        <TextField name="start_km" label={t.startKm} inputMode="decimal" required value={startKm} onChange={(e) => setStartKm(e.target.value)} />
        {isAdmin && !trip && <CheckboxField name="override_odometer" label={t.overrideOdometer} />}
        <TextField
          name="returned_at"
          label={t.timeTo}
          type="datetime-local"
          defaultValue={trip?.returned_local ?? undefined}
          hint={d.common.optional}
        />
        <TextField
          name="end_km"
          label={t.endKm}
          inputMode="decimal"
          value={endKm}
          onChange={(e) => setEndKm(e.target.value)}
          hint={distance !== null ? `${t.distance}: ${fmtKm(distance)}` : d.common.optional}
        />
        <TextField name="remarks" label={d.common.remarks} defaultValue={trip?.remarks ?? undefined} />
      </FormGrid>
      <div className="flex gap-2">
        <SubmitButton>{d.common.save}</SubmitButton>
        <LinkButton href={`/${locale}/fleet/trips`} variant="secondary">
          {d.common.cancel}
        </LinkButton>
      </div>
    </ActionForm>
  );
}

export function CloseTripForm({ id, startKm, now }: { id: number; startKm: number; now: string }) {
  const { d } = useI18n();
  const [endKm, setEndKm] = useState("");
  const distance = endKm && Number(endKm) >= startKm ? Number(endKm) - startKm : null;
  return (
    <ActionForm action={closeTrip} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <TextField name="returned_at" label={d.fleet.timeTo} type="datetime-local" defaultValue={now} />
      <TextField
        name="end_km"
        label={d.fleet.endKm}
        inputMode="decimal"
        value={endKm}
        onChange={(e) => setEndKm(e.target.value)}
        wrapperClassName="w-40"
        hint={distance !== null ? `${d.fleet.distance}: ${fmtKm(distance)}` : undefined}
      />
      <SubmitButton size="sm" className="mb-0.5">{d.fleet.closeTrip}</SubmitButton>
    </ActionForm>
  );
}

export function FuelForm({ vehicles, sources, today }: { vehicles: Option[]; sources: Option[]; today: string }) {
  const { d } = useI18n();
  const t = d.fleet;
  return (
    <ActionForm action={recordFuel} className="space-y-5" resetOnSuccess>
      <FormGrid cols={4}>
        <SelectField name="vehicle_id" label={t.vehicle} required options={vehicles} />
        <TextField name="fill_date" label={t.fillDate} type="date" required defaultValue={today} max={today} />
        <TextField name="odometer_km" label={t.odometer} inputMode="decimal" required />
        <TextField name="litres" label={t.litres} inputMode="decimal" required />
        <TextField name="amount" label={t.amount} inputMode="decimal" required />
        <SelectField name="fund_source_id" label={t.source} options={sources} />
        <TextField name="receipt_no" label={t.receiptNo} dir="ltr" />
        <CheckboxField name="is_full_tank" label={t.fullTank} defaultChecked />
      </FormGrid>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}
