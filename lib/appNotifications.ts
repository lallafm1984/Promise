import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { getActiveFriendRepository } from '@/data/friendRepository';
import { getActivePromiseRepository } from '@/data/promiseRepository';
import { supabase } from '@/lib/supabase';
import {
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
import type { HostProfile, ScheduleItem } from '@/types/promise';

const NOTIFICATION_ENABLED_KEY = 'whenbollae:notifications:enabled';
const SEEN_FRIEND_REQUEST_IDS_KEY = 'whenbollae:notifications:seen-friend-request-ids';
const SEEN_FRIEND_IDS_KEY = 'whenbollae:notifications:seen-friend-ids';
const SEEN_CARD_IDS_KEY = 'whenbollae:notifications:seen-card-ids';
const REMINDER_IDS_KEY = 'whenbollae:notifications:reminder-ids';
const EXPO_PUSH_TOKEN_KEY = 'whenbollae:notifications:expo-push-token';

const DEFAULT_CHANNEL_ID = 'whenbollae-default';
const REMINDER_CHANNEL_ID = 'whenbollae-reminders';

let notificationHandlerConfigured = false;
let appointmentReminderScheduleQueue: Promise<void> = Promise.resolve();

export interface AppNotificationSettingsSnapshot {
  enabled: boolean;
  permissionStatus: AppNotificationPermissionStatus;
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
  } catch {
    return null;
  }
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
      name: '약속 리마인드',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 320, 180, 320],
      lightColor: '#77C9C5',
    });
  }
}

export async function isAppNotificationEnabled() {
  return (await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY)) === 'true';
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
  await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getAppNotificationSettingsSnapshot(): Promise<AppNotificationSettingsSnapshot> {
  const [enabled, permissionStatus] = await Promise.all([isAppNotificationEnabled(), getAppNotificationPermissionStatus()]);

  return {
    enabled,
    permissionStatus,
  };
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
  if (!(await isAppNotificationEnabled())) {
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
  const reminderIds = readJsonMap(await AsyncStorage.getItem(REMINDER_IDS_KEY));

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
    await AsyncStorage.removeItem(REMINDER_IDS_KEY);
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
  if (!(await isAppNotificationEnabled())) {
    return;
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
  const [{ repository: friendRepository }, { repository: promiseRepository }] = await Promise.all([
    getActiveFriendRepository(),
    getActivePromiseRepository(),
  ]);
  const [friendState, receivedCards] = await Promise.all([
    friendRepository.listFriendState(),
    promiseRepository.listReceivedCardAlerts(),
  ]);
  const incomingRequestIds = friendState.requests
    .filter((request) => request.direction === 'INCOMING')
    .map((request) => request.id);
  const friendIds = friendState.friends.map((friend) => friend.id);

  await Promise.all([
    writeJsonArray(SEEN_FRIEND_REQUEST_IDS_KEY, incomingRequestIds),
    writeJsonArray(SEEN_FRIEND_IDS_KEY, friendIds),
    writeJsonArray(
      SEEN_CARD_IDS_KEY,
      receivedCards.map((card) => card.id),
    ),
  ]);
}

export async function checkSocialNotifications() {
  if (!(await isAppNotificationEnabled())) {
    return;
  }

  const [{ repository: friendRepository }, { repository: promiseRepository }] = await Promise.all([
    getActiveFriendRepository(),
    getActivePromiseRepository(),
  ]);
  const [friendState, receivedCards, rawSeenRequestIds, rawSeenFriendIds, rawSeenCardIds] = await Promise.all([
    friendRepository.listFriendState(),
    promiseRepository.listReceivedCardAlerts(),
    AsyncStorage.getItem(SEEN_FRIEND_REQUEST_IDS_KEY),
    AsyncStorage.getItem(SEEN_FRIEND_IDS_KEY),
    AsyncStorage.getItem(SEEN_CARD_IDS_KEY),
  ]);
  const incomingRequestIds = friendState.requests
    .filter((request) => request.direction === 'INCOMING')
    .map((request) => request.id);
  const friendIds = friendState.friends.map((friend) => friend.id);

  if (rawSeenRequestIds === null || rawSeenFriendIds === null || rawSeenCardIds === null) {
    await Promise.all([
      writeJsonArray(SEEN_FRIEND_REQUEST_IDS_KEY, incomingRequestIds),
      writeJsonArray(SEEN_FRIEND_IDS_KEY, friendIds),
      writeJsonArray(
        SEEN_CARD_IDS_KEY,
        receivedCards.map((card) => card.id),
      ),
    ]);
    return;
  }

  const seenRequestIds = readJsonArray(rawSeenRequestIds);
  const seenFriendIds = readJsonArray(rawSeenFriendIds);
  const seenCardIds = readJsonArray(rawSeenCardIds);
  const newRequests = getNewIncomingFriendRequests(seenRequestIds, friendState.requests);
  const newAcceptedFriends = getNewAcceptedFriends(seenFriendIds, friendState.friends);
  const newCards = getNewReceivedCardAlerts(seenCardIds, receivedCards);

  await Promise.all([
    ...newRequests.map((request) => presentAppNotification(buildFriendRequestNotification(request))),
    ...newAcceptedFriends.map((friend) => presentAppNotification(buildFriendAcceptedNotification(friend))),
    ...newCards.map((card) => presentAppNotification(buildCardReceivedNotification(card))),
  ]);

  await Promise.all([
    writeJsonArray(
      SEEN_FRIEND_REQUEST_IDS_KEY,
      incomingRequestIds,
    ),
    writeJsonArray(SEEN_FRIEND_IDS_KEY, friendIds),
    writeJsonArray(
      SEEN_CARD_IDS_KEY,
      receivedCards.map((card) => card.id),
    ),
  ]);
}

async function scheduleAppointmentRemindersOnce(profile: HostProfile, scheduleItems: ScheduleItem[]) {
  if (!(await isAppNotificationEnabled())) {
    return;
  }

  await configureAppNotifications();
  const currentReminderIds = readJsonMap(await AsyncStorage.getItem(REMINDER_IDS_KEY));
  const reminderPlan = buildReminderSchedulePlan(profile.reminderLead, scheduleItems, currentReminderIds);
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

  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(nextReminderIds));
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
