import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { getActiveFriendRepository } from '@/data/friendRepository';
import { getActivePromiseRepository } from '@/data/promiseRepository';
import { getAccountScopedStorageKey } from '@/lib/accountScopedStorage';
import {
  getManagedCardConfirmationNoticeFingerprints,
  getManagedCardResponseNoticeFingerprints,
  getReceivedConfirmedScheduleCards,
  getSentResponseArrivalCards,
} from '@/lib/cardMenu';
import { supabase } from '@/lib/supabase';
import {
  buildCardConfirmedNotification,
  buildCardResponseReceivedNotification,
  buildCardReceivedNotification,
  buildFriendAcceptedNotification,
  buildFriendRequestNotification,
  buildReminderSchedulePlan,
  buildTestNotification,
  getNewAcceptedFriends,
  getNewIncomingFriendRequests,
  getNewReceivedCardAlerts,
  type NotificationContent,
  type ReminderRecordMap,
  type StoredReminderMap,
} from '@/lib/notifications';
import type { AppNotificationPermissionStatus } from '@/lib/notificationStatus';
import type { HostProfile, ReminderLead, ScheduleItem } from '@/types/promise';

const NOTIFICATION_ENABLED_PREFIX = 'whenbollae:notifications:enabled';
const SEEN_FRIEND_REQUEST_IDS_PREFIX = 'whenbollae:notifications:seen-friend-request-ids';
const SEEN_FRIEND_IDS_PREFIX = 'whenbollae:notifications:seen-friend-ids';
const SEEN_CARD_IDS_PREFIX = 'whenbollae:notifications:seen-card-ids';
const SEEN_CARD_RESPONSE_FINGERPRINTS_PREFIX = 'whenbollae:notifications:seen-card-response-fingerprints';
const SEEN_CARD_CONFIRMATION_FINGERPRINTS_PREFIX = 'whenbollae:notifications:seen-card-confirmation-fingerprints';
const REMINDER_IDS_PREFIX = 'whenbollae:notifications:reminder-ids';
const NOTIFICATION_PREFERENCES_PREFIX = 'whenbollae:notifications:preferences';
const EXPO_PUSH_TOKEN_KEY = 'whenbollae:notifications:expo-push-token';

const DEFAULT_CHANNEL_ID = 'whenbollae-default';
const REMINDER_CHANNEL_ID = 'whenbollae-reminders';

let notificationHandlerConfigured = false;
let appointmentReminderScheduleQueue: Promise<void> = Promise.resolve();
let socialNotificationCheckQueue: Promise<void> = Promise.resolve();

export type AppNotificationCategory =
  | 'friendRequests'
  | 'friendAccepted'
  | 'cardReceived'
  | 'cardResponses'
  | 'cardConfirmed'
  | 'reminders';

export interface AppNotificationPreferences {
  categories: Record<AppNotificationCategory, boolean>;
  reminderLead: ReminderLead;
}

export const DEFAULT_APP_NOTIFICATION_PREFERENCES: AppNotificationPreferences = {
  categories: {
    friendRequests: true,
    friendAccepted: true,
    cardReceived: true,
    cardResponses: true,
    cardConfirmed: true,
    reminders: true,
  },
  reminderLead: '30_MIN',
};

export interface AppNotificationSettingsSnapshot {
  enabled: boolean;
  permissionStatus: AppNotificationPermissionStatus;
  preferences: AppNotificationPreferences;
}

const notificationCategoryByType: Partial<Record<NotificationContent['data']['type'], AppNotificationCategory>> = {
  friend_request: 'friendRequests',
  friend_accepted: 'friendAccepted',
  card_received: 'cardReceived',
  card_response_received: 'cardResponses',
  card_confirmed: 'cardConfirmed',
  appointment_reminder: 'reminders',
};

async function getNotificationAccountId() {
  const authSession = await supabase?.auth.getSession();

  return authSession?.data.session?.user.id ?? null;
}

function getNotificationStorageKey(prefix: string, accountId: string | null) {
  return getAccountScopedStorageKey(prefix, accountId);
}

async function getCurrentNotificationStorageKey(prefix: string) {
  return getNotificationStorageKey(prefix, await getNotificationAccountId());
}

