import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import TargetsModal from '../../app/modals/targets';
import { initializeDatabase } from '@/db/client';
import { EMPTY_TARGETS, getTargets, setTargets } from '@/services/targetsService';
import { NodeSqliteDatabase } from '@/test-utils/nodeSqliteDatabase';

let mockDb: NodeSqliteDatabase;

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

const mockRouter = {
  canGoBack: jest.fn(() => true),
  back: jest.fn(),
  replace: jest.fn(),
};

// Getter because jest.mock is hoisted above mockRouter's initialization.
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

beforeEach(async () => {
  mockDb = NodeSqliteDatabase.create();
  await initializeDatabase(mockDb);
  jest.clearAllMocks();
});

afterEach(() => {
  mockDb.close();
});

async function renderModal(): Promise<void> {
  await render(<TargetsModal />);
  // Inputs become editable once the initial load finishes.
  await waitFor(() => expect(screen.getByLabelText('Calories target in kcal')).toBeEnabled());
}

it('shows saved targets and leaves unset ones empty', async () => {
  await setTargets(mockDb, { daily_protein_g: 140 });
  await renderModal();

  expect(screen.getByLabelText('Protein target in g')).toHaveDisplayValue('140');
  expect(screen.getByLabelText('Calories target in kcal')).toHaveDisplayValue('');
});

it('saves only the targets the user fills in, then closes', async () => {
  const user = userEvent.setup();
  await renderModal();

  await user.type(screen.getByLabelText('Protein target in g'), '150');
  await user.type(screen.getByLabelText('Steps target in steps'), '8,000');
  await user.press(screen.getByRole('button', { name: 'Save targets' }));

  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(await getTargets(mockDb)).toEqual({ ...EMPTY_TARGETS, daily_protein_g: 150, daily_steps_target: 8000 });
});

it('clears a target when its field is emptied', async () => {
  const user = userEvent.setup();
  await setTargets(mockDb, { daily_calorie_target: 2400, daily_fat_g: 70 });
  await renderModal();

  await user.clear(screen.getByLabelText('Fat target in g'));
  await user.press(screen.getByRole('button', { name: 'Save targets' }));

  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(await getTargets(mockDb)).toEqual({ ...EMPTY_TARGETS, daily_calorie_target: 2400 });
});

it('shows a validation error and does not save or close', async () => {
  const user = userEvent.setup();
  await renderModal();

  await user.type(screen.getByLabelText('Calories target in kcal'), '0');
  await user.type(screen.getByLabelText('Protein target in g'), '140');
  await user.press(screen.getByRole('button', { name: 'Save targets' }));

  expect(await screen.findByText('Calories must be greater than 0.')).toBeOnTheScreen();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(await getTargets(mockDb)).toEqual(EMPTY_TARGETS);
});

it('skips without writing anything', async () => {
  const user = userEvent.setup();
  await renderModal();

  await user.type(screen.getByLabelText('Protein target in g'), '140');
  await user.press(screen.getByRole('button', { name: 'Skip for now' }));

  expect(mockRouter.back).toHaveBeenCalled();
  expect(await getTargets(mockDb)).toEqual(EMPTY_TARGETS);
});

it('clears all targets and closes', async () => {
  const user = userEvent.setup();
  await setTargets(mockDb, { daily_calorie_target: 2400, daily_protein_g: 140, daily_steps_target: 8000 });
  await renderModal();

  await user.press(screen.getByRole('button', { name: 'Clear all targets' }));

  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(await getTargets(mockDb)).toEqual(EMPTY_TARGETS);
});

it('falls back to the home screen when there is nothing to go back to', async () => {
  const user = userEvent.setup();
  mockRouter.canGoBack.mockReturnValueOnce(false);
  await renderModal();

  await user.press(screen.getByRole('button', { name: 'Skip for now' }));

  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
