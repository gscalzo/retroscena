/** Small pure formatters shared by the site, the Worker and the CLI. */

/** "The Confidence Gap!" → "the-confidence-gap". Empty when nothing survives. */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/** 7.5 → "7:30"; rounds to the second and carries a full minute. */
export function fmtMin(minutes: number): string {
  let mm = Math.floor(minutes);
  let ss = Math.round((minutes - mm) * 60);
  if (ss === 60) {
    mm += 1;
    ss = 0;
  }
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** ISO yyyy-mm-dd of an epoch, in UTC. */
export function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Whole days from today (an epoch) to an ISO date; negative once it has passed. */
export function daysUntil(date: string, nowMs: number): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${isoDate(nowMs)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-15" → "15 Sep 2026". Anything unparsable comes back as it was. */
export function fmtDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const month = MONTHS[Number(m[2]) - 1];
  return month === undefined ? date : `${Number(m[3])} ${month} ${m[1]}`;
}
