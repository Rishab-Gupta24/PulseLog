import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getThemeColors, hairlineWidth, spacing, tabularNums } from '@/constants/theme';
import { toLocalDateString } from '@/utils/dateUtils';

// Placeholder screen until the Today tab is built in Task 1.7.
export default function PlaceholderScreen() {
  const theme = getThemeColors(useColorScheme());

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg.canvas }]}>
      <View style={[styles.card, { backgroundColor: theme.bg.card, borderColor: theme.border.hairline }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>PulseLog</Text>
        <Text style={[styles.subtitle, tabularNums, { color: theme.text.secondary }]}>
          Today: {toLocalDateString()}
        </Text>
      </View>
    </SafeAreaView>
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
