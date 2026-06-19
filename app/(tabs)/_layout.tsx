import { Archive, CalendarDays, PlusCircle, UserRound, UsersRound, type LucideIcon } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';
import { getNativeBottomInset, getTabBarHeight } from '@/lib/layoutInsets';

function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon color={String(color)} size={size} strokeWidth={2.4} />;
  };
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : getNativeBottomInset(insets.bottom);

  return (
    <Tabs
      initialRouteName="create"
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
          height: getTabBarHeight(bottomInset),
          maxWidth: 430,
          paddingBottom: 10 + bottomInset,
          paddingTop: 8,
          width: '100%',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
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
        name="manage"
        options={{
          title: '관리함',
          tabBarIcon: tabIcon(Archive),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '일정',
          tabBarIcon: tabIcon(CalendarDays),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarIcon: tabIcon(UsersRound),
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
