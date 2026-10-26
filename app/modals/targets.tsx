import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { Button } from '@/components/ui/Button';
import { getThemeColors, hairlineWidth, MIN_TOUCH_TARGET, spacing, tabularNums } from '@/constants/theme';
import {
  clearAllTargets,
  getTargets,
  parseTargetInput,
  setTargets,
  TARGET_FIELDS,
  TargetValidationError,
  type TargetKey,
  type UserTargets,
} from '@/services/targetsService';

type TargetDrafts = Record<TargetKey, string>;
type TargetErrors = Partial<Record<TargetKey, string>>;

function toDrafts(targets: UserTargets): TargetDrafts {
  return {
    daily_calorie_target: targets.daily_calorie_target?.toString() ?? '',
    daily_protein_g: targets.daily_protein_g?.toString() ?? '',
    daily_carbs_g: targets.daily_carbs_g?.toString() ?? '',
    daily_fat_g: targets.daily_fat_g?.toString() ?? '',
    daily_steps_target: targets.daily_steps_target?.toString() ?? '',
  };
}

const EMPTY_DRAFTS: TargetDrafts = {
  daily_calorie_target: '',
  daily_protein_g: '',
  daily_carbs_g: '',
  daily_fat_g: '',
  daily_steps_target: '',
};

function close(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

// Optional targets settings. Backup export/import is added here in Task 1.7.
export default function TargetsModal() {
  const db = useSQLiteContext();
  const theme = getThemeColors(useColorScheme());
  const [drafts, setDrafts] = useState<TargetDrafts>(EMPTY_DRAFTS);
  const [errors, setErrors] = useState<TargetErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    getTargets(db)
      .then((targets) => {
        if (active) setDrafts(toDrafts(targets));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [db]);

  function updateDraft(key: TargetKey, text: string): void {
    setDrafts((current) => ({ ...current, [key]: text }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function save(): Promise<void> {
    const updates: Partial<UserTargets> = {};
    const nextErrors: TargetErrors = {};
    for (const field of TARGET_FIELDS) {
      try {
        updates[field.key] = parseTargetInput(field.key, drafts[field.key]);
      } catch (error) {
        if (!(error instanceof TargetValidationError)) throw error;
        nextErrors[field.key] = error.message;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      await setTargets(db, updates);
      close();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function clearAll(): Promise<void> {
    setBusy(true);
    try {
      await clearAllTargets(db);
      close();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg.canvas }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.intro, { color: theme.text.secondary }]}>
        All targets are optional. Leave a field empty to just log totals without a progress bar.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.bg.card, borderColor: theme.border.hairline }]}>
        {TARGET_FIELDS.map((field, index) => (
          <View
            key={field.key}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: hairlineWidth, borderTopColor: theme.border.hairline },
            ]}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.label, { color: theme.text.primary }]}>{field.label}</Text>
              <TextInput
                accessibilityLabel={`${field.label} target in ${field.unit}`}
                value={drafts[field.key]}
                onChangeText={(text) => updateDraft(field.key, text)}
                placeholder="Not set"
                placeholderTextColor={theme.text.secondary}
                keyboardType="number-pad"
                returnKeyType="done"
                editable={!busy}
                style={[
                  styles.input,
                  tabularNums,
                  { backgroundColor: theme.bg.input, color: theme.text.primary },
                  errors[field.key] !== undefined && { borderColor: theme.accent.danger },
                ]}
              />
              <Text style={[styles.unit, { color: theme.text.secondary }]}>{field.unit}</Text>
            </View>
            {errors[field.key] !== undefined && (
              <Text style={[styles.error, { color: theme.accent.danger }]}>{errors[field.key]}</Text>
            )}
          </View>
        ))}
      </View>

      {loadError !== null && (
        <Text style={[styles.error, { color: theme.accent.danger }]}>Could not update targets: {loadError}</Text>
      )}

      <View style={styles.actions}>
        <Button label="Save targets" onPress={save} disabled={busy} />
        <Button
          label="Skip for now"
          variant="secondary"
          onPress={close}
          accessibilityHint="Closes without changing your targets"
        />
        <Button
          label="Clear all targets"
          variant="secondary"
          onPress={clearAll}
          disabled={busy}
          accessibilityHint="Removes every target; your logs are not affected"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  intro: {
    fontSize: 15,
  },
  card: {
    borderWidth: hairlineWidth,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  row: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: 17,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 112,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: 17,
    textAlign: 'right',
  },
  unit: {
    width: 48,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
  },
  actions: {
    gap: spacing.xs,
  },
});
