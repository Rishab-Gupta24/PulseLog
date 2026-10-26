import { Tabs } from 'expo-router/js-tabs';
import { useColorScheme } from 'react-native';

import { getThemeColors, hairlineWidth } from '@/constants/theme';

// Plain solid tab bar (Liquid Glass is Milestone 3). Workouts and Nutrition tabs are
// added in Tasks 1.5 and 1.6.
export default function TabsLayout() {
  const theme = getThemeColors(useColorScheme());

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg.card },
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg.canvas },
        tabBarStyle: {
          backgroundColor: theme.bg.card,
          borderTopColor: theme.border.hairline,
          borderTopWidth: hairlineWidth,
        },
        tabBarActiveTintColor: theme.accent.primary,
        tabBarInactiveTintColor: theme.text.secondary,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
    </Tabs>
  );
}
