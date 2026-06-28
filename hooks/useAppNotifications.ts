import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { readSchedulePlannerCache } from '@/data/localSchedulePlannerStorage';
import { getActivePromiseRepository } from '@/data/promiseRepository';
import {
  checkSocialNotifications,
  configureAppNotifications,
  DEFAULT_APP_NOTIFICATION_PREFERENCES,
  disableAppNotifications,
  enableAppNotifications,
  ensureAppNotificationEnabledForGrantedPermission,
  getAppNotificationPreferencesSnapshot,
  getAppNotificationPermissionStatus,
  getAppNotificationSettingsSnapshot,
  installSocialNotificationRealtimeRefresh,
  installNotificationResponseHandler,
  isAppNotificationEnabled,
  scheduleAppointmentReminders,
  seedCurrentSocialNotificationState,
  sendTestAppNotification,
  setAppNotificationCategoryEnabled,
  setAppNotificationReminderLead,
  syncPushTokenRegistration,
  type AppNotificationCategory,
  type AppNotificationPreferences,
} from '@/lib/appNotifications';
import type { AppNotificationPermissionStatus } from '@/lib/notificationStatus';
import type { ReminderLead, ScheduleItem } from '@/types/promise';
import { supabase } from '@/lib/supabase';

const INITIAL_NOTIFICATION_PERMISSION_PROMPT_KEY = 'whenbollae:notifications:initial-permission-prompt-seen:v2';
let enabledNotificationRefreshQueue: Promise<void> = Promise.resolve();

async function refreshEnabledNotificationsWithManualScheduleItemsOnce(manualScheduleItems: ScheduleItem[]) {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return;
  }

  const { repository } = await getActivePromiseRepository();
  const [, profile, cardScheduleItems] = await Promise.all([
    syncPushTokenRegistration(),
    repository.getHostProfile(),
    repository.listScheduleItems(),
  ]);

  await Promise.all([
    checkSocialNotifications(),
    scheduleAppointmentReminders(profile, [...cardScheduleItems, ...manualScheduleItems]),
  ]);
}

export async function refreshEnabledNotificationsWithManualScheduleItems(manualScheduleItems: ScheduleItem[]) {
  const nextRefresh = enabledNotificationRefreshQueue.then(
    () => refreshEnabledNotificationsWithManualScheduleItemsOnce(manualScheduleItems),
    () => refreshEnabledNotificationsWithManualScheduleItemsOnce(manualScheduleItems),
  );
  enabledNotificationRefreshQueue = nextRefresh.catch(() => undefined);

  return nextRefresh;
}

async function refreshEnabledNotifications() {
  const localScheduleCache = await readSchedulePlannerCache();

  await refreshEnabledNotificationsWithManualScheduleItems(localScheduleCache?.manualScheduleItems ?? []);
}

async function refreshSocialNotificationsImmediately() {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return;
  }

  await checkSocialNotifications();
  void refreshEnabledNotifications();
}

async function markInitialNotificationPermissionPromptSeen() {
  await AsyncStorage.setItem(INITIAL_NOTIFICATION_PERMISSION_PROMPT_KEY, 'true');
}

export function useAppNotificationRuntime() {
  useEffect(() => {
    void configureAppNotifications();
    const removeResponseHandler = installNotificationResponseHandler();

    return removeResponseHandler;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    void refreshEnabledNotifications();
    let isSubscribed = true;
    let removeRealtimeRefresh: (() => void) | null = null;
    let realtimeRefreshInstallId = 0;

    async function reinstallRealtimeRefresh() {
      const installId = realtimeRefreshInstallId + 1;
      realtimeRefreshInstallId = installId;
      removeRealtimeRefresh?.();
      removeRealtimeRefresh = null;
      const remove = await installSocialNotificationRealtimeRefresh(refreshSocialNotificationsImmediately);

      if (!isSubscribed) {
        remove();
        return;
      }

      if (installId !== realtimeRefreshInstallId) {
        remove();
        return;
      }

      removeRealtimeRefresh = remove;
    }

    void reinstallRealtimeRefresh();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshEnabledNotifications();
      }
    });
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      void refreshEnabledNotifications();
      void reinstallRealtimeRefresh();
    });
    const intervalId = setInterval(() => {
      void refreshEnabledNotifications();
    }, 60_000);

    return () => {
      isSubscribed = false;
      removeRealtimeRefresh?.();
      appStateSubscription.remove();
      authSubscription?.data.subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);
}

