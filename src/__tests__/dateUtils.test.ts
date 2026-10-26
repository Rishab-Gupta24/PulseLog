/**
 * @jest-environment ./jest/timezoneEnvironment.js
 */
import {
  addDaysToLocalDate,
  diffLocalDays,
  getLocalDayBounds,
  isValidLocalDateString,
  parseLocalDateString,
  toLocalDateString,
} from '@/utils/dateUtils';

declare global {
  // Provided by jest/timezoneEnvironment.js.
  var __setProcessTimezone: (tz: string) => void;
}

const ORIGINAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function inTimezone(tz: string, run: () => void): void {
  globalThis.__setProcessTimezone(tz);
  try {
    run();
  } finally {
    globalThis.__setProcessTimezone(ORIGINAL_TZ);
  }
}

describe('toLocalDateString', () => {
  it('pads single-digit months and days', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('defaults to the current local date', () => {
    expect(toLocalDateString()).toBe(toLocalDateString(new Date()));
  });

  it('uses the local day just after midnight ahead of UTC (Asia/Kolkata, UTC+5:30)', () => {
    inTimezone('Asia/Kolkata', () => {
      // 2026-10-26 00:30 IST is still 2026-10-25 in UTC.
      const justAfterMidnight = new Date(Date.UTC(2026, 9, 25, 19, 0));
      expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-10-25');
      expect(toLocalDateString(justAfterMidnight)).toBe('2026-10-26');
    });
  });

  it('uses the local day just before midnight behind UTC (America/Los_Angeles)', () => {
    inTimezone('America/Los_Angeles', () => {
      // 2026-10-26 23:30 PDT is already 2026-10-27 in UTC.
      const justBeforeMidnight = new Date(Date.UTC(2026, 9, 27, 6, 30));
      expect(justBeforeMidnight.toISOString().slice(0, 10)).toBe('2026-10-27');
      expect(toLocalDateString(justBeforeMidnight)).toBe('2026-10-26');
    });
  });

  it('separates 23:59:59.999 and 00:00 into consecutive days', () => {
    inTimezone('Asia/Kolkata', () => {
      expect(toLocalDateString(new Date(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12-31');
      expect(toLocalDateString(new Date(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01-01');
    });
  });
});

describe('parseLocalDateString / isValidLocalDateString', () => {
  it('parses to local midnight of that day', () => {
    inTimezone('America/Los_Angeles', () => {
      const date = parseLocalDateString('2026-10-26');
      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(0);
      expect(date && toLocalDateString(date)).toBe('2026-10-26');
    });
  });

  it('accepts leap days in leap years only', () => {
    expect(isValidLocalDateString('2028-02-29')).toBe(true);
    expect(isValidLocalDateString('2026-02-29')).toBe(false);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-05', '26-10-26', '2026/10/26', '2026-10-26T00:00', ''])(
    'rejects %p',
    (value) => {
      expect(parseLocalDateString(value)).toBeNull();
      expect(isValidLocalDateString(value)).toBe(false);
    },
  );
});

describe('addDaysToLocalDate / diffLocalDays', () => {
  it.each([
    ['2026-10-26', 1, '2026-10-27'],
    ['2026-10-26', -6, '2026-10-20'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-03-01', -1, '2026-02-28'],
  ])('%s %+d days = %s', (start, days, expected) => {
    expect(addDaysToLocalDate(start, days)).toBe(expected);
    expect(diffLocalDays(start, expected)).toBe(days);
  });

  it('counts DST transition days as exactly one day (America/New_York)', () => {
    inTimezone('America/New_York', () => {
      expect(addDaysToLocalDate('2026-03-08', 1)).toBe('2026-03-09');
      expect(addDaysToLocalDate('2026-11-01', 1)).toBe('2026-11-02');
      expect(diffLocalDays('2026-03-01', '2026-03-15')).toBe(14);
    });
  });

  it('throws on an invalid date string', () => {
    expect(() => addDaysToLocalDate('2026-02-30', 1)).toThrow('Invalid local date string');
    expect(() => diffLocalDays('2026-10-26', 'nope')).toThrow('Invalid local date string');
  });
});

describe('getLocalDayBounds', () => {
  it('spans local midnight to 23:59:59.999', () => {
    inTimezone('Asia/Kolkata', () => {
      const { start, end } = getLocalDayBounds('2026-10-26');
      expect(start.toISOString()).toBe('2026-10-25T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-10-26T18:29:59.999Z');
    });
  });

  it('handles a 23-hour DST spring-forward day (America/New_York)', () => {
    inTimezone('America/New_York', () => {
      const { start, end } = getLocalDayBounds('2026-03-08');
      expect(toLocalDateString(start)).toBe('2026-03-08');
      expect(toLocalDateString(end)).toBe('2026-03-08');
      expect(end.getTime() - start.getTime() + 1).toBe(23 * 60 * 60 * 1000);
    });
  });

  it('throws on an invalid date string', () => {
    expect(() => getLocalDayBounds('2026-02-30')).toThrow('Invalid local date string');
  });
});
