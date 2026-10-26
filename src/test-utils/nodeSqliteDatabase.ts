/// <reference types="node" />
/**
 * Jest-only `DbConnection` backed by Node's built-in `node:sqlite`, so services and
 * schema rules are tested against a real SQLite engine instead of mocks.
 *
 * It mirrors expo-sqlite's connection behavior:
 * - Foreign keys start OFF (SQLite's default), so `initializeDatabase()` must enable them.
 * - `withExclusiveTransactionAsync` runs on a separate connection to the same file, where
 *   foreign keys stay off — the same trap as on device (see memory.md).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { DbConnection, DbExecutor, RunResult, SqlParam } from '@/db/client';

const CONNECTION_OPTIONS = { enableForeignKeyConstraints: false } as const;

class NodeSqliteExecutor implements DbExecutor {
  constructor(protected readonly connection: DatabaseSync) {}

  async execAsync(source: string): Promise<void> {
    this.connection.exec(source);
  }

  async runAsync(source: string, params: SqlParam[]): Promise<RunResult> {
    const result = this.connection.prepare(source).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(source: string, params: SqlParam[]): Promise<T | null> {
    const row = this.connection.prepare(source).get(...params);
    return row === undefined ? null : (row as T);
  }

  async getAllAsync<T>(source: string, params: SqlParam[]): Promise<T[]> {
    return this.connection.prepare(source).all(...params) as T[];
  }
}

export class NodeSqliteDatabase extends NodeSqliteExecutor implements DbConnection {
  private constructor(
    connection: DatabaseSync,
    private readonly directory: string,
    private readonly filePath: string,
  ) {
    super(connection);
  }

  /** Opens a fresh, empty database file in a temp directory. Call `close()` in `afterEach`. */
  static create(): NodeSqliteDatabase {
    const directory = mkdtempSync(join(tmpdir(), 'pulselog-test-'));
    const filePath = join(directory, 'test.db');
    return new NodeSqliteDatabase(new DatabaseSync(filePath, CONNECTION_OPTIONS), directory, filePath);
  }

  async withExclusiveTransactionAsync(task: (txn: DbExecutor) => Promise<void>): Promise<void> {
    const txnConnection = new DatabaseSync(this.filePath, CONNECTION_OPTIONS);
    try {
      txnConnection.exec('BEGIN');
      try {
        await task(new NodeSqliteExecutor(txnConnection));
        txnConnection.exec('COMMIT');
      } catch (error) {
        if (txnConnection.isTransaction) txnConnection.exec('ROLLBACK');
        throw error;
      }
    } finally {
      txnConnection.close();
    }
  }

  close(): void {
    this.connection.close();
    rmSync(this.directory, { recursive: true, force: true });
  }
}
