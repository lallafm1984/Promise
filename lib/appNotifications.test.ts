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
const getHostProfile = vi.fn();
const listRecentCards = vi.fn();
const listFriendState = vi.fn();
const listReceivedCardAlerts = vi.fn();
const buildCardConfirmedNotification = vi.fn();
const buildCardResponseReceivedNotification = vi.fn();
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
const seenCardResponseFingerprintsKey = 'whenbollae:notifications:seen-card-response-fingerprints:profile-minseo';
const seenCardConfirmationFingerprintsKey = 'whenbollae:notifications:seen-card-confirmation-fingerprints:profile-minseo';
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
  buildCardConfirmedNotification,
  buildCardResponseReceivedNotification,
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
    getHostProfile.mockReset().mockResolvedValue({
      id: 'profile-minseo',
      displayName: '민서',
      handle: 'minseo',
      profileUrl: 'whenbollae.app/@minseo',
      timezone: 'Asia/Seoul',
      availabilitySummary: [],
      reminderLead: '30_MIN',
    });
    listRecentCards.mockReset().mockResolvedValue([]);
    listFriendState.mockReset().mockResolvedValue({ friends: [], requests: [], suggestions: [] });
    listReceivedCardAlerts.mockReset().mockResolvedValue([]);
    getActiveFriendRepository.mockReset().mockResolvedValue({ repository: { listFriendState } });
    getActivePromiseRepository.mockReset().mockResolvedValue({
      repository: {
        getHostProfile,
        listRecentCards,
        listReceivedCardAlerts,
      },
    });
    buildCardConfirmedNotification.mockReset().mockImplementation((card) => ({
      title: '약속이 확정되었습니다',
      body: `${card.requesterName ?? card.hostName}님이 약속을 확정하였습니다. 일정에 추가됩니다.`,
      data: { url: '/schedule?date=2026-06-25', type: 'card_confirmed', id: card.id },
    }));
    buildCardResponseReceivedNotification.mockReset().mockImplementation((card) => ({
      title: '응답이 도착했어요',
      body: `${card.location} 카드에 새 응답이 있어요.`,
      data: { url: '/manage?tab=SENT_HAS_RESPONSE', type: 'card_response_received', id: card.id },
    }));
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

  it('does not present disabled notification categories', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const { presentAppNotification, setAppNotificationCategoryEnabled } = await import('./appNotifications');

    await setAppNotificationCategoryEnabled('cardReceived', false);
    await presentAppNotification({
      title: '친구가 카드를 보냈어요',
      body: '민서님이 카드를 보냈어요.',
      data: { url: '/manage', type: 'card_received', id: 'card-disabled' },
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('uses the stored reminder lead time when scheduling appointment reminders', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    const { scheduleAppointmentReminders, setAppNotificationReminderLead } = await import('./appNotifications');
    const profile = {
      id: 'profile-minseo',
      displayName: '민서',
      handle: 'minseo',
      profileUrl: 'whenbollae.app/@minseo',
      timezone: 'Asia/Seoul',
      availabilitySummary: [],
      reminderLead: '30_MIN' as const,
    };

    await setAppNotificationReminderLead('10_MIN');
    await scheduleAppointmentReminders(profile, []);

    expect(buildReminderSchedulePlan).toHaveBeenCalledWith('10_MIN', [], {});
  });

  it('does not register a push token when the app notification setting is off', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'false');
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBeNull();

    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(upsertNotificationToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('registers a push token when phone permission is already granted and the account setting is missing', async () => {
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBe('ExponentPushToken[test-token]');

    expect(asyncStorageValues.get(notificationEnabledKey)).toBe('true');
    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-test' });
    expect(upsertNotificationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'profile-minseo',
        provider: 'expo',
        token: 'ExponentPushToken[test-token]',
        device_label: expect.stringContaining('android'),
      }),
      { onConflict: 'provider,token' },
    );
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

  it('warns when Expo push token registration fails', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    getExpoPushTokenAsync.mockRejectedValueOnce(new Error('Missing FCM configuration'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { syncPushTokenRegistration } = await import('./appNotifications');

    await expect(syncPushTokenRegistration()).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith('Expo push token registration failed', expect.any(Error));
    expect(rpc).not.toHaveBeenCalled();
    expect(upsertNotificationToken).not.toHaveBeenCalled();

    warn.mockRestore();
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
    asyncStorageValues.set(notificationEnabledKey, 'false');
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

  it('refreshes social notifications from the current account mobile sync version only', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { installSocialNotificationRealtimeRefresh } = await import('./appNotifications');

    const cleanup = await installSocialNotificationRealtimeRefresh(refresh);

    expect(channel).toHaveBeenCalledWith(expect.stringMatching(/^whenbollae-social-notifications-profile-minseo-/));
    expect(channelOn).toHaveBeenCalledTimes(1);
    expect(channelOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mobile_sync_versions',
        filter: 'user_id=eq.profile-minseo',
      },
      expect.any(Function),
    );
    expect(channelSubscribe).toHaveBeenCalled();

    for (const call of channelOn.mock.calls) {
      const handler = call[2] as (() => void) | undefined;
      handler?.();
    }
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);

    cleanup();
    expect(channelUnsubscribe).toHaveBeenCalled();
  });

  it('refreshes once realtime subscription is confirmed and warns when realtime cannot subscribe', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { installSocialNotificationRealtimeRefresh } = await import('./appNotifications');

    await installSocialNotificationRealtimeRefresh(refresh);

    const subscribeHandler = channelSubscribe.mock.calls[0]?.[0] as ((status: string) => void) | undefined;
    expect(subscribeHandler).toEqual(expect.any(Function));

    subscribeHandler?.('SUBSCRIBED');
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    subscribeHandler?.('CHANNEL_ERROR');
    expect(warn).toHaveBeenCalledWith('Social notification realtime subscription failed', 'CHANNEL_ERROR');

    warn.mockRestore();
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

  it('does not drop the first received card notification when seen card storage is missing', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    listReceivedCardAlerts.mockResolvedValueOnce([
      {
        id: 'card-first',
        title: 'First card',
        location: 'Seongsu',
        requesterName: 'Minseo',
        createdAt: '2026-06-16T13:00:00+09:00',
      },
    ]);
    const { checkSocialNotifications } = await import('./appNotifications');

    await checkSocialNotifications();

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { url: '/manage', type: 'card_received', id: 'card-first' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(asyncStorageValues.get(seenCardIdsKey)).toBe('["card-first"]');
  });

  it('does not duplicate a received card notification when realtime refreshes overlap', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(seenFriendRequestIdsKey, '[]');
    asyncStorageValues.set(seenFriendIdsKey, '[]');
    asyncStorageValues.set(seenCardIdsKey, '[]');
    asyncStorageValues.set(seenCardResponseFingerprintsKey, '[]');
    listReceivedCardAlerts.mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve([
              {
                id: 'card-overlap',
                title: 'Overlap card',
                location: 'Seongsu',
                requesterName: 'Minseo',
                createdAt: '2026-06-16T13:00:00+09:00',
              },
            ]),
          0,
        );
      }),
    );
    const { checkSocialNotifications } = await import('./appNotifications');

    await Promise.all([
      checkSocialNotifications(),
      checkSocialNotifications(),
      checkSocialNotifications(),
    ]);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { url: '/manage', type: 'card_received', id: 'card-overlap' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(asyncStorageValues.get(seenCardIdsKey)).toBe('["card-overlap"]');
  });

  it('shows a phone notification when a sent card receives a new response', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(seenFriendRequestIdsKey, '[]');
    asyncStorageValues.set(seenFriendIdsKey, '[]');
    asyncStorageValues.set(seenCardIdsKey, '[]');
    asyncStorageValues.set(seenCardResponseFingerprintsKey, '[]');
    listRecentCards.mockResolvedValueOnce([
      {
        id: 'card-gangnam',
        mode: 'DIRECT',
        status: 'PENDING',
        title: 'Gangnam dinner',
        hostName: 'Minseo',
        location: 'Gangnam',
        message: '',
        sharedUrl: 'https://whenbollae.app/c/card-gangnam',
        createdAt: '2026-06-16T13:00:00+09:00',
        candidates: [
          {
            id: 'slot-1',
            startsAt: '2026-06-25T10:00:00.000Z',
            endsAt: '2026-06-25T11:00:00.000Z',
            label: 'Jun 25',
            shortLabel: 'Jun 25',
            summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 },
          },
        ],
        participants: [
          {
            id: 'profile-jiu',
            name: 'Jiu',
            displayName: 'Jiu',
            color: '#DDEBFF',
            choice: 'YES',
            responses: [{ candidateId: 'slot-1', choice: 'YES' }],
          },
        ],
      },
    ]);
    const { checkSocialNotifications } = await import('./appNotifications');

    await checkSocialNotifications();

    expect(buildCardResponseReceivedNotification).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-gangnam' }));
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '응답이 도착했어요',
          data: { url: '/manage?tab=SENT_HAS_RESPONSE', type: 'card_response_received', id: 'card-gangnam' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(JSON.parse(asyncStorageValues.get(seenCardResponseFingerprintsKey) ?? '[]')).toEqual([
      'card-gangnam:profile-jiu:YES:Jiu::slot-1:YES',
    ]);
  });

  it('shows a schedule notification when a received replied card is confirmed', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(seenFriendRequestIdsKey, '[]');
    asyncStorageValues.set(seenFriendIdsKey, '[]');
    asyncStorageValues.set(seenCardIdsKey, '[]');
    asyncStorageValues.set(seenCardResponseFingerprintsKey, '[]');
    asyncStorageValues.set(seenCardConfirmationFingerprintsKey, '[]');
    listRecentCards.mockResolvedValueOnce([
      {
        id: 'card-confirmed',
        mode: 'DIRECT',
        status: 'CONFIRMED',
        title: 'Gangnam dinner',
        hostName: 'Minseo',
        requesterName: '민서',
        location: 'Gangnam',
        message: '',
        sharedUrl: 'https://whenbollae.app/c/card-confirmed',
        createdAt: '2026-06-16T13:00:00+09:00',
        selectedSlotId: 'slot-1',
        candidates: [
          {
            id: 'slot-1',
            startsAt: '2026-06-25T19:00:00',
            endsAt: '2026-06-25T20:00:00',
            label: 'Jun 25',
            shortLabel: 'Jun 25',
            summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 },
          },
        ],
        participants: [
          {
            id: 'profile-minseo',
            name: '민',
            displayName: '민서',
            color: '#DDEBFF',
            choice: 'YES',
            responses: [{ candidateId: 'slot-1', choice: 'YES' }],
          },
        ],
      },
    ]);
    const { checkSocialNotifications } = await import('./appNotifications');

    await checkSocialNotifications();

    expect(buildCardConfirmedNotification).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-confirmed' }));
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '약속이 확정되었습니다',
          body: '민서님이 약속을 확정하였습니다. 일정에 추가됩니다.',
          data: { url: '/schedule?date=2026-06-25', type: 'card_confirmed', id: 'card-confirmed' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(JSON.parse(asyncStorageValues.get(seenCardConfirmationFingerprintsKey) ?? '[]')).toEqual([
      'card-confirmed:slot-1:CONFIRMED',
    ]);
  });

  it('does not drop the first response notification when response fingerprint storage is missing', async () => {
    asyncStorageValues.set(notificationEnabledKey, 'true');
    asyncStorageValues.set(seenFriendRequestIdsKey, '[]');
    asyncStorageValues.set(seenFriendIdsKey, '[]');
    asyncStorageValues.set(seenCardIdsKey, '[]');
    listRecentCards.mockResolvedValueOnce([
      {
        id: 'card-response-first',
        mode: 'DIRECT',
        status: 'PENDING',
        title: 'Dinner',
        hostName: 'Minseo',
        location: 'Gangnam',
        message: '',
        sharedUrl: 'https://whenbollae.app/c/card-response-first',
        createdAt: '2026-06-16T13:00:00+09:00',
        candidates: [
          {
            id: 'slot-1',
            startsAt: '2026-06-25T10:00:00.000Z',
            endsAt: '2026-06-25T11:00:00.000Z',
            label: 'Jun 25',
            shortLabel: 'Jun 25',
            summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 },
          },
        ],
        participants: [
          {
            id: 'profile-jiu',
            name: 'Jiu',
            displayName: 'Jiu',
            color: '#DDEBFF',
            choice: 'YES',
            responses: [{ candidateId: 'slot-1', choice: 'YES' }],
          },
        ],
      },
    ]);
    const { checkSocialNotifications } = await import('./appNotifications');

    await checkSocialNotifications();

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { url: '/manage?tab=SENT_HAS_RESPONSE', type: 'card_response_received', id: 'card-response-first' },
        }),
        trigger: { channelId: 'whenbollae-default' },
      }),
    );
    expect(JSON.parse(asyncStorageValues.get(seenCardResponseFingerprintsKey) ?? '[]')).toEqual([
      'card-response-first:profile-jiu:YES:Jiu::slot-1:YES',
    ]);
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

    await expect(getAppNotificationSettingsSnapshot()).resolves.toMatchObject({
      enabled: false,
      permissionStatus: 'granted',
    });
  });
});
