"use client";

import { recordAdjustment, recordStockIn, recordStockOut, saveItem } from "@/lib/actions/inventory";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField, type Option } from "./forms";
import { FormGrid, LinkButton } from "./ui";

export function ItemForm({
  item,
  categories,
  units,
  vendors,
  canEditThresholds,
}: {
  item?: Record<string, unknown>;
  categories: Option[];
  units: Option[];
  vendors: Option[];
  canEditThresholds: boolean;
}) {
  const { locale, d } = useI18n();
  const t = d.inventory;
  const val = (k: string) => (item?.[k] === null || item?.[k] === undefined ? undefined : String(item[k]));
  const lockThresholds = Boolean(item) && !canEditThresholds;
  return (
    <ActionForm action={saveItem} className="space-y-5">
      {item && <input type="hidden" name="id" value={String(item.id)} />}
      <FormGrid cols={3}>
        <TextField name="name_en" label={d.common.nameEn} required defaultValue={val("name_en")} dir="ltr" />
        <TextField name="name_ur" label={d.common.nameUr} required defaultValue={val("name_ur")} dir="rtl" lang="ur" />
        <SelectField name="category_id" label={t.category} required options={categories} defaultValue={val("category_id")} />
        <SelectField name="unit_id" label={t.unit} required options={units} defaultValue={val("unit_id")} />
        <SelectField name="default_vendor_id" label={t.defaultVendor} options={vendors} defaultValue={val("default_vendor_id")} />
        <TextField
          name="min_stock_level"
          label={t.minStock}
          hint={t.minStockHint}
          inputMode="decimal"
          defaultValue={val("min_stock_level") ?? "0"}
          disabled={lockThresholds}
        />
        <TextField
          name="lead_time_days"
          label={t.leadTime}
          hint={t.leadTimeHint}
          inputMode="numeric"
          defaultValue={val("lead_time_days") ?? "2"}
          disabled={lockThresholds}
        />
        <TextField name="reorder_qty" label={t.reorderQty} inputMode="decimal" defaultValue={val("reorder_qty")} />
        <CheckboxField name="is_perishable" label={t.perishable} defaultChecked={item?.is_perishable === true} />
        {item && (
          <CheckboxField name="is_active" label={d.common.active} defaultChecked={item.is_active !== false} />
        )}
        {!item && <input type="hidden" name="is_active" value="on" />}
      </FormGrid>
      <TextareaField name="notes" label={d.common.notes} defaultValue={val("notes")} />
      <div className="flex gap-2">
        <SubmitButton>{d.common.save}</SubmitButton>
        <LinkButton href={`/${locale}/inventory/items`} variant="secondary">
          {d.common.cancel}
        </LinkButton>
      </div>
    </ActionForm>
  );
}

export function StockInForm({
  items,
  sources,
  vendors,
  today,
  defaultItem,
}: {
  items: Option[];
  sources: Option[];
  vendors: Option[];
  today: string;
  defaultItem?: string;
}) {
  const { d } = useI18n();
  const t = d.inventory;
  return (
    <ActionForm action={recordStockIn} className="space-y-5" resetOnSuccess>
      <FormGrid cols={3}>
        <SelectField name="item_id" label={t.item} required options={items} defaultValue={defaultItem} wrapperClassName="sm:col-span-2" />
        <TextField name="txn_date" label={d.common.date} type="date" required defaultValue={today} max={today} />
        <TextField name="quantity" label={d.common.quantity} inputMode="decimal" required />
        <SelectField name="fund_source_id" label={t.source} required options={sources} />
        <SelectField name="vendor_id" label={t.vendor} options={vendors} />
        <TextField name="donor_name" label={t.donor} />
        <TextField name="unit_cost" label={t.unitCost} inputMode="decimal" />
        <TextField name="reference_no" label={t.reference} dir="ltr" />
        <TextField name="expiry_date" label={t.expiry} type="date" />
        <TextField name="remarks" label={d.common.remarks} wrapperClassName="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function StockOutForm({
  items,
  departments,
  demandLines,
  today,
  defaultItem,
}: {
  items: Option[];
  departments: Option[];
  demandLines: Option[];
  today: string;
  defaultItem?: string;
}) {
  const { d } = useI18n();
  const t = d.inventory;
  return (
    <ActionForm action={recordStockOut} className="space-y-5" resetOnSuccess>
      <FormGrid cols={3}>
        <SelectField name="item_id" label={t.item} required options={items} defaultValue={defaultItem} wrapperClassName="sm:col-span-2" />
        <TextField name="txn_date" label={d.common.date} type="date" required defaultValue={today} max={today} />
        <TextField name="quantity" label={d.common.quantity} inputMode="decimal" required />
        <SelectField name="department_id" label={t.department} required options={departments} />
        <TextField name="issued_to" label={t.issuedTo} />
        {demandLines.length > 0 && (
          <SelectField
            name="demand_item_id"
            label={t.demandLine}
            hint={t.demandLineHint}
            options={demandLines}
            wrapperClassName="sm:col-span-2"
          />
        )}
        <TextField name="remarks" label={d.common.remarks} wrapperClassName={demandLines.length > 0 ? "" : "sm:col-span-2"} />
      </FormGrid>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function AdjustForm({ items, today }: { items: Option[]; today: string }) {
  const { d } = useI18n();
  const t = d.inventory;
  return (
    <ActionForm action={recordAdjustment} className="space-y-5" resetOnSuccess>
      <FormGrid cols={3}>
        <SelectField name="item_id" label={t.item} required options={items} wrapperClassName="sm:col-span-2" />
        <TextField name="txn_date" label={d.common.date} type="date" required defaultValue={today} max={today} />
        <TextField name="quantity" label={d.common.quantity} hint={t.adjustHint} inputMode="decimal" required />
        <TextField name="remarks" label={d.common.reason} required wrapperClassName="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}
