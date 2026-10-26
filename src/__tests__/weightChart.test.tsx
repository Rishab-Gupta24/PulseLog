import { act, render, screen } from '@testing-library/react-native';

import { buildWeightChartData, formatShortDate, PIXELS_PER_DAY } from '@/components/charts/weightChartData';
import { WeightTrendChart } from '@/components/charts/WeightTrendChart';
import { computeWeightTrend, type WeightLogInput } from '@/services/weightService';

function log(loggedDate: string, weightKg: number): WeightLogInput {
  return { loggedDate, weightKg };
}

describe('buildWeightChartData', () => {
  it('spaces points by calendar days so logging gaps show on the x-axis', () => {
    const data = buildWeightChartData(
      computeWeightTrend([log('2026-10-01', 80), log('2026-10-02', 79.5), log('2026-10-05', 79)]),
    );
    expect(data.raw.map((p) => p.spacing)).toEqual([PIXELS_PER_DAY, 3 * PIXELS_PER_DAY, undefined]);
    expect(data.average.map((p) => p.spacing)).toEqual(data.raw.map((p) => p.spacing));
  });

  it('plots raw weights and the moving average as two aligned series', () => {
    const data = buildWeightChartData(computeWeightTrend([log('2026-10-01', 80), log('2026-10-02', 78)]));
    expect(data.raw.map((p) => p.value)).toEqual([80, 78]);
    expect(data.average.map((p) => p.value)).toEqual([80, 79]);
  });

  it('labels the first point and then at most one point per 7 days', () => {
    const logs = Array.from({ length: 15 }, (_, i) => log(`2026-10-${String(i + 1).padStart(2, '0')}`, 80));
    const labels = buildWeightChartData(computeWeightTrend(logs)).raw.map((p) => p.label);
    expect(labels.filter((label) => label !== undefined)).toEqual(['Oct 1', 'Oct 8', 'Oct 15']);
  });

  it('zooms the y-axis to the data instead of starting at 0 kg', () => {
    const data = buildWeightChartData(computeWeightTrend([log('2026-10-01', 75.2), log('2026-10-02', 76.8)]));
    const top = data.yAxisOffset + data.stepValue * data.noOfSections;
    expect(data.yAxisOffset).toBeGreaterThan(70);
    expect(data.yAxisOffset).toBeLessThanOrEqual(75.2 - data.stepValue / 2);
    expect(top).toBeGreaterThanOrEqual(76.8 + data.stepValue / 2);
    expect(data.stepValue).toBe(0.5);
  });

  it('handles a flat trend', () => {
    const data = buildWeightChartData(computeWeightTrend([log('2026-10-01', 75), log('2026-10-02', 75)]));
    expect(data.noOfSections).toBeGreaterThanOrEqual(1);
    expect(data.yAxisOffset).toBeLessThan(75);
    expect(data.yAxisOffset + data.stepValue * data.noOfSections).toBeGreaterThan(75);
  });

  it('formats short dates without Intl', () => {
    expect(formatShortDate('2026-01-05')).toBe('Jan 5');
    expect(formatShortDate('2026-12-31')).toBe('Dec 31');
  });
});

describe('WeightTrendChart', () => {
  // gifted-charts schedules line-width timeouts even with isAnimated={false}; flush them
  // before unmount so they don't fire after the Jest environment is torn down.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    screen.unmount();
    jest.useRealTimers();
  });

  it('asks for more data with fewer than two weights', async () => {
    await render(<WeightTrendChart points={computeWeightTrend([log('2026-10-01', 80)])} />);
    expect(screen.getByText('Log at least two weights to see a trend line.')).toBeOnTheScreen();
  });

  it('renders the gifted-charts line chart and legend', async () => {
    await render(<WeightTrendChart points={computeWeightTrend([log('2026-10-01', 80), log('2026-10-08', 79)])} />);
    expect(screen.getByLabelText('Weight chart with 2 entries')).toBeOnTheScreen();
    expect(screen.getByText('Daily weight')).toBeOnTheScreen();
    expect(screen.getByText('7-day average')).toBeOnTheScreen();
    expect(screen.getByText('Oct 1')).toBeOnTheScreen();
  });
});
