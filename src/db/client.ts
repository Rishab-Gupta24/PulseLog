/**
 * SQLite connection setup (see Rules.md §1.4, Architecture.md §3).
 *
 * The app opens the database through `<SQLiteProvider databaseName={DATABASE_NAME}
 * onInit={initializeDatabase}>` and services read it with `useSQLiteContext()`.
 * Services depend on the narrow `DbConnection` / `DbExecutor` interfaces below so Jest
 * can run them against a real SQLite engine (`src/test-utils/nodeSqliteDatabase.ts`).
 */
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

export const DATABASE_NAME = 'pulselog.db';

export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

/** Query surface shared by the main connection and an exclusive-transaction `txn`. */
export interface DbExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlParam[]): Promise<RunResult>;
  getFirstAsync<T>(source: string, params: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlParam[]): Promise<T[]>;
}

export interface DbConnection extends DbExecutor {
  /**
   * Runs `task` on a NEW connection. `PRAGMA foreign_keys` is off there and cannot be
   * turned on once `BEGIN` has run, so foreign keys are not enforced and
   * `ON DELETE CASCADE` does not fire for queries on `txn`. Delete child rows explicitly
   * and call `assertForeignKeysValid(txn)` before the task returns.
   */
  withExclusiveTransactionAsync(task: (txn: DbExecutor) => Promise<void>): Promise<void>;
}

interface UserVersionRow {
  user_version: number;
}

interface ForeignKeyViolationRow {
  table: string;
  rowid: number | null;
  parent: string;
  fkid: number;
}

/** Applies connection PRAGMAs and runs pending migrations. Safe to call on every launch. */
export async function initializeDatabase(db: DbConnection): Promise<void> {
  // journal_mode persists in the file; foreign_keys is per-connection and must run on every open.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version', []);
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than this app supports (${SCHEMA_VERSION}).`,
    );
  }

  for (let version = currentVersion; version < SCHEMA_VERSION; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await assertForeignKeysValid(txn);
      // user_version is transactional, so a failed migration leaves the old version in place.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/**
 * Throws if any row references a missing parent. Use inside exclusive transactions,
 * where SQLite does not enforce foreign keys; throwing rolls the transaction back.
 */
export async function assertForeignKeysValid(executor: DbExecutor): Promise<void> {
  const violations = await executor.getAllAsync<ForeignKeyViolationRow>('PRAGMA foreign_key_check', []);
  if (violations.length > 0) {
    const first = violations[0];
    throw new Error(
      `Foreign key check failed: ${violations.length} orphaned row(s), e.g. ${first.table} rowid ${first.rowid} -> ${first.parent}.`,
    );
  }
}
