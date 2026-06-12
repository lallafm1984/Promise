import { CalendarDays, Home, PlusCircle, UserRound, type LucideIcon } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { palette } from '@/constants/theme';

function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon color={String(color)} size={size} strokeWidth={2.4} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkSoft,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarStyle: {
          alignSelf: Platform.OS === 'web' ? 'flex-start' : 'center',
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
          height: 72,
          maxWidth: 350,
          paddingBottom: 10,
          paddingTop: 8,
          width: '100%',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '인박스',
          tabBarIcon: tabIcon(Home),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '카드',
          tabBarIcon: tabIcon(PlusCircle),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '주간',
          tabBarIcon: tabIcon(CalendarDays),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내정보',
          tabBarIcon: tabIcon(UserRound),
        }}
      />
    </Tabs>
  );
}