export function useInitialNotificationPermissionPrompt({ enabled = true }: { enabled?: boolean } = {}) {
  const didCheckPromptRef = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web' || didCheckPromptRef.current) {
      return undefined;
    }

    didCheckPromptRef.current = true;
    let isMounted = true;

    async function showPromptIfNeeded() {
      const [hasSeenPrompt, appNotificationEnabled] = await Promise.all([
        AsyncStorage.getItem(INITIAL_NOTIFICATION_PERMISSION_PROMPT_KEY),
        isAppNotificationEnabled(),
      ]);

      if (!isMounted || hasSeenPrompt === 'true' || appNotificationEnabled) {
        return;
      }

      try {
        await markInitialNotificationPermissionPromptSeen();
        const granted = await enableAppNotifications();

        if (!isMounted || !granted) {
          return;
        }

        await seedCurrentSocialNotificationState();
        await refreshEnabledNotifications();
      } catch (error) {
        console.warn('Initial notification permission prompt failed', error);
      }
    }

    void showPromptIfNeeded();

    return () => {
      isMounted = false;
    };
  }, [enabled]);
}

export function useNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AppNotificationPermissionStatus>('unknown');
  const [preferences, setPreferences] = useState<AppNotificationPreferences>(DEFAULT_APP_NOTIFICATION_PREFERENCES);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const {
      enabled: nextEnabled,
      permissionStatus: nextPermissionStatus,
      preferences: nextPreferences,
    } = await getAppNotificationSettingsSnapshot();

    setEnabled(nextEnabled);
    setPermissionStatus(nextPermissionStatus);
    setPreferences(nextPreferences);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enable = useCallback(async () => {
    setIsWorking(true);
    setError(null);

    try {
      const granted = await enableAppNotifications();

      if (!granted) {
        setError('휴대폰 알림 권한이 필요해요.');
        setEnabled(false);
        setPermissionStatus(await getAppNotificationPermissionStatus());
        return false;
      }

      await seedCurrentSocialNotificationState();
      await refreshEnabledNotifications();
      setEnabled(true);
      setPermissionStatus(await getAppNotificationPermissionStatus());
      setPreferences(await getAppNotificationPreferencesSnapshot());
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '알림을 켜지 못했어요.');
      setEnabled(false);
      setPermissionStatus(await getAppNotificationPermissionStatus());
      return false;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setIsWorking(true);
    setError(null);

    try {
      await disableAppNotifications();
      setEnabled(false);
      setPermissionStatus(await getAppNotificationPermissionStatus());
      setPreferences(await getAppNotificationPreferencesSnapshot());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '알림을 끄지 못했어요.');
      const { enabled: nextEnabled, permissionStatus: nextPermissionStatus } = await getAppNotificationSettingsSnapshot();

      setEnabled(nextEnabled);
      setPermissionStatus(nextPermissionStatus);
      setPreferences(await getAppNotificationPreferencesSnapshot());
    } finally {
      setIsWorking(false);
    }
  }, []);

  const setCategoryEnabled = useCallback(async (category: AppNotificationCategory, nextEnabled: boolean) => {
    setError(null);
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      categories: {
        ...currentPreferences.categories,
        [category]: nextEnabled,
      },
    }));

    try {
      const savedPreferences = await setAppNotificationCategoryEnabled(category, nextEnabled);
      setPreferences(savedPreferences);
      void refreshEnabledNotifications();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '알림 설정을 저장하지 못했어요.');
      setPreferences(await getAppNotificationPreferencesSnapshot());
    }
  }, []);

  const setReminderLead = useCallback(async (reminderLead: ReminderLead) => {
    setError(null);
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      reminderLead,
    }));

    try {
      const savedPreferences = await setAppNotificationReminderLead(reminderLead);
      setPreferences(savedPreferences);
      void refreshEnabledNotifications();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '리마인드 시간을 저장하지 못했어요.');
      setPreferences(await getAppNotificationPreferencesSnapshot());
    }
  }, []);

  const sendTest = useCallback(async () => {
    setIsWorking(true);
    setError(null);

    try {
      await sendTestAppNotification();
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '테스트 알림을 보내지 못했어요.');
      return false;
    } finally {
      setIsWorking(false);
    }
  }, []);

  return {
    enabled,
    isWorking,
    permissionStatus,
    preferences,
    error,
    reload,
    enable,
    disable,
    setCategoryEnabled,
    setReminderLead,
    sendTest,
  };
}
