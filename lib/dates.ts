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
