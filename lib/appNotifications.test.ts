import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageValues = new Map<string, string>();
const upsertNotificationToken = vi.fn();
const deleteNotificationToken = vi.fn();
const deleteNotificationTokenEq = vi.fn();
const rpc = vi.fn();
const channel = vi.fn();
const channelOn = vi.fn();
const channelSubscribe = vi.fn();
const channelUnsubscribe = vi.fn();
const getExpoPushTokenAsync = vi.fn();
const getAllScheduledNotificationsAsync = vi.fn();
const getLastNotificationResponse = vi.fn();
const addNotificationResponseReceivedListener = vi.fn();
const removeNotificationResponseReceivedListener = vi.fn();
const cancelScheduledNotificationAsync = vi.fn();
const scheduleNotificationAsync = vi.fn();
const setNotificationChannelAsync = vi.fn();
const setNotificationHandler = vi.fn();
const getPermissionsAsync = vi.fn();
const getActiveFriendRepository = vi.fn();
const getActivePromiseRepository = vi.fn();
const listFriendState = vi.fn();
const listReceivedCardAlerts = vi.fn();
const buildCardReceivedNotification = vi.fn();
const buildFriendAcceptedNotification = vi.fn();
const buildFriendRequestNotification = vi.fn();
const buildReminderSchedulePlan = vi.fn();
const mockPlatform = {
  OS: 'android',
};
const notificationEnabledKey = 'whenbollae:notifications:enabled:profile-minseo';
const seenFriendRequestIdsKey = 'whenbollae:notifications:seen-friend-request-ids:profile-minseo';
const seenFriendIdsKey = 'whenbollae:notifications:seen-friend-ids:profile-minseo';
const seenCardIdsKey = 'whenbollae:notifications:seen-card-ids:profile-minseo';
const reminderIdsKey = 'whenbollae:notifications:reminder-ids:profile-minseo';
const expoPushTokenKey = 'whenbollae:notifications:expo-push-token';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(asyncStorageValues.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      asyncStorageValues.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      asyncStorageValues.delete(key);
      return Promise.resolve();
    }),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    deviceName: '테스트폰',
    expoConfig: {
      extra: {
        eas: {
          projectId: 'project-test',
        },
      },
    },
  },
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: {
    MAX: 'max',
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
  },
  addNotificationResponseReceivedListener,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getExpoPushTokenAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Platform: mockPlatform,
}));

vi.mock('@/data/friendRepository', () => ({
  getActiveFriendRepository,
}));

vi.mock('@/data/promiseRepository', () => ({
  getActivePromiseRepository,
}));

vi.mock('@/lib/notifications', () => ({
  buildCardReceivedNotification,
  buildFriendAcceptedNotification,
  buildFriendRequestNotification,
  buildTestNotification: vi.fn(() => ({
    title: '언제볼래 테스트 알림',
    body: '폰 알림이 정상적으로 도착했어요.',
    data: { url: '/profile', type: 'test_notification', id: 'test-notification' },
  })),
  buildReminderSchedulePlan,
  getNewAcceptedFriends: vi.fn((seenIds, friends) => friends.filter((friend: { id: string }) => !seenIds.includes(friend.id))),
  getNewIncomingFriendRequests: vi.fn((seenIds, requests) =>
    requests.filter((request: { direction: string; id: string }) => request.direction === 'INCOMING' && !seenIds.includes(request.id)),
  ),
  getNewReceivedCardAlerts: vi.fn((seenIds, alerts) => alerts.filter((alert: { id: string }) => !seenIds.includes(alert.id))),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: {
                id: 'profile-minseo',
              },
            },
          },
        }),
      ),
    },
    channel,
    from: vi.fn((table: string) => {
      if (table !== 'notification_tokens') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        delete: deleteNotificationToken,
        upsert: upsertNotificationToken,
      };
    }),
    rpc,
  },
}));

