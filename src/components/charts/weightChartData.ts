/**
 * Pure mapping from weight trend points to react-native-gifted-charts line data.
 * Kept separate from the chart component so axis and spacing math is unit-tested.
 */
import type { WeightTrendPoint } from '@/services/weightService';
import { diffLocalDays, type LocalDateString } from '@/utils/dateUtils';

/** Structural subset of gifted-charts' `lineDataItem`. */
export interface ChartPoint {
  value: number;
  label?: string;
  /** Horizontal gap to the NEXT point, so gaps in logging show as gaps on the x-axis. */
  spacing?: number;
}

export interface WeightChartData {
  raw: ChartPoint[];
  average: ChartPoint[];
  /** Absolute y-axis start (kg); gifted-charts subtracts it from every value. */
  yAxisOffset: number;
  stepValue: number;
  noOfSections: number;
}

export const PIXELS_PER_DAY = 16;
/** Minimum days between x-axis labels so they never overlap. */
export const LABEL_EVERY_DAYS = 7;
const NICE_STEPS_KG = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50] as const;
const TARGET_SECTIONS = 4;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function buildWeightChartData(
  points: readonly WeightTrendPoint[],
  pixelsPerDay: number = PIXELS_PER_DAY,
): WeightChartData {
  const raw: ChartPoint[] = [];
  const average: ChartPoint[] = [];
  let lastLabelDate: LocalDateString | null = null;

  points.forEach((point, index) => {
    const next = points[index + 1];
    const spacing = next ? diffLocalDays(point.loggedDate, next.loggedDate) * pixelsPerDay : undefined;
    const showLabel = lastLabelDate === null || diffLocalDays(lastLabelDate, point.loggedDate) >= LABEL_EVERY_DAYS;
    if (showLabel) lastLabelDate = point.loggedDate;
    const label = showLabel ? formatShortDate(point.loggedDate) : undefined;

    raw.push({ value: point.weightKg, label, spacing });
    average.push({ value: point.movingAverageKg, spacing });
  });

  return { raw, average, ...computeYAxis(points) };
}

/** e.g. `2026-10-26` → `Oct 26`. Avoids Intl so output is identical on every device. */
export function formatShortDate(value: LocalDateString): string {
  const [, month, day] = value.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

function computeYAxis(points: readonly WeightTrendPoint[]): Pick<WeightChartData, 'yAxisOffset' | 'stepValue' | 'noOfSections'> {
  if (points.length === 0) return { yAxisOffset: 0, stepValue: 1, noOfSections: TARGET_SECTIONS };

  const values = points.flatMap((p) => [p.weightKg, p.movingAverageKg]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = NICE_STEPS_KG.find((candidate) => candidate * TARGET_SECTIONS >= max - min) ?? 100;

  // Leave at least half a step of headroom above and below the data.
  const yAxisOffset = Math.max(0, Math.floor((min - step / 2) / step) * step);
  const noOfSections = Math.max(1, Math.ceil((max + step / 2 - yAxisOffset) / step));
  return { yAxisOffset, stepValue: step, noOfSections };
}
