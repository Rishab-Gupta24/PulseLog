import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { formatShortDate } from '@/components/charts/weightChartData';
import { WeightTrendChart } from '@/components/charts/WeightTrendChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getThemeColors, hairlineWidth, MIN_TOUCH_TARGET, spacing, tabularNums, type ThemeColors } from '@/constants/theme';
import {
  computeWeightTrend,
  deleteWeightLog,
  DuplicateWeightDateError,
  getWeightLogs,
  parseWeightInput,
  saveWeightLog,
  updateWeightLog,
  WeightValidationError,
  type WeightLog,
} from '@/services/weightService';
import { isValidLocalDateString, toLocalDateString } from '@/utils/dateUtils';

interface WeightForm {
  editingId: number | null;
  dateText: string;
  weightText: string;
}

interface WeightFormErrors {
  date?: string;
  weight?: string;
  general?: string;
}

function newForm(): WeightForm {
  return { editingId: null, dateText: toLocalDateString(), weightText: '' };
}

function formatKg(value: number): string {
  return value.toFixed(1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Weight logging + 7-day moving average chart. Step entry is added here in Task 1.7.
export default function TrendsScreen() {
  const db = useSQLiteContext();
  const theme = getThemeColors(useColorScheme());
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [form, setForm] = useState<WeightForm>(newForm);
  const [errors, setErrors] = useState<WeightFormErrors>({});
  const [busy, setBusy] = useState(true);

  async function reload(): Promise<void> {
    setLogs(await getWeightLogs(db));
  }

  useEffect(() => {
    let active = true;
    getWeightLogs(db)
      .then((loaded) => {
        if (active) setLogs(loaded);
      })
      .catch((error: unknown) => {
        if (active) setErrors({ general: `Could not load weights: ${errorMessage(error)}` });
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const trend = computeWeightTrend(logs);
  const latest = trend.length > 0 ? trend[trend.length - 1] : null;
  const averageByDate = new Map(trend.map((point) => [point.loggedDate, point.movingAverageKg]));
  const replacing =
    form.editingId === null ? logs.find((entry) => entry.loggedDate === form.dateText.trim()) : undefined;

  function updateForm(changes: Partial<WeightForm>): void {
    setForm((current) => ({ ...current, ...changes }));
    setErrors({});
  }

  async function submit(): Promise<void> {
    const loggedDate = form.dateText.trim();
    const nextErrors: WeightFormErrors = {};
    if (!isValidLocalDateString(loggedDate)) nextErrors.date = 'Use a date like 2026-10-26.';
    else if (loggedDate > toLocalDateString()) nextErrors.date = 'You can’t log a weight for a future date.';

    let weightKg = 0;
    try {
      weightKg = parseWeightInput(form.weightText);
    } catch (error) {
      if (!(error instanceof WeightValidationError)) throw error;
      nextErrors.weight = error.message;
    }
    if (nextErrors.date !== undefined || nextErrors.weight !== undefined) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      if (form.editingId === null) {
        await saveWeightLog(db, { loggedDate, weightKg });
      } else {
        const updated = await updateWeightLog(db, form.editingId, { loggedDate, weightKg });
        if (updated === null) setErrors({ general: 'That entry was already deleted.' });
      }
      await reload();
      setForm(newForm());
    } catch (error) {
      if (error instanceof DuplicateWeightDateError) setErrors({ date: error.message });
      else setErrors({ general: `Could not save weight: ${errorMessage(error)}` });
    } finally {
      setBusy(false);
    }
  }

  function startEditing(entry: WeightLog): void {
    setForm({ editingId: entry.id, dateText: entry.loggedDate, weightText: formatKg(entry.weightKg) });
    setErrors({});
  }

  function confirmDelete(entry: WeightLog): void {
    Alert.alert('Delete weight entry?', `${entry.loggedDate} · ${formatKg(entry.weightKg)} kg will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void removeEntry(entry);
        },
      },
    ]);
  }

  async function removeEntry(entry: WeightLog): Promise<void> {
    setBusy(true);
    try {
      await deleteWeightLog(db, entry.id);
      if (form.editingId === entry.id) setForm(newForm());
      await reload();
    } catch (error) {
      setErrors({ general: `Could not delete weight: ${errorMessage(error)}` });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, tabularNums, { backgroundColor: theme.bg.input, color: theme.text.primary }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg.canvas }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card title={form.editingId === null ? 'Log weight' : 'Edit weight'}>
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Date</Text>
            <TextInput
              accessibilityLabel="Weight date"
              value={form.dateText}
              onChangeText={(dateText) => updateForm({ dateText })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.text.secondary}
              autoCorrect={false}
              maxLength={10}
              editable={!busy}
              style={[inputStyle, errors.date !== undefined && { borderColor: theme.accent.danger }]}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Weight (kg)</Text>
            <TextInput
              accessibilityLabel="Weight in kg"
              value={form.weightText}
              onChangeText={(weightText) => updateForm({ weightText })}
              placeholder="75.0"
              placeholderTextColor={theme.text.secondary}
              keyboardType="decimal-pad"
              editable={!busy}
              style={[inputStyle, errors.weight !== undefined && { borderColor: theme.accent.danger }]}
            />
          </View>
        </View>
        {errors.date !== undefined && <ErrorText theme={theme} message={errors.date} />}
        {errors.weight !== undefined && <ErrorText theme={theme} message={errors.weight} />}
        {replacing !== undefined && (
          <Text style={[styles.hint, tabularNums, { color: theme.text.secondary }]}>
            Replaces the {formatKg(replacing.weightKg)} kg already logged for this date.
          </Text>
        )}
        <View style={styles.formActions}>
          <Button
            label={form.editingId === null ? 'Save weight' : 'Update weight'}
            onPress={submit}
            disabled={busy}
            style={styles.flexButton}
          />
          {form.editingId !== null && (
            <Button label="Cancel" variant="secondary" onPress={() => updateForm(newForm())} style={styles.flexButton} />
          )}
        </View>
      </Card>

      {errors.general !== undefined && <ErrorText theme={theme} message={errors.general} />}

      <Card title="Weight trend">
        {latest !== null && (
          <View>
            <Text style={[styles.headline, tabularNums, { color: theme.text.primary }]}>
              {formatKg(latest.movingAverageKg)} kg
              <Text style={[styles.headlineUnit, { color: theme.text.secondary }]}> 7-day average</Text>
            </Text>
            <Text style={[styles.hint, tabularNums, { color: theme.text.secondary }]}>
              Based on {latest.sampleCount} {latest.sampleCount === 1 ? 'entry' : 'entries'} up to{' '}
              {formatShortDate(latest.loggedDate)}
            </Text>
          </View>
        )}
        <WeightTrendChart points={trend} />
      </Card>

      <Card title="History">
        {logs.length === 0 && !busy && (
          <Text style={[styles.hint, { color: theme.text.secondary }]}>No weights logged yet.</Text>
        )}
        {[...logs].reverse().map((entry, index) => {
          const average = averageByDate.get(entry.loggedDate);
          return (
            <View
              key={entry.id}
              style={[
                styles.historyRow,
                index > 0 && { borderTopWidth: hairlineWidth, borderTopColor: theme.border.hairline },
              ]}
            >
              <View style={styles.historyText}>
                <Text style={[styles.historyWeight, tabularNums, { color: theme.text.primary }]}>
                  {formatKg(entry.weightKg)} kg
                </Text>
                <Text style={[styles.hint, tabularNums, { color: theme.text.secondary }]}>
                  {entry.loggedDate}
                  {average !== undefined ? ` · avg ${formatKg(average)}` : ''}
                </Text>
              </View>
              <Button
                label="Edit"
                variant="secondary"
                onPress={() => startEditing(entry)}
                disabled={busy}
                accessibilityHint={`Edit the weight logged for ${entry.loggedDate}`}
              />
              <Button
                label="Delete"
                variant="secondary"
                onPress={() => confirmDelete(entry)}
                disabled={busy}
                accessibilityHint={`Delete the weight logged for ${entry.loggedDate}`}
              />
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function ErrorText({ theme, message }: { theme: ThemeColors; message: string }) {
  return <Text style={[styles.error, { color: theme.accent.danger }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: 17,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flexButton: {
    flex: 1,
  },
  headline: {
    fontSize: 28,
    fontWeight: '600',
  },
  headlineUnit: {
    fontSize: 15,
    fontWeight: '400',
  },
  hint: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  historyText: {
    flex: 1,
  },
  historyWeight: {
    fontSize: 17,
  },
});