describe('app notification registration', () => {
  beforeEach(() => {
    asyncStorageValues.clear();
    rpc.mockReset().mockResolvedValue({ error: null });
    channelOn.mockReset().mockReturnValue({
      on: channelOn,
      subscribe: channelSubscribe,
      unsubscribe: channelUnsubscribe,
    });
    channelSubscribe.mockReset().mockReturnValue({
      on: channelOn,
      subscribe: channelSubscribe,
      unsubscribe: channelUnsubscribe,
    });
    channelUnsubscribe.mockReset().mockResolvedValue(undefined);
    channel.mockReset().mockReturnValue({
      on: channelOn,
      subscribe: channelSubscribe,
      unsubscribe: channelUnsubscribe,
    });
    upsertNotificationToken.mockReset().mockResolvedValue({ error: null });
    deleteNotificationTokenEq.mockReset();
    const deleteQuery = { eq: deleteNotificationTokenEq };
    deleteNotificationTokenEq.mockReturnValue(deleteQuery);
    deleteNotificationToken.mockReset().mockReturnValue(deleteQuery);
    cancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
    getAllScheduledNotificationsAsync.mockReset().mockResolvedValue([]);
    getExpoPushTokenAsync.mockReset().mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
    getLastNotificationResponse.mockReset().mockReturnValue(null);
    removeNotificationResponseReceivedListener.mockReset();
    addNotificationResponseReceivedListener.mockReset().mockReturnValue({
      remove: removeNotificationResponseReceivedListener,
    });
    getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
    scheduleNotificationAsync.mockReset().mockResolvedValue('test-notification-id');
    setNotificationChannelAsync.mockClear();
    setNotificationHandler.mockClear();
    mockPlatform.OS = 'android';
    listFriendState.mockReset().mockResolvedValue({ friends: [], requests: [], suggestions: [] });
    listReceivedCardAlerts.mockReset().mockResolvedValue([]);
    getActiveFriendRepository.mockReset().mockResolvedValue({ repository: { listFriendState } });
    getActivePromiseRepository.mockReset().mockResolvedValue({ repository: { listReceivedCardAlerts } });
    buildCardReceivedNotification.mockReset().mockImplementation((card) => ({
      title: '새 약속 카드',
      body: `${card.requesterName}님이 카드를 보냈어요.`,
      data: { url: '/manage', type: 'card_received', id: card.id },
    }));
    buildFriendAcceptedNotification.mockReset().mockImplementation((friend) => ({
      title: '친구가 되었어요',
      body: `${friend.displayName}와 친구가 되었어요.`,
      data: { url: '/friends', type: 'friend_accepted', id: friend.id },
    }));
    buildFriendRequestNotification.mockReset().mockImplementation((request) => ({
      title: '친구 요청이 왔어요',
      body: `${request.displayName}님에게서 친구 요청이 왔어요.`,
      data: { url: '/friends', type: 'friend_request', id: request.id },
    }));
    buildReminderSchedulePlan.mockReset().mockReturnValue({
      cancelIdentifiers: [],
      scheduleItems: [],
      keptReminders: {},
    });
  });

  it('registers an Expo push token when notifications are already enabled and permission is granted', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBe('ExponentPushToken[test-token]');

    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-test' });
    expect(upsertNotificationToken).toHaveBeenCalledWith(
      {
        user_id: 'profile-minseo',
        provider: 'expo',
        token: 'ExponentPushToken[test-token]',
        device_label: 'android 테스트폰',
      },
      { onConflict: 'provider,token' },
    );
  });

  it('does not register a push token when the app notification setting is off', async () => {
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBeNull();

    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(upsertNotificationToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not read another account notification setting as the current account setting', async () => {
    asyncStorageValues.set('whenbollae:notifications:enabled:profile-other', 'true');
    const { isAppNotificationEnabled } = await import('./appNotifications');

    await expect(isAppNotificationEnabled()).resolves.toBe(false);
  });

  it('turns off the app notification setting when the phone permission is no longer granted', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(expoPushTokenKey, 'ExponentPushToken[test-token]');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBeNull();

    expect(deleteNotificationToken).toHaveBeenCalled();
    expect(asyncStorageValues.get(notificationEnabledKey)).toBe('false');
    expect(asyncStorageValues.has(expoPushTokenKey)).toBe(false);
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(upsertNotificationToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims an existing Expo push token for the current account before upserting it', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await syncPushTokenRegistration();

    expect(rpc).toHaveBeenCalledWith(
      'register_notification_token',
      expect.objectContaining({
        notification_provider: 'expo',
        notification_token: 'ExponentPushToken[test-token]',
      }),
    );
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(upsertNotificationToken.mock.invocationCallOrder[0]);
  });

  it('sends a test phone notification when the app notification setting is on', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const { sendTestAppNotification } = await import('./appNotifications');

    await sendTestAppNotification();

    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: '언제볼래 테스트 알림',
        body: '폰 알림이 정상적으로 도착했어요.',
        data: { url: '/profile', type: 'test_notification', id: 'test-notification' },
        sound: 'default',
      },
      trigger: {
        channelId: 'whenbollae-default',
      },
    });
  });

  it('does not send a test phone notification when the app notification setting is off', async () => {
    const { sendTestAppNotification } = await import('./appNotifications');

    await sendTestAppNotification();

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips notification response handlers on web', async () => {
    mockPlatform.OS = 'web';
    const { installNotificationResponseHandler } = await import('./appNotifications');

    const cleanup = installNotificationResponseHandler();
    cleanup();

    expect(getLastNotificationResponse).not.toHaveBeenCalled();
    expect(addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(removeNotificationResponseReceivedListener).not.toHaveBeenCalled();
  });

  it('refreshes social notifications immediately when the current account receives social database changes', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { installSocialNotificationRealtimeRefresh } = await import('./appNotifications');

    const cleanup = await installSocialNotificationRealtimeRefresh(refresh);

    expect(channel).toHaveBeenCalledWith(expect.stringMatching(/^whenbollae-social-notifications-profile-minseo-/));
    expect(channelOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'card_recipients',
        filter: 'recipient_profile_id=eq.profile-minseo',
      },
      expect.any(Function),
    );
    expect(channelOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_requests',
        filter: 'addressee_id=eq.profile-minseo',
      },
      expect.any(Function),
    );
    expect(channelOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_requests',
        filter: 'requester_id=eq.profile-minseo',
      },
      expect.any(Function),
    );
    expect(channelSubscribe).toHaveBeenCalled();

    for (const call of channelOn.mock.calls) {
      const handler = call[2] as (() => void) | undefined;
      handler?.();
    }
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(3);

    cleanup();
    expect(channelUnsubscribe).toHaveBeenCalled();
  });

  it('shows phone notifications for new friend requests, accepted friends, and received cards', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(seenFriendRequestIdsKey, '["request-old"]');
    asyncStorageValues.set(seenFriendIdsKey, '["friend-old"]');
    asyncStorageValues.set(seenCardIdsKey, '["card-old"]');
    listFriendState.mockResolvedValueOnce({
      friends: [
        {
          id: 'friend-jiu',
          profileId: 'profile-jiu',
          displayName: '지우',
          handle: 'jiu',
          avatarLabel: '지',
          color: '#DDEBFF',
          lastActiveLabel: '방금',
        },
      ],
      requests: [
        {
          id: 'request-harin',
          direction: 'INCOMING',
          profileId: 'profile-harin',
          displayName: '하린',
          handle: 'harin',
          avatarLabel: '하',
          color: '#FFE0B8',
          requestedAt: '2026-06-16T12:00:00+09:00',
        },
      ],
      suggestions: [],
    });
    listReceivedCardAlerts.mockResolvedValueOnce([
      {
        id: 'card-seongsu',
        title: '성수에서 언제볼래?',
        location: '성수',
        requesterName: '민서',
        createdAt: '2026-06-16T13:00:00+09:00',
      },
    ]);
    const { checkSocialNotifications } = await import('./appNotifications');

    await checkSocialNotifications();

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '친구 요청이 왔어요',
          data: { url: '/friends', type: 'friend_request', id: 'request-harin' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '친구가 되었어요',
          data: { url: '/friends', type: 'friend_accepted', id: 'friend-jiu' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '새 약속 카드',
          data: { url: '/manage', type: 'card_received', id: 'card-seongsu' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(asyncStorageValues.get(seenFriendRequestIdsKey)).toBe('["request-harin"]');
    expect(asyncStorageValues.get(seenFriendIdsKey)).toBe('["friend-jiu"]');
    expect(asyncStorageValues.get(seenCardIdsKey)).toBe('["card-seongsu"]');
  });

  it('schedules appointment reminder phone notifications on the reminder channel', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    buildReminderSchedulePlan.mockReturnValueOnce({
      cancelIdentifiers: ['old-reminder-id'],
      keptReminders: {
        'card-kept': {
          identifier: 'kept-reminder-id',
          fireDate: '2026-06-20T09:30:00.000Z',
          reminderLead: '30_MIN',
          startsAt: '2026-06-20T10:00:00.000Z',
          timeLabel: '19:00 - 20:00',
          location: '강남',
        },
      },
      scheduleItems: [
        {
          mapKey: 'card-gangnam',
          fireDate: new Date('2026-06-20T09:30:00.000Z'),
          content: {
            title: '약속 리마인드',
            body: '19:00 - 20:00 · 강남',
            data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
          },
          record: {
            fireDate: '2026-06-20T09:30:00.000Z',
            reminderLead: '30_MIN',
            startsAt: '2026-06-20T10:00:00.000Z',
            timeLabel: '19:00 - 20:00',
            location: '강남',
          },
        },
      ],
    });
    const { scheduleAppointmentReminders } = await import('./appNotifications');

    await scheduleAppointmentReminders(
      {
        id: 'profile-minseo',
        displayName: '민서',
        handle: 'minseo',
        profileUrl: 'whenbollae.app/@minseo',
        timezone: 'Asia/Seoul',
        availabilitySummary: [],
        reminderLead: '30_MIN',
      },
      [],
    );

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-reminder-id');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: '약속 리마인드',
        body: '19:00 - 20:00 · 강남',
        data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
        sound: 'default',
      },
      trigger: {
        type: 'date',
        date: new Date('2026-06-20T09:30:00.000Z'),
        channelId: 'whenbollae-reminders',
      },
    });
    expect(JSON.parse(asyncStorageValues.get(reminderIdsKey) ?? '{}')).toEqual({
      'card-kept': {
        identifier: 'kept-reminder-id',
        fireDate: '2026-06-20T09:30:00.000Z',
        reminderLead: '30_MIN',
        startsAt: '2026-06-20T10:00:00.000Z',
        timeLabel: '19:00 - 20:00',
        location: '강남',
      },
      'card-gangnam': {
        identifier: 'test-notification-id',
        fireDate: '2026-06-20T09:30:00.000Z',
        reminderLead: '30_MIN',
        startsAt: '2026-06-20T10:00:00.000Z',
        timeLabel: '19:00 - 20:00',
        location: '강남',
      },
    });
  });

  it('removes stale and duplicated appointment reminder notifications from the phone schedule', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    buildReminderSchedulePlan.mockReturnValueOnce({
      cancelIdentifiers: [],
      scheduleItems: [],
      keptReminders: {
        'card-gangnam': {
          identifier: 'active-reminder-id',
          fireDate: '2026-06-20T09:30:00.000Z',
          reminderLead: '30_MIN',
          startsAt: '2026-06-20T10:00:00.000Z',
          timeLabel: '19:00 - 20:00',
          location: '강남',
        },
      },
    });
    getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: 'active-reminder-id',
        content: {
          data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
        },
      },
      {
        identifier: 'duplicate-reminder-id',
        content: {
          data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
        },
      },
      {
        identifier: 'stale-reminder-id',
        content: {
          data: { url: '/schedule', type: 'appointment_reminder', id: 'card-old' },
        },
      },
      {
        identifier: 'social-notification-id',
        content: {
          data: { url: '/friends', type: 'friend_request', id: 'request-harin' },
        },
      },
    ]);
    const { scheduleAppointmentReminders } = await import('./appNotifications');

    await scheduleAppointmentReminders(
      {
        id: 'profile-minseo',
        displayName: '민서',
        handle: 'minseo',
        profileUrl: 'whenbollae.app/@minseo',
        timezone: 'Asia/Seoul',
        availabilitySummary: [],
        reminderLead: '30_MIN',
      },
      [],
    );

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('duplicate-reminder-id');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('stale-reminder-id');
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('active-reminder-id');
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('social-notification-id');
  });

  it('serializes concurrent appointment reminder refreshes to avoid duplicate scheduling', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const reminderRecord = {
      fireDate: '2026-06-20T09:30:00.000Z',
      reminderLead: '30_MIN' as const,
      startsAt: '2026-06-20T10:00:00.000Z',
      timeLabel: '19:00 - 20:00',
      location: '강남',
    };
    buildReminderSchedulePlan.mockImplementation((_lead, _items, currentReminderIds) => {
      if (currentReminderIds['card-gangnam']) {
        return {
          cancelIdentifiers: [],
          scheduleItems: [],
          keptReminders: currentReminderIds,
        };
      }

      return {
        cancelIdentifiers: [],
        keptReminders: {},
        scheduleItems: [
          {
            mapKey: 'card-gangnam',
            fireDate: new Date('2026-06-20T09:30:00.000Z'),
            content: {
              title: '약속 리마인드',
              body: '19:00 - 20:00 · 강남',
              data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
            },
            record: reminderRecord,
          },
        ],
      };
    });
    const { scheduleAppointmentReminders } = await import('./appNotifications');
    const profile = {
      id: 'profile-minseo',
      displayName: '민서',
      handle: 'minseo',
      profileUrl: 'whenbollae.app/@minseo',
      timezone: 'Asia/Seoul',
      availabilitySummary: [],
      reminderLead: '30_MIN' as const,
    };

    await Promise.all([scheduleAppointmentReminders(profile, []), scheduleAppointmentReminders(profile, [])]);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(JSON.parse(asyncStorageValues.get(reminderIdsKey) ?? '{}')).toEqual({
      'card-gangnam': {
        ...reminderRecord,
        identifier: 'test-notification-id',
      },
    });
  });

  it('removes the current Expo push token from Supabase when notifications are disabled', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(expoPushTokenKey, 'ExponentPushToken[test-token]');
    const { disableAppNotifications } = await import('./appNotifications');

    await disableAppNotifications();

    expect(deleteNotificationToken).toHaveBeenCalled();
    expect(deleteNotificationTokenEq).toHaveBeenNthCalledWith(1, 'provider', 'expo');
    expect(deleteNotificationTokenEq).toHaveBeenNthCalledWith(2, 'token', 'ExponentPushToken[test-token]');
    expect(asyncStorageValues.get(notificationEnabledKey)).toBe('false');
    expect(asyncStorageValues.has(expoPushTokenKey)).toBe(false);
  });

  it('turns off the local notification setting even when token removal fails', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(expoPushTokenKey, 'ExponentPushToken[test-token]');
    const failingDeleteQuery = { error: new Error('토큰 삭제 실패'), eq: deleteNotificationTokenEq };
    deleteNotificationTokenEq.mockReturnValue(failingDeleteQuery);
    deleteNotificationToken.mockReturnValue(failingDeleteQuery);
    const { disableAppNotifications } = await import('./appNotifications');

    await expect(disableAppNotifications()).rejects.toThrow('토큰 삭제 실패');

    expect(asyncStorageValues.get(notificationEnabledKey)).toBe('false');
    expect(asyncStorageValues.has(expoPushTokenKey)).toBe(true);
  });

  it('reports the current local setting after a partial disable failure', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(expoPushTokenKey, 'ExponentPushToken[test-token]');
    const failingDeleteQuery = { error: new Error('토큰 삭제 실패'), eq: deleteNotificationTokenEq };
    deleteNotificationTokenEq.mockReturnValue(failingDeleteQuery);
    deleteNotificationToken.mockReturnValue(failingDeleteQuery);
    const { disableAppNotifications, getAppNotificationSettingsSnapshot } = await import('./appNotifications');

    await expect(disableAppNotifications()).rejects.toThrow('토큰 삭제 실패');

    await expect(getAppNotificationSettingsSnapshot()).resolves.toEqual({
      enabled: false,
      permissionStatus: 'granted',
    });
  });
});
