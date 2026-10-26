import { initializeDatabase } from '@/db/client';
import {
  clearAllTargets,
  EMPTY_TARGETS,
  getTargets,
  parseTargetInput,
  setTargets,
  TargetValidationError,
} from '@/services/targetsService';
import { NodeSqliteDatabase } from '@/test-utils/nodeSqliteDatabase';

let db: NodeSqliteDatabase;

beforeEach(async () => {
  db = NodeSqliteDatabase.create();
  await initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

async function storedUpdatedAt(): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM user_targets', []);
  return row?.updated_at;
}

describe('getTargets', () => {
  it('returns all-null targets when the user never set any', async () => {
    expect(await getTargets(db)).toEqual(EMPTY_TARGETS);
  });
});

describe('setTargets', () => {
  it('sets a subset and leaves the rest null', async () => {
    const result = await setTargets(db, { daily_protein_g: 140, daily_steps_target: 8000 });
    expect(result).toEqual({ ...EMPTY_TARGETS, daily_protein_g: 140, daily_steps_target: 8000 });
    expect(await getTargets(db)).toEqual(result);
  });

  it('updates only the keys provided', async () => {
    await setTargets(db, { daily_calorie_target: 2400, daily_protein_g: 140 });
    const result = await setTargets(db, { daily_protein_g: 160 });
    expect(result).toEqual({ ...EMPTY_TARGETS, daily_calorie_target: 2400, daily_protein_g: 160 });
  });

  it('clears a single target when given null', async () => {
    await setTargets(db, { daily_calorie_target: 2400, daily_fat_g: 70 });
    const result = await setTargets(db, { daily_fat_g: null });
    expect(result).toEqual({ ...EMPTY_TARGETS, daily_calorie_target: 2400 });
  });

  it('allows a zero macro target but not zero calories or steps', async () => {
    await expect(setTargets(db, { daily_carbs_g: 0 })).resolves.toMatchObject({ daily_carbs_g: 0 });
    await expect(setTargets(db, { daily_calorie_target: 0 })).rejects.toThrow('Calories must be greater than 0.');
    await expect(setTargets(db, { daily_steps_target: 0 })).rejects.toThrow('Steps must be greater than 0.');
  });

  it.each([
    [{ daily_protein_g: -1 }, 'Protein cannot be negative.'],
    [{ daily_fat_g: 65.5 }, 'Fat must be a whole number.'],
    [{ daily_calorie_target: Number.NaN }, 'Calories must be a whole number.'],
  ])('rejects %p without writing anything', async (updates, message) => {
    await setTargets(db, { daily_calorie_target: 2000 });
    await expect(setTargets(db, { daily_steps_target: 9000, ...updates })).rejects.toThrow(message);
    expect(await getTargets(db)).toEqual({ ...EMPTY_TARGETS, daily_calorie_target: 2000 });
  });

  it('reports which target failed validation', async () => {
    await expect(setTargets(db, { daily_protein_g: -5 })).rejects.toMatchObject({
      name: 'TargetValidationError',
      key: 'daily_protein_g',
    });
  });

  it('stamps updated_at with the given time', async () => {
    await setTargets(db, { daily_protein_g: 140 }, new Date('2026-10-26T08:00:00.000Z'));
    expect(await storedUpdatedAt()).toBe('2026-10-26T08:00:00.000Z');
    await setTargets(db, { daily_protein_g: 150 }, new Date('2026-10-27T09:30:00.000Z'));
    expect(await storedUpdatedAt()).toBe('2026-10-27T09:30:00.000Z');
  });

  it('does nothing for an empty update', async () => {
    expect(await setTargets(db, {})).toEqual(EMPTY_TARGETS);
    expect(await storedUpdatedAt()).toBeUndefined();
  });
});

describe('clearAllTargets', () => {
  it('returns every target to null', async () => {
    await setTargets(db, {
      daily_calorie_target: 2400,
      daily_protein_g: 140,
      daily_carbs_g: 250,
      daily_fat_g: 70,
      daily_steps_target: 8000,
    });
    expect(await clearAllTargets(db)).toEqual(EMPTY_TARGETS);
    expect(await getTargets(db)).toEqual(EMPTY_TARGETS);
  });
});

describe('parseTargetInput', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['140', 140],
    [' 2400 ', 2400],
    ['10,000', 10000],
    ['0', 0],
  ])('parses protein input %p as %p', (text, expected) => {
    expect(parseTargetInput('daily_protein_g', text)).toBe(expected);
  });

  it.each(['12.5', '-5', 'abc', '1e3'])('rejects %p', (text) => {
    expect(() => parseTargetInput('daily_protein_g', text)).toThrow(TargetValidationError);
  });

  it('applies the per-field minimum', () => {
    expect(() => parseTargetInput('daily_calorie_target', '0')).toThrow('Calories must be greater than 0.');
  });
});