async function getStoredAppNotificationEnabled() {
  const value = await AsyncStorage.getItem(await getCurrentNotificationStorageKey(NOTIFICATION_ENABLED_PREFIX));

  return value === null ? null : value === 'true';
}

async function resolveAppNotificationEnabledDefault(requestIfUndetermined: boolean) {
  const storedEnabled = await getStoredAppNotificationEnabled();

  if (storedEnabled !== null) {
    return storedEnabled;
  }

  if (Platform.OS === 'web') {
    return false;
  }

  let permission = await Notifications.getPermissionsAsync();

  if (requestIfUndetermined && permission.status === 'undetermined') {
    await configureAppNotifications();
    permission = await Notifications.requestPermissionsAsync();
  }

  const enabled = permission.status === 'granted';

  if (enabled || requestIfUndetermined) {
    await setAppNotificationEnabled(enabled);
  }

  return enabled;
}

export async function ensureAppNotificationEnabledForGrantedPermission() {
  return resolveAppNotificationEnabledDefault(false);
}

export async function ensureDefaultAppNotificationEnabled() {
  return resolveAppNotificationEnabledDefault(true);
}

function getSocialNotificationStorageKeys(accountId: string | null) {
  return {
    seenFriendRequestIds: getNotificationStorageKey(SEEN_FRIEND_REQUEST_IDS_PREFIX, accountId),
    seenFriendIds: getNotificationStorageKey(SEEN_FRIEND_IDS_PREFIX, accountId),
    seenCardIds: getNotificationStorageKey(SEEN_CARD_IDS_PREFIX, accountId),
    seenCardResponseFingerprints: getNotificationStorageKey(SEEN_CARD_RESPONSE_FINGERPRINTS_PREFIX, accountId),
    seenCardConfirmationFingerprints: getNotificationStorageKey(SEEN_CARD_CONFIRMATION_FINGERPRINTS_PREFIX, accountId),
  };
}

function readJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readJsonMap(value: string | null): StoredReminderMap {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredReminderMap) : {};
  } catch {
    return {};
  }
}

function normalizeNotificationPreferences(value: string | null): AppNotificationPreferences {
  if (!value) {
    return DEFAULT_APP_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AppNotificationPreferences>;
    const categories =
      typeof parsed.categories === 'object' && parsed.categories !== null ? parsed.categories : {};
    const reminderLead =
      parsed.reminderLead === '10_MIN' || parsed.reminderLead === '30_MIN' || parsed.reminderLead === '1_HOUR'
        ? parsed.reminderLead
        : DEFAULT_APP_NOTIFICATION_PREFERENCES.reminderLead;

    return {
      categories: {
        ...DEFAULT_APP_NOTIFICATION_PREFERENCES.categories,
        ...Object.fromEntries(
          Object.entries(categories).filter((entry): entry is [AppNotificationCategory, boolean] => {
            const [category, enabled] = entry;
            return category in DEFAULT_APP_NOTIFICATION_PREFERENCES.categories && typeof enabled === 'boolean';
          }),
        ),
      },
      reminderLead,
    };
  } catch {
    return DEFAULT_APP_NOTIFICATION_PREFERENCES;
  }
}

function getReminderIdentifier(reminder: string | { identifier?: string }) {
  return typeof reminder === 'string' ? reminder : reminder.identifier;
}

function getScheduledReminderKey(request: Notifications.NotificationRequest) {
  const data = request.content.data;

  return data?.type === 'appointment_reminder' && typeof data.id === 'string' ? data.id : null;
}

async function writeJsonArray(key: string, values: string[]) {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(new Set(values))));
}

function getImmediateNotificationTrigger() {
  return Platform.OS === 'android' ? { channelId: DEFAULT_CHANNEL_ID } : null;
}

async function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function registerPushTokenIfPossible() {
  const projectId = await getProjectId();

  if (!projectId || !supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (!userId) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('register_notification_token', {
      notification_provider: 'expo',
      notification_token: token.data,
      notification_device_label: `${Platform.OS} ${Constants.deviceName ?? 'device'}`,
    });
    const { error } = await supabase.from('notification_tokens').upsert(
      {
        user_id: userId,
        provider: 'expo',
        token: token.data,
        device_label: `${Platform.OS} ${Constants.deviceName ?? 'device'}`,
      },
      { onConflict: 'provider,token' },
    );

    if (error) {
      throw error;
    }

    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token.data);
    return token.data;
  } catch (error) {
    console.warn('Expo push token registration failed', error);
    return null;
  }
}

