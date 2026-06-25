import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAppNotificationRuntime, useInitialNotificationPermissionPrompt } from '@/hooks/useAppNotifications';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getMandatoryAuthGateState } from '@/lib/authGate';
import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/supabaseAuth';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const authGate = getMandatoryAuthGateState({ isAuthenticated, isLoading });
  useAppNotificationRuntime();
  useInitialNotificationPermissionPrompt({ enabled: authGate.canHideSplash });

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(true);
    }
  }, []);

  useEffect(() => {
    if (authGate.canHideSplash) {
      void SplashScreen.hideAsync();
    }
  }, [authGate.canHideSplash]);

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (isAuthCallbackUrl(url)) {
        void createSessionFromUrl(url)
          .then((session) => {
            if (session) {
              router.replace('/schedule');
              return;
            }

            router.replace('/auth/callback' as never);
          })
          .catch((authError: unknown) => {
            console.warn('Auth callback failed', authError);
            router.replace('/auth/callback' as never);
          });
      }
    }

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {Platform.OS === 'android' ? <NavigationBar hidden style="dark" /> : null}
      <Stack>
        <Stack.Protected guard={authGate.canUseAppRoutes}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={authGate.canUseLoginRoute}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={authGate.canUseAuthCallback}>
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
