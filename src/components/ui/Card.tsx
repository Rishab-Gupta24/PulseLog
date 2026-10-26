import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { getThemeColors, hairlineWidth, spacing } from '@/constants/theme';

export interface CardProps {
  title?: string;
  children: ReactNode;
}

/** Solid surface with a hairline border (design.md §3.1). */
export function Card({ title, children }: CardProps) {
  const theme = getThemeColors(useColorScheme());

  return (
    <View style={[styles.card, { backgroundColor: theme.bg.card, borderColor: theme.border.hairline }]}>
      {title !== undefined && (
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: hairlineWidth,
    borderRadius: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
