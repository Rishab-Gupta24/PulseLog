import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { getThemeColors } from '@/constants/theme';
import { DATABASE_NAME, initializeDatabase } from '@/db/client';

// Screens render only after initializeDatabase (PRAGMAs + migrations) resolves.
// Later tasks add optional-target loading here and the (tabs) group.
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = getThemeColors(scheme);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg.canvas },
        }}
      >
        <Stack.Screen
          name="modals/targets"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Targets',
            headerStyle: { backgroundColor: theme.bg.card },
            headerTintColor: theme.text.primary,
          }}
        />
      </Stack>
    </SQLiteProvider>
  );
}
