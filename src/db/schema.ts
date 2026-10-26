/**
 * SQLite schema (see Architecture.md §3) and typed row interfaces.
 *
 * Date columns (`workout_date`, `logged_date`) hold local `YYYY-MM-DD` strings from
 * `toLocalDateString()`; `created_at` / `updated_at` hold ISO-8601 UTC timestamps.
 * Connection PRAGMAs (WAL, foreign_keys) are applied in `client.ts`, not here.
 */
import type { LocalDateString } from '@/utils/dateUtils';

/** ISO-8601 UTC timestamp, e.g. `new Date().toISOString()`. */
export type IsoTimestamp = string;

export type IntensityLabel = 'light' | 'moderate' | 'vigorous';
export type StepSource = 'manual' | 'health_connect' | 'healthkit';

export interface UserTargetsRow {
  id: 1;
  daily_calorie_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  daily_steps_target: number | null;
  updated_at: IsoTimestamp;
}

export interface WorkoutRow {
  id: number;
  workout_date: LocalDateString;
  created_at: IsoTimestamp;
  duration_minutes: number;
  intensity_label: IntensityLabel;
  met_value: number;
  body_weight_kg_used: number | null;
  estimated_calories_burned: number | null;
  notes: string | null;
}

export interface WorkoutSetRow {
  id: number;
  workout_id: number;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
}

export interface MealLogRow {
  id: number;
  logged_date: LocalDateString;
  created_at: IsoTimestamp;
  staple_food_id: string | null;
  meal_name: string;
  portion_label: string;
  portion_multiplier: number;
  base_calories: number;
  base_protein_g: number;
  base_carbs_g: number;
  base_fat_g: number;
  est_calories: number;
  est_protein_g: number;
  est_carbs_g: number;
  est_fat_g: number;
}

export interface WeightLogRow {
  id: number;
  logged_date: LocalDateString;
  weight_kg: number;
}

export interface StepLogRow {
  logged_date: LocalDateString;
  step_count: number;
  source: StepSource;
  updated_at: IsoTimestamp;
}

/** Every table, parents before children (insert in this order, delete in reverse). */
export const TABLE_NAMES = [
  'user_targets',
  'workouts',
  'workout_sets',
  'meal_logs',
  'weight_logs',
  'step_logs',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS user_targets (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_calorie_target INTEGER CHECK (daily_calorie_target IS NULL OR daily_calorie_target > 0),
  daily_protein_g INTEGER CHECK (daily_protein_g IS NULL OR daily_protein_g >= 0),
  daily_carbs_g INTEGER CHECK (daily_carbs_g IS NULL OR daily_carbs_g >= 0),
  daily_fat_g INTEGER CHECK (daily_fat_g IS NULL OR daily_fat_g >= 0),
  daily_steps_target INTEGER CHECK (daily_steps_target IS NULL OR daily_steps_target > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  intensity_label TEXT NOT NULL DEFAULT 'moderate' CHECK (intensity_label IN ('light', 'moderate', 'vigorous')),
  met_value REAL NOT NULL DEFAULT 5.0 CHECK (met_value > 0),
  body_weight_kg_used REAL CHECK (body_weight_kg_used IS NULL OR body_weight_kg_used > 0),
  estimated_calories_burned INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 1.0 AND rpe <= 10.0)),
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  staple_food_id TEXT,
  meal_name TEXT NOT NULL,
  portion_label TEXT NOT NULL,
  portion_multiplier REAL NOT NULL DEFAULT 1.0 CHECK (portion_multiplier > 0),
  base_calories INTEGER NOT NULL CHECK (base_calories >= 0),
  base_protein_g REAL NOT NULL DEFAULT 0 CHECK (base_protein_g >= 0),
  base_carbs_g REAL NOT NULL DEFAULT 0 CHECK (base_carbs_g >= 0),
  base_fat_g REAL NOT NULL DEFAULT 0 CHECK (base_fat_g >= 0),
  est_calories INTEGER NOT NULL CHECK (est_calories >= 0),
  est_protein_g REAL NOT NULL DEFAULT 0 CHECK (est_protein_g >= 0),
  est_carbs_g REAL NOT NULL DEFAULT 0 CHECK (est_carbs_g >= 0),
  est_fat_g REAL NOT NULL DEFAULT 0 CHECK (est_fat_g >= 0)
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0)
);

CREATE TABLE IF NOT EXISTS step_logs (
  logged_date TEXT NOT NULL PRIMARY KEY,
  step_count INTEGER NOT NULL CHECK (step_count >= 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'health_connect', 'healthkit')),
  updated_at TEXT NOT NULL
);

-- Daily lookups and the cascade from workouts to workout_sets.
CREATE INDEX IF NOT EXISTS idx_workouts_workout_date ON workouts (workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_id ON workout_sets (workout_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_logged_date ON meal_logs (logged_date);
`;

/**
 * Ordered migrations: `MIGRATIONS[i]` upgrades `PRAGMA user_version` from `i` to `i + 1`.
 * Append new entries; never edit a shipped one.
 */
export const MIGRATIONS: readonly string[] = [SCHEMA_V1];

export const SCHEMA_VERSION = MIGRATIONS.length;
