import { Pressable, StyleSheet, Text, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { getThemeColors, spacing, touchTarget } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Solid primary or plain text-style secondary button with a 44×44 minimum hit area. */
export function Button({ label, onPress, variant = 'primary', disabled = false, accessibilityHint, style }: ButtonProps) {
  const theme = getThemeColors(useColorScheme());
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? { backgroundColor: theme.accent.primary } : { backgroundColor: theme.bg.input },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: isPrimary ? '#FFFFFF' : theme.text.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    ...touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.xs,
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
});
