import { fmt, type Dictionary } from "@/lib/i18n";
import { Badge } from "./ui";

/** "Overdue 2 d" / "Due today" / "In 3 d" for a required-by date. */
export function DueBadge({ daysLeft, d }: { daysLeft: number; d: Dictionary }) {
  if (daysLeft < 0) return <Badge tone="red">{fmt(d.dashboard.overdue, { n: -daysLeft })}</Badge>;
  if (daysLeft === 0) return <Badge tone="red">{d.dashboard.dueToday}</Badge>;
  return <Badge tone={daysLeft <= 3 ? "amber" : "gray"}>{fmt(d.dashboard.dueIn, { n: daysLeft })}</Badge>;
}