export async function installSocialNotificationRealtimeRefresh(refresh = checkSocialNotifications) {
  if (Platform.OS === 'web' || !supabase) {
    return () => undefined;
  }

  const accountId = await getNotificationAccountId();

  if (!accountId) {
    return () => undefined;
  }

  function triggerRealtimeRefresh() {
    void refresh().catch((error) => {
      console.warn('Social notification realtime refresh failed', error);
    });
  }

  function handleRealtimeStatus(status: string) {
    if (status === 'SUBSCRIBED') {
      triggerRealtimeRefresh();
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('Social notification realtime subscription failed', status);
    }
  }

  const channel = supabase
    .channel(`whenbollae-social-notifications-${accountId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mobile_sync_versions',
        filter: `user_id=eq.${accountId}`,
      },
      () => {
        triggerRealtimeRefresh();
      },
    )
    .subscribe(handleRealtimeStatus);

  return () => {
    void channel.unsubscribe();
  };
}

async function unregisterPushTokenIfPossible() {
  const storedToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
  let token = storedToken;

  if (!token) {
    const projectId = await getProjectId();

    if (projectId) {
      try {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch {
        token = null;
      }
    }
  }

  if (supabase && token) {
    const { error } = await supabase.from('notification_tokens').delete().eq('provider', 'expo').eq('token', token);

    if (error) {
      throw error;
    }
  }

  await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY);
}

export async function configureAppNotifications() {
  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: '언제볼래 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 160, 250],
      lightColor: '#F97940',
    });
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: '일정 리마인드',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 320, 180, 320],
      lightColor: '#77C9C5',
    });
  }
}

export async function isAppNotificationEnabled() {
  return (await getStoredAppNotificationEnabled()) === true;
}

export async function getAppNotificationPermissionStatus(): Promise<AppNotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'unknown';
  }

  const permission = await Notifications.getPermissionsAsync();

  if (permission.status === 'granted' || permission.status === 'denied' || permission.status === 'undetermined') {
    return permission.status;
  }

  return 'unknown';
}

export async function setAppNotificationEnabled(enabled: boolean) {
  await AsyncStorage.setItem(await getCurrentNotificationStorageKey(NOTIFICATION_ENABLED_PREFIX), enabled ? 'true' : 'false');
}

export async function getAppNotificationSettingsSnapshot(): Promise<AppNotificationSettingsSnapshot> {
  const [enabled, permissionStatus, preferences] = await Promise.all([
    ensureAppNotificationEnabledForGrantedPermission(),
    getAppNotificationPermissionStatus(),
    getAppNotificationPreferencesSnapshot(),
  ]);

  return {
    enabled,
    permissionStatus,
    preferences,
  };
}

export async function getAppNotificationPreferencesSnapshot(): Promise<AppNotificationPreferences> {
  const preferencesKey = await getCurrentNotificationStorageKey(NOTIFICATION_PREFERENCES_PREFIX);

  return normalizeNotificationPreferences(await AsyncStorage.getItem(preferencesKey));
}

async function writeAppNotificationPreferences(preferences: AppNotificationPreferences) {
  await AsyncStorage.setItem(
    await getCurrentNotificationStorageKey(NOTIFICATION_PREFERENCES_PREFIX),
    JSON.stringify(preferences),
  );
}

export async function setAppNotificationCategoryEnabled(category: AppNotificationCategory, enabled: boolean) {
  const preferences = await getAppNotificationPreferencesSnapshot();
  const nextPreferences: AppNotificationPreferences = {
    ...preferences,
    categories: {
      ...preferences.categories,
      [category]: enabled,
    },
  };

  await writeAppNotificationPreferences(nextPreferences);
  return nextPreferences;
}

export async function setAppNotificationReminderLead(reminderLead: ReminderLead) {
  const preferences = await getAppNotificationPreferencesSnapshot();
  const nextPreferences: AppNotificationPreferences = {
    ...preferences,
    reminderLead,
  };

  await writeAppNotificationPreferences(nextPreferences);
  return nextPreferences;
}

export async function enableAppNotifications() {
  await configureAppNotifications();

  const currentPermission = await Notifications.getPermissionsAsync();
  let status = currentPermission.status;

  if (status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    status = requestedPermission.status;
  }

  const granted = status === 'granted';
  await setAppNotificationEnabled(granted);

  if (granted) {
    await syncPushTokenRegistration();
  }

  return granted;
}

export async function syncPushTokenRegistration() {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return null;
  }

  await configureAppNotifications();

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.status !== 'granted') {
    try {
      await unregisterPushTokenIfPossible();
    } catch {
      // Local state must still reflect that phone notifications cannot be delivered.
    }
    await setAppNotificationEnabled(false);
    return null;
  }

  return registerPushTokenIfPossible();
}

export async function disableAppNotifications() {
  let cleanupError: unknown = null;
  const reminderIdsKey = await getCurrentNotificationStorageKey(REMINDER_IDS_PREFIX);
  const reminderIds = readJsonMap(await AsyncStorage.getItem(reminderIdsKey));

  try {
    await Promise.all(
      Object.values(reminderIds)
        .map(getReminderIdentifier)
        .filter((identifier): identifier is string => Boolean(identifier))
        .map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)),
    );
  } catch (error) {
    cleanupError = cleanupError ?? error;
  }

  try {
    await AsyncStorage.removeItem(reminderIdsKey);
  } catch (error) {
    cleanupError = cleanupError ?? error;
  }

  try {
    await unregisterPushTokenIfPossible();
  } catch (error) {
    cleanupError = cleanupError ?? error;
  }

  await setAppNotificationEnabled(false);

  if (cleanupError) {
    throw cleanupError;
  }
}

export async function presentAppNotification(content: NotificationContent) {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return;
  }

  const category = notificationCategoryByType[content.data.type];

  if (category) {
    const preferences = await getAppNotificationPreferencesSnapshot();

    if (!preferences.categories[category]) {
      return;
    }
  }

  await configureAppNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: content.data,
      sound: 'default',
    },
    trigger: getImmediateNotificationTrigger(),
  });
}

export async function sendTestAppNotification() {
  await presentAppNotification(buildTestNotification());
}

async function pruneStaleAppointmentReminderNotifications(activeReminderIds: ReminderRecordMap) {
  const activeIdentifierByKey = new Map(
    Object.entries(activeReminderIds)
      .filter(([, reminder]) => Boolean(reminder.identifier))
      .map(([mapKey, reminder]) => [mapKey, reminder.identifier]),
  );
  const seenActiveKeys = new Set<string>();
  const cancelIdentifiers = new Set<string>();

  let scheduledNotifications: Notifications.NotificationRequest[];

  try {
    scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  for (const request of scheduledNotifications) {
    const reminderKey = getScheduledReminderKey(request);

    if (!reminderKey) {
      continue;
    }

    const activeIdentifier = activeIdentifierByKey.get(reminderKey);

    if (!activeIdentifier || request.identifier !== activeIdentifier || seenActiveKeys.has(reminderKey)) {
      cancelIdentifiers.add(request.identifier);
      continue;
    }

    seenActiveKeys.add(reminderKey);
  }

  await Promise.all(Array.from(cancelIdentifiers).map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
}

export async function seedCurrentSocialNotificationState() {
  const accountId = await getNotificationAccountId();
  const seenKeys = getSocialNotificationStorageKeys(accountId);
  const [{ repository: friendRepository }, { repository: promiseRepository }] = await Promise.all([
    getActiveFriendRepository(),
    getActivePromiseRepository(),
  ]);
  const [friendState, receivedCards] = await Promise.all([
    friendRepository.listFriendState(),
    promiseRepository.listReceivedCardAlerts(),
  ]);
  const [profile, recentCards] = await Promise.all([
    promiseRepository.getHostProfile(),
    promiseRepository.listRecentCards(),
  ]);
  const responseFingerprints = getManagedCardResponseNoticeFingerprints(
    getSentResponseArrivalCards(recentCards, new Date(), profile),
  );
  const confirmationFingerprints = getManagedCardConfirmationNoticeFingerprints(
    getReceivedConfirmedScheduleCards(recentCards, new Date(), profile),
  );
  const incomingRequestIds = friendState.requests
    .filter((request) => request.direction === 'INCOMING')
    .map((request) => request.id);
  const friendIds = friendState.friends.map((friend) => friend.id);

  await Promise.all([
    writeJsonArray(seenKeys.seenFriendRequestIds, incomingRequestIds),
    writeJsonArray(seenKeys.seenFriendIds, friendIds),
    writeJsonArray(
      seenKeys.seenCardIds,
      receivedCards.map((card) => card.id),
    ),
    writeJsonArray(seenKeys.seenCardResponseFingerprints, responseFingerprints),
    writeJsonArray(seenKeys.seenCardConfirmationFingerprints, confirmationFingerprints),
  ]);
}

async function checkSocialNotificationsOnce() {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return;
  }

  const [{ repository: friendRepository }, { repository: promiseRepository }] = await Promise.all([
    getActiveFriendRepository(),
    getActivePromiseRepository(),
  ]);
  const accountId = await getNotificationAccountId();
  const seenKeys = getSocialNotificationStorageKeys(accountId);
  const [
    friendState,
    receivedCards,
    profile,
    recentCards,
    rawSeenRequestIds,
    rawSeenFriendIds,
    rawSeenCardIds,
    rawSeenCardResponseFingerprints,
    rawSeenCardConfirmationFingerprints,
    registeredPushToken,
  ] = await Promise.all([
    friendRepository.listFriendState(),
    promiseRepository.listReceivedCardAlerts(),
    promiseRepository.getHostProfile(),
    promiseRepository.listRecentCards(),
    AsyncStorage.getItem(seenKeys.seenFriendRequestIds),
    AsyncStorage.getItem(seenKeys.seenFriendIds),
    AsyncStorage.getItem(seenKeys.seenCardIds),
    AsyncStorage.getItem(seenKeys.seenCardResponseFingerprints),
    AsyncStorage.getItem(seenKeys.seenCardConfirmationFingerprints),
    AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY),
  ]);
  const incomingRequestIds = friendState.requests
    .filter((request) => request.direction === 'INCOMING')
    .map((request) => request.id);
  const friendIds = friendState.friends.map((friend) => friend.id);
  const sentResponseCards = getSentResponseArrivalCards(recentCards, new Date(), profile);
  const currentResponseFingerprints = getManagedCardResponseNoticeFingerprints(sentResponseCards);
  const receivedConfirmedCards = getReceivedConfirmedScheduleCards(recentCards, new Date(), profile);
  const currentConfirmationFingerprints =
    getManagedCardConfirmationNoticeFingerprints(receivedConfirmedCards);
  const currentCardIds = receivedCards.map((card) => card.id);

  const seenRequestIds = rawSeenRequestIds === null ? incomingRequestIds : readJsonArray(rawSeenRequestIds);
  const seenFriendIds = rawSeenFriendIds === null ? friendIds : readJsonArray(rawSeenFriendIds);
  const seenCardIds = rawSeenCardIds === null ? currentCardIds : readJsonArray(rawSeenCardIds);
  const seenCardResponseFingerprints =
    rawSeenCardResponseFingerprints === null
      ? currentResponseFingerprints
      : readJsonArray(rawSeenCardResponseFingerprints);
  const seenCardResponseFingerprintSet = new Set(seenCardResponseFingerprints);
  const seenCardConfirmationFingerprints =
    rawSeenCardConfirmationFingerprints === null
      ? currentConfirmationFingerprints
      : readJsonArray(rawSeenCardConfirmationFingerprints);
  const seenCardConfirmationFingerprintSet = new Set(seenCardConfirmationFingerprints);
  const newRequests = getNewIncomingFriendRequests(seenRequestIds, friendState.requests);
  const newAcceptedFriends = getNewAcceptedFriends(seenFriendIds, friendState.friends);
  const newCards = getNewReceivedCardAlerts(seenCardIds, receivedCards);
  const newResponseCards = sentResponseCards.filter((card) =>
    getManagedCardResponseNoticeFingerprints([card]).some((fingerprint) => !seenCardResponseFingerprintSet.has(fingerprint)),
  );
  const newConfirmedCards = receivedConfirmedCards.filter((card) =>
    getManagedCardConfirmationNoticeFingerprints([card]).some(
      (fingerprint) => !seenCardConfirmationFingerprintSet.has(fingerprint),
    ),
  );

  if (!registeredPushToken) {
    await Promise.all([
      ...newRequests.map((request) => presentAppNotification(buildFriendRequestNotification(request))),
      ...newAcceptedFriends.map((friend) => presentAppNotification(buildFriendAcceptedNotification(friend))),
      ...newCards.map((card) => presentAppNotification(buildCardReceivedNotification(card))),
      ...newResponseCards.map((card) => presentAppNotification(buildCardResponseReceivedNotification(card))),
      ...newConfirmedCards.map((card) => presentAppNotification(buildCardConfirmedNotification(card))),
    ]);
  }

  await Promise.all([
    writeJsonArray(
      seenKeys.seenFriendRequestIds,
      incomingRequestIds,
    ),
    writeJsonArray(seenKeys.seenFriendIds, friendIds),
    writeJsonArray(
      seenKeys.seenCardIds,
      currentCardIds,
    ),
    writeJsonArray(seenKeys.seenCardResponseFingerprints, currentResponseFingerprints),
    writeJsonArray(seenKeys.seenCardConfirmationFingerprints, currentConfirmationFingerprints),
  ]);
}

export async function checkSocialNotifications() {
  const nextCheck = socialNotificationCheckQueue.then(
    () => checkSocialNotificationsOnce(),
    () => checkSocialNotificationsOnce(),
  );
  socialNotificationCheckQueue = nextCheck.catch(() => undefined);

  return nextCheck;
}

async function scheduleAppointmentRemindersOnce(profile: HostProfile, scheduleItems: ScheduleItem[]) {
  if (!(await ensureAppNotificationEnabledForGrantedPermission())) {
    return;
  }

  const reminderIdsKey = await getCurrentNotificationStorageKey(REMINDER_IDS_PREFIX);
  const currentReminderIds = readJsonMap(await AsyncStorage.getItem(reminderIdsKey));
  const preferences = await getAppNotificationPreferencesSnapshot();

  if (!preferences.categories.reminders) {
    await Promise.all(
      Object.values(currentReminderIds)
        .map(getReminderIdentifier)
        .filter((identifier): identifier is string => Boolean(identifier))
        .map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)),
    );
    await AsyncStorage.removeItem(reminderIdsKey);
    await pruneStaleAppointmentReminderNotifications({});
    return;
  }

  await configureAppNotifications();
  const reminderPlan = buildReminderSchedulePlan(preferences.reminderLead, scheduleItems, currentReminderIds);
  const nextReminderIds: ReminderRecordMap = { ...reminderPlan.keptReminders };

  await Promise.all(
    reminderPlan.cancelIdentifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)),
  );

  for (const item of reminderPlan.scheduleItems) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: item.content.title,
        body: item.content.body,
        data: item.content.data,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireDate,
        channelId: REMINDER_CHANNEL_ID,
      },
    });

    nextReminderIds[item.mapKey] = {
      ...item.record,
      identifier,
    };
  }

  await AsyncStorage.setItem(reminderIdsKey, JSON.stringify(nextReminderIds));
  await pruneStaleAppointmentReminderNotifications(nextReminderIds);
}

export async function scheduleAppointmentReminders(profile: HostProfile, scheduleItems: ScheduleItem[]) {
  const nextScheduleRun = appointmentReminderScheduleQueue.then(() => scheduleAppointmentRemindersOnce(profile, scheduleItems));
  appointmentReminderScheduleQueue = nextScheduleRun.catch(() => undefined);

  return nextScheduleRun;
}

export function installNotificationResponseHandler() {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  function redirect(notification: Notifications.Notification) {
    const url = notification.request.content.data?.url;

    if (typeof url === 'string') {
      router.push(url as never);
    }
  }

  const lastResponse = Notifications.getLastNotificationResponse();

  if (lastResponse?.notification) {
    redirect(lastResponse.notification);
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification);
  });

  return () => {
    subscription.remove();
  };
}
