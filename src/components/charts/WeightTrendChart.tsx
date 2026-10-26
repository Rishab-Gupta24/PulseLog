import { StyleSheet, Text, View, useColorScheme } from 'react-native';
// Deep import: the package root also loads BarChart, which throws at import time unless a
// gradient library is installed. PulseLog uses no gradients (Rules.md §2.1).
import { LineChart } from 'react-native-gifted-charts/dist/LineChart';

import { buildWeightChartData } from '@/components/charts/weightChartData';
import { getThemeColors, spacing } from '@/constants/theme';
import type { WeightTrendPoint } from '@/services/weightService';

export interface WeightTrendChartProps {
  points: readonly WeightTrendPoint[];
}

const CHART_HEIGHT = 176;

/** Raw daily weights (dots) with the 7-day moving average line on top. */
export function WeightTrendChart({ points }: WeightTrendChartProps) {
  const theme = getThemeColors(useColorScheme());

  if (points.length < 2) {
    return (
      <Text style={[styles.empty, { color: theme.text.secondary }]}>
        Log at least two weights to see a trend line.
      </Text>
    );
  }

  const data = buildWeightChartData(points);
  const axisText = { color: theme.text.secondary, fontSize: 11 };

  return (
    <View style={styles.container} accessible accessibilityLabel={`Weight chart with ${points.length} entries`}>
      <LineChart
        data={data.raw}
        data2={data.average}
        height={CHART_HEIGHT}
        initialSpacing={spacing.xs}
        endSpacing={spacing.sm}
        yAxisOffset={data.yAxisOffset}
        stepValue={data.stepValue}
        noOfSections={data.noOfSections}
        color1={theme.text.secondary}
        thickness1={1}
        dataPointsColor1={theme.text.secondary}
        dataPointsRadius1={3}
        color2={theme.accent.primary}
        thickness2={3}
        hideDataPoints2
        rulesColor={theme.border.hairline}
        rulesType="solid"
        xAxisColor={theme.border.hairline}
        yAxisColor={theme.border.hairline}
        yAxisTextStyle={axisText}
        xAxisLabelTextStyle={axisText}
        scrollToEnd
        isAnimated={false}
      />
      <View style={styles.legend}>
        <LegendItem color={theme.text.secondary} label="Daily weight" textColor={theme.text.secondary} />
        <LegendItem color={theme.accent.primary} label="7-day average" textColor={theme.text.secondary} thick />
      </View>
    </View>
  );
}

function LegendItem({ color, label, textColor, thick = false }: { color: string; label: string; textColor: string; thick?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color, height: thick ? 3 : 1 }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  empty: {
    fontSize: 15,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: spacing.sm,
  },
  legendText: {
    fontSize: 13,
  },
});
