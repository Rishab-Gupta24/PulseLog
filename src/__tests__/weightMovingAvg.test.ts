import { initializeDatabase } from '@/db/client';
import {
  computeWeightTrend,
  deleteWeightLog,
  DuplicateWeightDateError,
  getLatestWeightOnOrBefore,
  getWeightLogs,
  parseWeightInput,
  saveWeightLog,
  updateWeightLog,
  WeightValidationError,
  type WeightLogInput,
} from '@/services/weightService';
import { NodeSqliteDatabase } from '@/test-utils/nodeSqliteDatabase';

function log(loggedDate: string, weightKg: number): WeightLogInput {
  return { loggedDate, weightKg };
}

describe('computeWeightTrend (7-day moving average)', () => {
  it('returns an empty trend for no logs', () => {
    expect(computeWeightTrend([])).toEqual([]);
  });

  it('averages a single log with itself', () => {
    expect(computeWeightTrend([log('2026-10-26', 75)])).toEqual([
      { loggedDate: '2026-10-26', weightKg: 75, movingAverageKg: 75, sampleCount: 1 },
    ]);
  });

  it('grows the window over consecutive days, then slides it after day 7', () => {
    // 80, 79, ..., 72 over nine consecutive days.
    const logs = Array.from({ length: 9 }, (_, i) => log(`2026-10-${String(i + 1).padStart(2, '0')}`, 80 - i));
    const trend = computeWeightTrend(logs);

    expect(trend.map((p) => p.sampleCount)).toEqual([1, 2, 3, 4, 5, 6, 7, 7, 7]);
    expect(trend[0].movingAverageKg).toBeCloseTo(80);
    expect(trend[6].movingAverageKg).toBeCloseTo(77); // mean of 80..74
    expect(trend[7].movingAverageKg).toBeCloseTo(76); // mean of 79..73 (Oct 1 dropped)
    expect(trend[8].movingAverageKg).toBeCloseTo(75); // mean of 78..72
  });

  it('uses a calendar window for sparse logs instead of the last 7 entries', () => {
    const trend = computeWeightTrend([
      log('2026-10-01', 80),
      log('2026-10-04', 78),
      log('2026-10-07', 76), // window Oct 1–7: 80, 78, 76
      log('2026-10-08', 75), // window Oct 2–8: 78, 76, 75 (Oct 1 dropped)
      log('2026-10-20', 70), // window Oct 14–20: only itself
    ]);

    expect(trend.map((p) => [p.loggedDate, p.sampleCount])).toEqual([
      ['2026-10-01', 1],
      ['2026-10-04', 2],
      ['2026-10-07', 3],
      ['2026-10-08', 3],
      ['2026-10-20', 1],
    ]);
    expect(trend[2].movingAverageKg).toBeCloseTo(78);
    expect(trend[3].movingAverageKg).toBeCloseTo((78 + 76 + 75) / 3);
    expect(trend[4].movingAverageKg).toBeCloseTo(70);
  });

  it('includes a log exactly 6 days earlier but not 7', () => {
    const trend = computeWeightTrend([log('2026-10-01', 80), log('2026-10-07', 76), log('2026-10-08', 74)]);
    expect(trend[1]).toMatchObject({ sampleCount: 2, movingAverageKg: 78 });
    expect(trend[2]).toMatchObject({ sampleCount: 2, movingAverageKg: 75 });
  });

  it('spans month and year boundaries', () => {
    const trend = computeWeightTrend([log('2026-12-28', 80), log('2027-01-02', 78), log('2027-01-04', 76)]);
    // Jan 2's window (Dec 27–Jan 2) reaches back into December; Jan 4's (Dec 29–Jan 4) drops Dec 28.
    expect(trend.map((p) => p.sampleCount)).toEqual([1, 2, 2]);
    expect(trend[1].movingAverageKg).toBeCloseTo(79);
    expect(trend[2].movingAverageKg).toBeCloseTo(77);
  });

  it('sorts unordered input oldest first without mutating it', () => {
    const input = [log('2026-10-03', 74), log('2026-10-01', 76)];
    const trend = computeWeightTrend(input);
    expect(trend.map((p) => p.loggedDate)).toEqual(['2026-10-01', '2026-10-03']);
    expect(trend[1].movingAverageKg).toBeCloseTo(75);
    expect(input[0].loggedDate).toBe('2026-10-03');
  });
});

