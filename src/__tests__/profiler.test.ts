import {
  clearQueryTimings,
  getQueryTimings,
  MAX_RECORDED_TIMINGS,
  profileQuery,
  summarizeQueryTimings,
} from '@/db/profiler';

/** Makes successive performance.now() calls return the given values. */
function mockNow(...values: number[]): void {
  const spy = jest.spyOn(performance, 'now');
  for (const value of values) spy.mockReturnValueOnce(value);
}

afterEach(() => {
  clearQueryTimings();
  jest.restoreAllMocks();
});

describe('profileQuery', () => {
  it('returns the query result and records its duration', async () => {
    mockNow(100, 112.5);
    await expect(profileQuery('today.totals', async () => 42)).resolves.toBe(42);
    expect(getQueryTimings()).toEqual([{ label: 'today.totals', durationMs: 12.5, ok: true }]);
  });

  it('records failed queries and rethrows the error', async () => {
    mockNow(0, 3);
    await expect(
      profileQuery('chart.weights', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(getQueryTimings()).toEqual([{ label: 'chart.weights', durationMs: 3, ok: false }]);
  });

  it(`keeps only the latest ${MAX_RECORDED_TIMINGS} timings`, async () => {
    for (let i = 0; i < MAX_RECORDED_TIMINGS + 5; i++) {
      await profileQuery(`q${i}`, async () => null);
    }
    const timings = getQueryTimings();
    expect(timings).toHaveLength(MAX_RECORDED_TIMINGS);
    expect(timings[0].label).toBe('q5');
  });
});

describe('summarizeQueryTimings', () => {
  it('reports min, median, p95 and max per label over successful runs only', async () => {
    // Ten successful "a" runs taking 1..10 ms, then one failed "a" run and one "b" run.
    for (let ms = 1; ms <= 10; ms++) {
      mockNow(0, ms);
      await profileQuery('a', async () => null);
    }
    mockNow(0, 500);
    await profileQuery('a', async () => {
      throw new Error('ignored');
    }).catch(() => undefined);
    mockNow(0, 7);
    await profileQuery('b', async () => null);

    expect(summarizeQueryTimings()).toEqual([
      { label: 'a', count: 10, minMs: 1, medianMs: 5, p95Ms: 10, maxMs: 10 },
      { label: 'b', count: 1, minMs: 7, medianMs: 7, p95Ms: 7, maxMs: 7 },
    ]);
  });

  it('is empty when nothing has been profiled', () => {
    expect(summarizeQueryTimings()).toEqual([]);
  });
});
