import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { getThemeColors } from '@/constants/theme';

// Placeholder root layout for Task 1.1. Task 1.2 adds SQLite init; later tasks add the (tabs) group.
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = getThemeColors(scheme);

  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg.canvas },
        }}
      />
    </>
  );
}
