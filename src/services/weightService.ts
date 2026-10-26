/**
 * Scale weight logs and the 7-day moving average (see PRD.md §4 module 4, Architecture.md §4B).
 *
 * One weight per local `logged_date`. The moving average is visual context only; nothing
 * here adjusts targets or calorie estimates from the trend.
 */
import type { DbConnection } from '@/db/client';
import type { WeightLogRow } from '@/db/schema';
import { addDaysToLocalDate, isValidLocalDateString, type LocalDateString } from '@/utils/dateUtils';

export interface WeightLog {
  id: number;
  loggedDate: LocalDateString;
  weightKg: number;
}

export interface WeightLogInput {
  loggedDate: LocalDateString;
  weightKg: number;
}

export interface WeightTrendPoint {
  loggedDate: LocalDateString;
  weightKg: number;
  /** Mean of every log in the 7 calendar days ending on `loggedDate` (inclusive). */
  movingAverageKg: number;
  /** How many logs that mean covers (1–7); low counts mean a less reliable trend. */
  sampleCount: number;
}

export const MOVING_AVERAGE_WINDOW_DAYS = 7;
export const MAX_WEIGHT_KG = 500;

export class WeightValidationError extends Error {
  constructor(
    readonly field: keyof WeightLogInput,
    message: string,
  ) {
    super(message);
    this.name = 'WeightValidationError';
  }
}

/** Thrown when an edit would move a log onto a date that already has one. */
export class DuplicateWeightDateError extends Error {
  constructor(readonly loggedDate: LocalDateString) {
    super(`A weight is already logged for ${loggedDate}. Edit or delete that entry instead.`);
    this.name = 'DuplicateWeightDateError';
  }
}

/** All weight logs, oldest first. */
export async function getWeightLogs(db: DbConnection): Promise<WeightLog[]> {
  const rows = await db.getAllAsync<WeightLogRow>('SELECT * FROM weight_logs ORDER BY logged_date ASC', []);
  return rows.map(toWeightLog);
}

/**
 * Logs a weight for a date, replacing any existing log for that same date
 * (re-weighing on the same day keeps the latest reading).
 */
export async function saveWeightLog(db: DbConnection, input: WeightLogInput): Promise<WeightLog> {
  const { loggedDate, weightKg } = validateWeightInput(input);
  await db.runAsync(
    `INSERT INTO weight_logs (logged_date, weight_kg) VALUES (?, ?)
     ON CONFLICT(logged_date) DO UPDATE SET weight_kg = excluded.weight_kg`,
    [loggedDate, weightKg],
  );
  const row = await db.getFirstAsync<WeightLogRow>('SELECT * FROM weight_logs WHERE logged_date = ?', [loggedDate]);
  if (!row) throw new Error(`Weight log for ${loggedDate} was not saved.`);
  return toWeightLog(row);
}

/** Edits an existing log's date and/or weight. Returns `null` if it no longer exists. */
export async function updateWeightLog(db: DbConnection, id: number, input: WeightLogInput): Promise<WeightLog | null> {
  const { loggedDate, weightKg } = validateWeightInput(input);
  const clash = await db.getFirstAsync<WeightLogRow>('SELECT * FROM weight_logs WHERE logged_date = ? AND id != ?', [
    loggedDate,
    id,
  ]);
  if (clash) throw new DuplicateWeightDateError(loggedDate);

  const result = await db.runAsync('UPDATE weight_logs SET logged_date = ?, weight_kg = ? WHERE id = ?', [
    loggedDate,
    weightKg,
    id,
  ]);
  if (result.changes === 0) return null;
  return { id, loggedDate, weightKg };
}

/** Returns `true` if a log was deleted. */
export async function deleteWeightLog(db: DbConnection, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM weight_logs WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * The most recent weight logged on or before `date` — never a later one (ADR-004).
 * Returns `null` if there is none, so callers can leave calorie estimates empty.
 */
export async function getLatestWeightOnOrBefore(db: DbConnection, date: LocalDateString): Promise<WeightLog | null> {
  if (!isValidLocalDateString(date)) {
    throw new WeightValidationError('loggedDate', `Invalid date "${date}". Use YYYY-MM-DD.`);
  }
  const row = await db.getFirstAsync<WeightLogRow>(
    'SELECT * FROM weight_logs WHERE logged_date <= ? ORDER BY logged_date DESC LIMIT 1',
    [date],
  );
  return row ? toWeightLog(row) : null;
}

/**
 * Adds a trailing 7-calendar-day moving average to each log. The window is by date, not by
 * entry count, so gaps in logging shrink the sample instead of stretching the window.
 * Input may be in any order; output is oldest first.
 */
export function computeWeightTrend(logs: readonly WeightLogInput[]): WeightTrendPoint[] {
  const sorted = [...logs].sort((a, b) => a.loggedDate.localeCompare(b.loggedDate));
  const points: WeightTrendPoint[] = [];
  let windowStart = 0;
  let windowSum = 0;

  for (let i = 0; i < sorted.length; i++) {
    const { loggedDate, weightKg } = sorted[i];
    windowSum += weightKg;
    // YYYY-MM-DD strings compare correctly as text.
    const earliestIncluded = addDaysToLocalDate(loggedDate, -(MOVING_AVERAGE_WINDOW_DAYS - 1));
    while (sorted[windowStart].loggedDate < earliestIncluded) {
      windowSum -= sorted[windowStart].weightKg;
      windowStart++;
    }
    const sampleCount = i - windowStart + 1;
    points.push({ loggedDate, weightKg, movingAverageKg: windowSum / sampleCount, sampleCount });
  }
  return points;
}

/**
 * Parses a weight text field (kg). Accepts a comma as the decimal separator.
 * Throws `WeightValidationError` for empty or invalid input.
 */
export function parseWeightInput(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new WeightValidationError('weightKg', 'Enter a weight in kg, e.g. 75.4.');
  }
  return validateWeightKg(Number(normalized));
}

function validateWeightInput(input: WeightLogInput): WeightLogInput {
  if (!isValidLocalDateString(input.loggedDate)) {
    throw new WeightValidationError('loggedDate', `Invalid date "${input.loggedDate}". Use YYYY-MM-DD.`);
  }
  return { loggedDate: input.loggedDate, weightKg: validateWeightKg(input.weightKg) };
}

function validateWeightKg(weightKg: number): number {
  // Scales report to 0.1 kg; storing more precision only adds float noise.
  const rounded = Math.round(weightKg * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new WeightValidationError('weightKg', 'Weight must be greater than 0 kg.');
  }
  if (rounded > MAX_WEIGHT_KG) {
    throw new WeightValidationError('weightKg', `Weight must be ${MAX_WEIGHT_KG} kg or less.`);
  }
  return rounded;
}

function toWeightLog(row: WeightLogRow): WeightLog {
  return { id: row.id, loggedDate: row.logged_date, weightKg: row.weight_kg };
}
