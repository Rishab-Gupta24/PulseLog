import { router } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '@/components/ui/Button';
import { getThemeColors, hairlineWidth, spacing, tabularNums } from '@/constants/theme';
import { toLocalDateString } from '@/utils/dateUtils';

// Placeholder until the Today dashboard is built in Task 1.7.
export default function TodayScreen() {
  const theme = getThemeColors(useColorScheme());

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg.canvas }]}>
      <View style={[styles.card, { backgroundColor: theme.bg.card, borderColor: theme.border.hairline }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>PulseLog</Text>
        <Text style={[styles.subtitle, tabularNums, { color: theme.text.secondary }]}>
          Today: {toLocalDateString()}
        </Text>
        <Button label="Targets (optional)" variant="secondary" onPress={() => router.push('/modals/targets')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.sm,
  },
  card: {
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: hairlineWidth,
    borderRadius: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
  },
});
