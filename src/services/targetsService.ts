/**
 * Optional, user-chosen daily targets (see PRD.md §3, Rules.md §1.6, ADR-003).
 *
 * Every target is nullable and independent: users may set all, some or none. Nothing
 * here derives or adjusts a target automatically.
 */
import type { DbConnection } from '@/db/client';
import type { UserTargetsRow } from '@/db/schema';

export type TargetKey =
  | 'daily_calorie_target'
  | 'daily_protein_g'
  | 'daily_carbs_g'
  | 'daily_fat_g'
  | 'daily_steps_target';

/** `null` means the user has not set (or has cleared) that target. */
export type UserTargets = Record<TargetKey, number | null>;

export interface TargetField {
  key: TargetKey;
  label: string;
  unit: string;
  /** Smallest allowed value, matching the schema CHECK constraint. */
  min: 0 | 1;
}

/** Display order and validation rules for each target. */
export const TARGET_FIELDS: readonly TargetField[] = [
  { key: 'daily_calorie_target', label: 'Calories', unit: 'kcal', min: 1 },
  { key: 'daily_protein_g', label: 'Protein', unit: 'g', min: 0 },
  { key: 'daily_carbs_g', label: 'Carbs', unit: 'g', min: 0 },
  { key: 'daily_fat_g', label: 'Fat', unit: 'g', min: 0 },
  { key: 'daily_steps_target', label: 'Steps', unit: 'steps', min: 1 },
];

const TARGET_KEYS: readonly TargetKey[] = TARGET_FIELDS.map((field) => field.key);

export const EMPTY_TARGETS: UserTargets = {
  daily_calorie_target: null,
  daily_protein_g: null,
  daily_carbs_g: null,
  daily_fat_g: null,
  daily_steps_target: null,
};

export class TargetValidationError extends Error {
  constructor(
    readonly key: TargetKey,
    message: string,
  ) {
    super(message);
    this.name = 'TargetValidationError';
  }
}

/** Returns the current targets; all `null` if the user never set any. */
export async function getTargets(db: DbConnection): Promise<UserTargets> {
  const row = await db.getFirstAsync<UserTargetsRow>('SELECT * FROM user_targets WHERE id = 1', []);
  if (!row) return { ...EMPTY_TARGETS };
  return {
    daily_calorie_target: row.daily_calorie_target,
    daily_protein_g: row.daily_protein_g,
    daily_carbs_g: row.daily_carbs_g,
    daily_fat_g: row.daily_fat_g,
    daily_steps_target: row.daily_steps_target,
  };
}

/**
 * Sets the given targets and leaves omitted ones unchanged. Pass `null` to clear one.
 * Throws `TargetValidationError` before writing if any value is invalid.
 */
export async function setTargets(
  db: DbConnection,
  updates: Partial<UserTargets>,
  now: Date = new Date(),
): Promise<UserTargets> {
  const keys = TARGET_KEYS.filter((key) => updates[key] !== undefined);
  for (const key of keys) validateTarget(key, updates[key] ?? null);

  if (keys.length > 0) {
    const values = keys.map((key) => updates[key] ?? null);
    const updatedAt = now.toISOString();
    // Keys come from TARGET_KEYS, never from input, so interpolating column names is safe.
    await db.runAsync(
      `INSERT INTO user_targets (id, ${keys.join(', ')}, updated_at)
       VALUES (1, ${keys.map(() => '?').join(', ')}, ?)
       ON CONFLICT(id) DO UPDATE SET ${keys.map((key) => `${key} = excluded.${key}`).join(', ')},
         updated_at = excluded.updated_at`,
      [...values, updatedAt],
    );
  }
  return getTargets(db);
}

/** Clears every target, returning the app to pure logbook mode. */
export async function clearAllTargets(db: DbConnection, now: Date = new Date()): Promise<UserTargets> {
  return setTargets(db, EMPTY_TARGETS, now);
}

/**
 * Parses a target text field: empty means "no target" (`null`); otherwise a whole number
 * within the field's range. Throws `TargetValidationError` for anything else.
 */
export function parseTargetInput(key: TargetKey, text: string): number | null {
  const trimmed = text.trim().replace(/[,\s]/g, '');
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) {
    throw new TargetValidationError(key, `${fieldFor(key).label} must be a whole number.`);
  }
  const value = Number(trimmed);
  validateTarget(key, value);
  return value;
}

function validateTarget(key: TargetKey, value: number | null): void {
  if (value === null) return;
  const field = fieldFor(key);
  if (!Number.isSafeInteger(value)) {
    throw new TargetValidationError(key, `${field.label} must be a whole number.`);
  }
  if (value < field.min) {
    throw new TargetValidationError(
      key,
      field.min === 1 ? `${field.label} must be greater than 0.` : `${field.label} cannot be negative.`,
    );
  }
}

function fieldFor(key: TargetKey): TargetField {
  const field = TARGET_FIELDS.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`Unknown target key: ${key}`);
  return field;
}
