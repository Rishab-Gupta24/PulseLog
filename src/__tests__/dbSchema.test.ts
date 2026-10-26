import { assertForeignKeysValid, initializeDatabase } from '@/db/client';
import { SCHEMA_VERSION, TABLE_NAMES } from '@/db/schema';
import { NodeSqliteDatabase } from '@/test-utils/nodeSqliteDatabase';

let db: NodeSqliteDatabase;

beforeEach(async () => {
  db = NodeSqliteDatabase.create();
  await initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

const NOW = '2026-10-26T10:00:00.000Z';

async function insertWorkout(): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO workouts (workout_date, created_at, duration_minutes) VALUES (?, ?, ?)',
    ['2026-10-26', NOW, 40],
  );
  return result.lastInsertRowId;
}

async function insertSet(workoutId: number, rpe: number | null = null): Promise<void> {
  await db.runAsync(
    'INSERT INTO workout_sets (workout_id, exercise_name, set_number, reps, weight_kg, rpe) VALUES (?, ?, ?, ?, ?, ?)',
    [workoutId, 'Back Squat', 1, 5, 100, rpe],
  );
}

async function countRows(table: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`, []);
  return row?.n ?? 0;
}

describe('initializeDatabase', () => {
  it('enables WAL and foreign keys and records the schema version', async () => {
    expect(await db.getFirstAsync('PRAGMA journal_mode', [])).toEqual({ journal_mode: 'wal' });
    expect(await db.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({ foreign_keys: 1 });
    expect(await db.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: SCHEMA_VERSION });
  });

  it('creates all six tables', async () => {
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
    );
    expect(rows.map((r) => r.name)).toEqual([...TABLE_NAMES].sort());
  });

  it('is idempotent and keeps existing data', async () => {
    await insertWorkout();
    await initializeDatabase(db);
    expect(await countRows('workouts')).toBe(1);
    expect(await db.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: SCHEMA_VERSION });
  });

  it('refuses a database from a newer app version', async () => {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(initializeDatabase(db)).rejects.toThrow('newer than this app supports');
  });
});

describe('foreign keys on the main connection', () => {
  it('cascades workout deletes to workout_sets', async () => {
    const workoutId = await insertWorkout();
    await insertSet(workoutId);
    await insertSet(workoutId);

    await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
    expect(await countRows('workout_sets')).toBe(0);
  });

  it('rejects a set for a missing workout', async () => {
    await expect(insertSet(999)).rejects.toThrow('FOREIGN KEY constraint failed');
  });
});

describe('CHECK and UNIQUE constraints', () => {
  it('allows all-null targets but only a single targets row', async () => {
    await db.runAsync('INSERT INTO user_targets (id, updated_at) VALUES (1, ?)', [NOW]);
    await expect(db.runAsync('INSERT INTO user_targets (id, updated_at) VALUES (2, ?)', [NOW])).rejects.toThrow(
      'CHECK constraint failed',
    );
  });

  it('rejects a zero calorie target', async () => {
    await expect(
      db.runAsync('INSERT INTO user_targets (id, daily_calorie_target, updated_at) VALUES (1, 0, ?)', [NOW]),
    ).rejects.toThrow('CHECK constraint failed');
  });

  it('accepts RPE 1–10 or null and rejects values outside it', async () => {
    const workoutId = await insertWorkout();
    await insertSet(workoutId, null);
    await insertSet(workoutId, 10);
    await expect(insertSet(workoutId, 10.5)).rejects.toThrow('CHECK constraint failed');
    await expect(insertSet(workoutId, 0.5)).rejects.toThrow('CHECK constraint failed');
  });

  it('rejects unknown intensity labels', async () => {
    await expect(
      db.runAsync("INSERT INTO workouts (workout_date, created_at, intensity_label) VALUES (?, ?, 'extreme')", [
        '2026-10-26',
        NOW,
      ]),
    ).rejects.toThrow('CHECK constraint failed');
  });

  it('allows one weight log per local date', async () => {
    await db.runAsync('INSERT INTO weight_logs (logged_date, weight_kg) VALUES (?, ?)', ['2026-10-26', 75]);
    await expect(
      db.runAsync('INSERT INTO weight_logs (logged_date, weight_kg) VALUES (?, ?)', ['2026-10-26', 74.5]),
    ).rejects.toThrow('UNIQUE constraint failed');
  });

  it('rejects unknown step sources', async () => {
    await expect(
      db.runAsync("INSERT INTO step_logs (logged_date, step_count, source, updated_at) VALUES (?, 1000, 'fitbit', ?)", [
        '2026-10-26',
        NOW,
      ]),
    ).rejects.toThrow('CHECK constraint failed');
  });
});

describe('exclusive transactions (separate connection, foreign keys off)', () => {
  it('does not enforce foreign keys or cascades on txn, so callers must check', async () => {
    const workoutId = await insertWorkout();
    await insertSet(workoutId);

    await db.withExclusiveTransactionAsync(async (txn) => {
      expect(await txn.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({ foreign_keys: 0 });
      await txn.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
      // No cascade: the set is now orphaned inside the transaction.
      const orphans = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_sets', []);
      expect(orphans?.n).toBe(1);
      await txn.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', [workoutId]);
      await assertForeignKeysValid(txn);
    });

    expect(await countRows('workouts')).toBe(0);
    expect(await countRows('workout_sets')).toBe(0);
  });

  it('rolls back when assertForeignKeysValid finds orphaned rows', async () => {
    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          'INSERT INTO workout_sets (workout_id, exercise_name, set_number, reps, weight_kg) VALUES (?, ?, ?, ?, ?)',
          [999, 'Bench Press', 1, 8, 60],
        );
        await assertForeignKeysValid(txn);
      }),
    ).rejects.toThrow('Foreign key check failed');

    expect(await countRows('workout_sets')).toBe(0);
  });
});
