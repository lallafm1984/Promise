import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { getActiveScheduleRepository } from '@/data/scheduleRepository';
import {
  checkSocialNotifications,
  configureAppNotifications,
  disableAppNotifications,
  enableAppNotifications,
  getAppNotificationPermissionStatus,
  getAppNotificationSettingsSnapshot,
  installSocialNotificationRealtimeRefresh,
  installNotificationResponseHandler,
  isAppNotificationEnabled,
  scheduleAppointmentReminders,
  seedCurrentSocialNotificationState,
  sendTestAppNotification,
  syncPushTokenRegistration,
} from '@/lib/appNotifications';
import type { AppNotificationPermissionStatus } from '@/lib/notificationStatus';
import { supabase } from '@/lib/supabase';

async function refreshEnabledNotifications() {
  if (!(await isAppNotificationEnabled())) {
    return;
  }

  const { repository } = await getActivePromiseRepository();
  const { repository: scheduleRepository } = await getActiveScheduleRepository();
  const [, profile, cardScheduleItems, manualScheduleItems] = await Promise.all([
    syncPushTokenRegistration(),
    repository.getHostProfile(),
    repository.listScheduleItems(),
    scheduleRepository.listManualScheduleItems(),
  ]);

  await Promise.all([
    checkSocialNotifications(),
    scheduleAppointmentReminders(profile, [...cardScheduleItems, ...manualScheduleItems]),
  ]);
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
    void installSocialNotificationRealtimeRefresh(refreshEnabledNotifications).then((remove) => {
      if (!isSubscribed) {
        remove();
        return;
      }

      removeRealtimeRefresh = remove;
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshEnabledNotifications();
      }
    });
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      void refreshEnabledNotifications();
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

export function useNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AppNotificationPermissionStatus>('unknown');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { enabled: nextEnabled, permissionStatus: nextPermissionStatus } = await getAppNotificationSettingsSnapshot();

    setEnabled(nextEnabled);
    setPermissionStatus(nextPermissionStatus);
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '알림을 끄지 못했어요.');
      const { enabled: nextEnabled, permissionStatus: nextPermissionStatus } = await getAppNotificationSettingsSnapshot();

      setEnabled(nextEnabled);
      setPermissionStatus(nextPermissionStatus);
    } finally {
      setIsWorking(false);
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
    error,
    reload,
    enable,
    disable,
    sendTest,
  };
}
