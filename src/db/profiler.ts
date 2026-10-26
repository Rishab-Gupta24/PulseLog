/**
 * `performance.now()` query timing (see Rules.md §1.12).
 *
 * Wrap dashboard and chart queries in `profileQuery()`. Timings stay in memory; read them
 * with `summarizeQueryTimings()` on a physical device and record the numbers in memory.md
 * before quoting any latency anywhere else.
 */

export interface QueryTiming {
  label: string;
  durationMs: number;
  /** False when the query threw; the error is still rethrown to the caller. */
  ok: boolean;
}

export interface QueryTimingSummary {
  label: string;
  count: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

/** Oldest timings are dropped beyond this many, so profiling never grows memory unbounded. */
export const MAX_RECORDED_TIMINGS = 1000;

let timings: QueryTiming[] = [];

export async function profileQuery<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let ok = false;
  try {
    const result = await run();
    ok = true;
    return result;
  } finally {
    timings.push({ label, durationMs: performance.now() - start, ok });
    if (timings.length > MAX_RECORDED_TIMINGS) {
      timings = timings.slice(-MAX_RECORDED_TIMINGS);
    }
  }
}

export function getQueryTimings(): readonly QueryTiming[] {
  return timings;
}

export function clearQueryTimings(): void {
  timings = [];
}

/** Per-label stats over successful runs, sorted by label. Percentiles use nearest-rank. */
export function summarizeQueryTimings(): QueryTimingSummary[] {
  const byLabel = new Map<string, number[]>();
  for (const timing of timings) {
    if (!timing.ok) continue;
    const durations = byLabel.get(timing.label) ?? [];
    durations.push(timing.durationMs);
    byLabel.set(timing.label, durations);
  }

  return [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        label,
        count: sorted.length,
        minMs: sorted[0],
        medianMs: nearestRank(sorted, 0.5),
        p95Ms: nearestRank(sorted, 0.95),
        maxMs: sorted[sorted.length - 1],
      };
    });
}

function nearestRank(sorted: number[], percentile: number): number {
  const index = Math.ceil(percentile * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}
