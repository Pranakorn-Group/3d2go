// The shop runs on Bangkok time (UTC+7, no DST) regardless of where the server runs.
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function startOfTodayBkk(now = new Date()) {
  const local = new Date(now.getTime() + BKK_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BKK_OFFSET_MS);
}

export function startOfMonthBkk(now = new Date()) {
  const local = new Date(now.getTime() + BKK_OFFSET_MS);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BKK_OFFSET_MS);
}

/** "YYMM" / "YYMMDD" in Bangkok time, for document codes. */
export function bkkStamp(withDay: boolean, now = new Date()) {
  const d = new Date(now.getTime() + BKK_OFFSET_MS);
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return withDay ? `${yy}${mm}${dd}` : `${yy}${mm}`;
}

/** Midnight Bangkok time of a "YYYY-MM-DD" date, as the UTC instant it corresponds to. */
export function startOfDayBkk(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - BKK_OFFSET_MS);
}

export function addDaysBkk(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/** The date `d` falls on in Bangkok time, as "YYYY-MM-DD" — for date inputs and day-bucket keys. */
export function toBkkDateParam(d: Date) {
  const local = new Date(d.getTime() + BKK_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

export const DATE_RANGE_PRESETS = ["today", "7d", "30d", "month", "custom"] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export type DateRange = { preset: DateRangePreset; from: Date; toExclusive: Date; label: string };

/**
 * Resolves the dashboard's selected range. `custom` needs both `from`/`to` ("YYYY-MM-DD", inclusive);
 * falls back to "month" (the previous default) if the preset is unknown or custom dates are missing/invalid.
 */
export function resolveDateRange(preset: string | undefined, from: string | undefined, to: string | undefined, now = new Date()): DateRange {
  const today = startOfTodayBkk(now);
  const tomorrow = addDaysBkk(today, 1);

  if (preset === "today") return { preset: "today", from: today, toExclusive: tomorrow, label: "Today" };
  if (preset === "7d") return { preset: "7d", from: addDaysBkk(today, -6), toExclusive: tomorrow, label: "Last 7 days" };
  if (preset === "30d") return { preset: "30d", from: addDaysBkk(today, -29), toExclusive: tomorrow, label: "Last 30 days" };
  if (preset === "custom" && from && to) {
    const start = startOfDayBkk(from);
    const endExclusive = addDaysBkk(startOfDayBkk(to), 1);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(endExclusive.getTime()) && endExclusive > start) {
      return { preset: "custom", from: start, toExclusive: endExclusive, label: formatRangeLabel(start, endExclusive) };
    }
  }
  return { preset: "month", from: startOfMonthBkk(now), toExclusive: tomorrow, label: "This month" };
}

function formatRangeLabel(from: Date, toExclusive: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return `${fmt(from)} – ${fmt(addDaysBkk(toExclusive, -1))}`;
}

/** The immediately preceding period of the same length — for period-over-period comparisons. */
export function previousPeriod({ from, toExclusive }: Pick<DateRange, "from" | "toExclusive">) {
  const length = toExclusive.getTime() - from.getTime();
  return { from: new Date(from.getTime() - length), toExclusive: from };
}
