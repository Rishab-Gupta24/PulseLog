/**
 * Canonical local-timezone date helpers (see Architecture.md §4A, ADR-006).
 *
 * Every `workout_date` / `logged_date` is a `YYYY-MM-DD` string in the device's
 * local timezone. Never derive one with `toISOString().slice(0, 10)`: that is the
 * UTC calendar day and shifts the date near midnight in non-UTC timezones.
 */

/** A local calendar date in `YYYY-MM-DD` form. */
export type LocalDateString = string;

/** Local midnight-to-midnight bounds of one calendar day. */
export interface LocalDayBounds {
  /** 00:00:00.000 local time. */
  start: Date;
  /** 23:59:59.999 local time. */
  end: Date;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDateString(date: Date = new Date()): LocalDateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` string to local midnight of that day.
 * Returns `null` for malformed strings and impossible dates such as `2026-02-30`.
 */
export function parseLocalDateString(value: string): Date | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  // new Date() silently rolls overflow forward (Feb 30 -> Mar 2), so round-trip to reject it.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isValidLocalDateString(value: string): boolean {
  return parseLocalDateString(value) !== null;
}

/**
 * Calendar-day arithmetic on `YYYY-MM-DD` strings. Works in UTC internally so a 23- or
 * 25-hour DST day still counts as exactly one day.
 */
export function addDaysToLocalDate(value: LocalDateString, days: number): LocalDateString {
  const shifted = new Date(toUtcDayMs(value) + days * MS_PER_DAY);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function diffLocalDays(from: LocalDateString, to: LocalDateString): number {
  return Math.round((toUtcDayMs(to) - toUtcDayMs(from)) / MS_PER_DAY);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDayMs(value: LocalDateString): number {
  const date = parseLocalDateString(value);
  if (!date) {
    throw new Error(`Invalid local date string: "${value}" (expected YYYY-MM-DD)`);
  }
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local day bounds used when querying HealthKit / Health Connect for a day's steps. */
export function getLocalDayBounds(value: LocalDateString): LocalDayBounds {
  const start = parseLocalDateString(value);
  if (!start) {
    throw new Error(`Invalid local date string: "${value}" (expected YYYY-MM-DD)`);
  }
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return { start, end };
}
