import { act, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import TrendsScreen from '../../app/(tabs)/trends';
import { initializeDatabase } from '@/db/client';
import type { WeightTrendPoint } from '@/services/weightService';
import { getWeightLogs, saveWeightLog } from '@/services/weightService';
import { NodeSqliteDatabase } from '@/test-utils/nodeSqliteDatabase';
import { addDaysToLocalDate, toLocalDateString } from '@/utils/dateUtils';

let mockDb: NodeSqliteDatabase;

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

// Chart drawing is covered in weightChart.test.tsx; here we only check what it receives.
jest.mock('@/components/charts/WeightTrendChart', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WeightTrendChart: ({ points }: { points: readonly WeightTrendPoint[] }) => (
      <MockText>{`chart:${points.map((p) => `${p.loggedDate}=${p.movingAverageKg.toFixed(2)}`).join(',')}`}</MockText>
    ),
  };
});

const today = toLocalDateString();
const daysAgo = (n: number) => addDaysToLocalDate(today, -n);

beforeEach(async () => {
  mockDb = NodeSqliteDatabase.create();
  await initializeDatabase(mockDb);
});

afterEach(() => {
  mockDb.close();
  jest.restoreAllMocks();
});

async function renderScreen(): Promise<void> {
  await render(<TrendsScreen />);
  await waitFor(() => expect(screen.getByLabelText('Weight in kg')).toBeEnabled());
}

function historyRow(weightText: string) {
  const row = screen.getByText(weightText).parent?.parent;
  if (!row) throw new Error(`No history row for ${weightText}`);
  return within(row);
}

async function storedWeights(): Promise<[string, number][]> {
  return (await getWeightLogs(mockDb)).map((w) => [w.loggedDate, w.weightKg]);
}

it('starts empty with today’s date prefilled', async () => {
  await renderScreen();
  expect(screen.getByText('No weights logged yet.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Weight date')).toHaveDisplayValue(today);
  expect(screen.getByText('chart:')).toBeOnTheScreen();
});

it('logs a weight and shows it in the history, trend and chart', async () => {
  const user = userEvent.setup();
  await saveWeightLog(mockDb, { loggedDate: daysAgo(1), weightKg: 76 });
  await renderScreen();

  await user.type(screen.getByLabelText('Weight in kg'), '75,4');
  await user.press(screen.getByRole('button', { name: 'Save weight' }));

  expect(await screen.findByText('75.4 kg')).toBeOnTheScreen();
  expect(await storedWeights()).toEqual([
    [daysAgo(1), 76],
    [today, 75.4],
  ]);
  expect(screen.getByText(/^75\.7 kg/)).toBeOnTheScreen(); // 7-day average headline
  expect(screen.getByText(`chart:${daysAgo(1)}=76.00,${today}=75.70`)).toBeOnTheScreen();
  expect(screen.getByLabelText('Weight in kg')).toHaveDisplayValue('');
});

it('shows validation errors and saves nothing', async () => {
  const user = userEvent.setup();
  await renderScreen();

  await user.press(screen.getByRole('button', { name: 'Save weight' }));
  expect(await screen.findByText('Enter a weight in kg, e.g. 75.4.')).toBeOnTheScreen();

  await user.clear(screen.getByLabelText('Weight date'));
  await user.type(screen.getByLabelText('Weight date'), '2026-02-30');
  await user.type(screen.getByLabelText('Weight in kg'), '75');
  await user.press(screen.getByRole('button', { name: 'Save weight' }));
  expect(await screen.findByText('Use a date like 2026-10-26.')).toBeOnTheScreen();

  expect(await storedWeights()).toEqual([]);
});

it('rejects a future date', async () => {
  const user = userEvent.setup();
  await renderScreen();

  await user.clear(screen.getByLabelText('Weight date'));
  await user.type(screen.getByLabelText('Weight date'), addDaysToLocalDate(today, 1));
  await user.type(screen.getByLabelText('Weight in kg'), '75');
  await user.press(screen.getByRole('button', { name: 'Save weight' }));

  expect(await screen.findByText('You can’t log a weight for a future date.')).toBeOnTheScreen();
  expect(await storedWeights()).toEqual([]);
});

it('warns before replacing an existing reading for the same date', async () => {
  const user = userEvent.setup();
  await saveWeightLog(mockDb, { loggedDate: today, weightKg: 76 });
  await renderScreen();

  expect(screen.getByText('Replaces the 76.0 kg already logged for this date.')).toBeOnTheScreen();
  await user.type(screen.getByLabelText('Weight in kg'), '75.5');
  await user.press(screen.getByRole('button', { name: 'Save weight' }));

  expect(await screen.findByText('75.5 kg')).toBeOnTheScreen();
  expect(await storedWeights()).toEqual([[today, 75.5]]);
});

it('edits an entry’s weight and date', async () => {
  const user = userEvent.setup();
  await saveWeightLog(mockDb, { loggedDate: daysAgo(3), weightKg: 77 });
  await renderScreen();

  await user.press(historyRow('77.0 kg').getByRole('button', { name: 'Edit' }));
  expect(screen.getByText('Edit weight')).toBeOnTheScreen();
  expect(screen.getByLabelText('Weight in kg')).toHaveDisplayValue('77.0');

  await user.clear(screen.getByLabelText('Weight in kg'));
  await user.type(screen.getByLabelText('Weight in kg'), '76.6');
  await user.clear(screen.getByLabelText('Weight date'));
  await user.type(screen.getByLabelText('Weight date'), daysAgo(2));
  await user.press(screen.getByRole('button', { name: 'Update weight' }));

  expect(await screen.findByText('76.6 kg')).toBeOnTheScreen();
  expect(screen.getByText('Log weight')).toBeOnTheScreen();
  expect(await storedWeights()).toEqual([[daysAgo(2), 76.6]]);
});

it('blocks moving an entry onto a date that already has one', async () => {
  const user = userEvent.setup();
  await saveWeightLog(mockDb, { loggedDate: daysAgo(2), weightKg: 76 });
  await saveWeightLog(mockDb, { loggedDate: daysAgo(1), weightKg: 75 });
  await renderScreen();

  await user.press(historyRow('75.0 kg').getByRole('button', { name: 'Edit' }));
  await user.clear(screen.getByLabelText('Weight date'));
  await user.type(screen.getByLabelText('Weight date'), daysAgo(2));
  await user.press(screen.getByRole('button', { name: 'Update weight' }));

  expect(await screen.findByText(/A weight is already logged for/)).toBeOnTheScreen();
  expect(await storedWeights()).toEqual([
    [daysAgo(2), 76],
    [daysAgo(1), 75],
  ]);
});

it('deletes an entry only after confirmation', async () => {
  const user = userEvent.setup();
  const alertSpy = jest.spyOn(Alert, 'alert');
  await saveWeightLog(mockDb, { loggedDate: daysAgo(1), weightKg: 76 });
  await saveWeightLog(mockDb, { loggedDate: today, weightKg: 75 });
  await renderScreen();

  await user.press(historyRow('76.0 kg').getByRole('button', { name: 'Delete' }));
  const buttons = (alertSpy.mock.calls[0]?.[2] ?? []) as AlertButton[];
  expect(alertSpy.mock.calls[0]?.[0]).toBe('Delete weight entry?');

  buttons.find((b) => b.style === 'cancel')?.onPress?.();
  expect(await storedWeights()).toHaveLength(2);

  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
  await waitFor(() => expect(screen.queryByText('76.0 kg')).not.toBeOnTheScreen());
  expect(await storedWeights()).toEqual([[today, 75]]);
});
