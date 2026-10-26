/**
 * Plain solid design tokens (see design.md §3–§4). No gradients, no translucency
 * until Milestone 3.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: {
    /** Main screen background. */
    canvas: string;
    /** Solid cards, workout containers and list rows. */
    card: string;
    /** Text inputs and unselected portion/intensity pills. */
    input: string;
  };
  border: {
    /** Hairline card borders and row dividers. */
    hairline: string;
  };
  text: {
    /** Headings, exercise titles and numbers. */
    primary: string;
    /** Units (kg, kcal, g) and secondary labels. */
    secondary: string;
  };
  accent: {
    /** Primary actions, selected pills and the 7-day average line. */
    primary: string;
    /** Completed sets and target completion. */
    success: string;
    /** "Approximate Estimate" and "MET approx." badge text. */
    estimate: string;
    /** Delete and destructive restore confirmation. */
    danger: string;
  };
}

export const colors: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: { canvas: '#0A0A0C', card: '#141417', input: '#1C1C21' },
    border: { hairline: '#26262C' },
    text: { primary: '#F5F5F7', secondary: '#8E8E93' },
    accent: { primary: '#0A84FF', success: '#30D158', estimate: '#FF9F0A', danger: '#FF453A' },
  },
  light: {
    bg: { canvas: '#F5F5F7', card: '#FFFFFF', input: '#EBEBF0' },
    border: { hairline: '#E2E2E8' },
    text: { primary: '#1D1D1F', secondary: '#6E6E73' },
    accent: { primary: '#007AFF', success: '#34C759', estimate: '#FF9500', danger: '#FF3B30' },
  },
};

/** Dark is the default theme; light applies only when the OS explicitly asks for it. */
export function getThemeColors(scheme: string | null | undefined): ThemeColors {
  return scheme === 'light' ? colors.light : colors.dark;
}

/** 8pt grid: every padding, margin and gap must come from this scale. */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

/** Minimum hit area in logical units (pt on iOS / dp on Android). */
export const MIN_TOUCH_TARGET = 44;

/** Spread into every pressable control's style. */
export const touchTarget: ViewStyle = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
};

export const hairlineWidth = StyleSheet.hairlineWidth;

/** Apply to every weight, rep, calorie, macro and step number so digits don't jitter. */
export const tabularNums: TextStyle = {
  fontVariant: ['tabular-nums'],
};
