import "server-only";
import { getCategories, getDepartments, getFundSources, getItemOptions, getVehicles } from "./lookups";
import type { ReportLookups } from "@/components/report-view";

export async function getReportLookups(): Promise<ReportLookups> {
  const [vehicles, departments, items, categories, sources] = await Promise.all([
    getVehicles(false),
    getDepartments(false),
    getItemOptions(false),
    getCategories(false),
    getFundSources(false),
  ]);
  return { vehicles, departments, items, categories, sources };
}