describe('weight log storage', () => {
  let db: NodeSqliteDatabase;

  beforeEach(async () => {
    db = NodeSqliteDatabase.create();
    await initializeDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('logs weights and lists them oldest first', async () => {
    await saveWeightLog(db, log('2026-10-26', 75.2));
    await saveWeightLog(db, log('2026-10-24', 75.8));
    expect((await getWeightLogs(db)).map((w) => [w.loggedDate, w.weightKg])).toEqual([
      ['2026-10-24', 75.8],
      ['2026-10-26', 75.2],
    ]);
  });

  it('replaces the reading when the same date is logged again', async () => {
    const first = await saveWeightLog(db, log('2026-10-26', 75.2));
    const second = await saveWeightLog(db, log('2026-10-26', 74.9));
    expect(second).toEqual({ id: first.id, loggedDate: '2026-10-26', weightKg: 74.9 });
    expect(await getWeightLogs(db)).toHaveLength(1);
  });

  it('rounds to 0.1 kg', async () => {
    expect((await saveWeightLog(db, log('2026-10-26', 75.26))).weightKg).toBe(75.3);
  });

  it.each([
    [log('2026-02-30', 75), 'loggedDate'],
    [log('26-10-2026', 75), 'loggedDate'],
    [log('2026-10-26', 0), 'weightKg'],
    [log('2026-10-26', 0.04), 'weightKg'],
    [log('2026-10-26', -70), 'weightKg'],
    [log('2026-10-26', 501), 'weightKg'],
    [log('2026-10-26', Number.NaN), 'weightKg'],
  ])('rejects %p (%s) without writing', async (input, field) => {
    await expect(saveWeightLog(db, input)).rejects.toMatchObject({ name: 'WeightValidationError', field });
    expect(await getWeightLogs(db)).toEqual([]);
  });

  it('edits a log’s weight and date', async () => {
    const saved = await saveWeightLog(db, log('2026-10-26', 75.2));
    expect(await updateWeightLog(db, saved.id, log('2026-10-25', 75.0))).toEqual({
      id: saved.id,
      loggedDate: '2026-10-25',
      weightKg: 75,
    });
    expect(await getWeightLogs(db)).toEqual([{ id: saved.id, loggedDate: '2026-10-25', weightKg: 75 }]);
  });

  it('refuses to move a log onto a date that already has one', async () => {
    await saveWeightLog(db, log('2026-10-25', 75.6));
    const saved = await saveWeightLog(db, log('2026-10-26', 75.2));
    await expect(updateWeightLog(db, saved.id, log('2026-10-25', 75.2))).rejects.toBeInstanceOf(
      DuplicateWeightDateError,
    );
  });

  it('returns null when editing a log that no longer exists', async () => {
    expect(await updateWeightLog(db, 999, log('2026-10-26', 75))).toBeNull();
  });

  it('deletes a log', async () => {
    const saved = await saveWeightLog(db, log('2026-10-26', 75.2));
    expect(await deleteWeightLog(db, saved.id)).toBe(true);
    expect(await deleteWeightLog(db, saved.id)).toBe(false);
    expect(await getWeightLogs(db)).toEqual([]);
  });

  describe('getLatestWeightOnOrBefore', () => {
    beforeEach(async () => {
      await saveWeightLog(db, log('2026-10-10', 78));
      await saveWeightLog(db, log('2026-10-20', 76));
    });

    it('returns a same-day weight', async () => {
      expect(await getLatestWeightOnOrBefore(db, '2026-10-20')).toMatchObject({ weightKg: 76 });
    });

    it('returns the most recent earlier weight', async () => {
      expect(await getLatestWeightOnOrBefore(db, '2026-10-19')).toMatchObject({
        loggedDate: '2026-10-10',
        weightKg: 78,
      });
    });

    it('never returns a future weight', async () => {
      expect(await getLatestWeightOnOrBefore(db, '2026-10-09')).toBeNull();
    });

    it('rejects an invalid date', async () => {
      await expect(getLatestWeightOnOrBefore(db, '2026-13-01')).rejects.toBeInstanceOf(WeightValidationError);
    });
  });
});

describe('parseWeightInput', () => {
  it.each([
    ['75', 75],
    [' 75.4 ', 75.4],
    ['75,4', 75.4],
    ['75.46', 75.5],
  ])('parses %p as %p kg', (text, expected) => {
    expect(parseWeightInput(text)).toBe(expected);
  });

  it.each(['', 'abc', '-75', '75.', '0', '1e2'])('rejects %p', (text) => {
    expect(() => parseWeightInput(text)).toThrow(WeightValidationError);
  });
});
