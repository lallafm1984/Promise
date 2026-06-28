import type { AppFriend, FriendRequest } from '@/lib/friends';
import { getConfirmedCardSchedulePath } from '@/lib/managedCards';
import type { PromiseCard, ReceivedCardAlert, ReminderLead, ScheduleItem } from '@/types/promise';

export interface NotificationContent {
  title: string;
  body: string;
  data: {
    url: string;
    type:
      | 'friend_request'
      | 'friend_accepted'
      | 'card_received'
      | 'card_response_received'
      | 'card_confirmed'
      | 'appointment_reminder'
      | 'test_notification';
    id: string;
  };
}

export interface ReminderNotificationInput {
  cardId: string;
  title: string;
  startsAt: string;
  timeLabel: string;
  location: string;
}

export interface ReminderSchedulePlanItem {
  mapKey: string;
  fireDate: Date;
  content: NotificationContent;
  record: ReminderRecordInput;
}

export interface ReminderSchedulePlan {
  cancelIdentifiers: string[];
  scheduleItems: ReminderSchedulePlanItem[];
  keptReminders: ReminderRecordMap;
}

export interface ReminderRecordInput {
  fireDate: string;
  reminderLead: ReminderLead;
  startsAt: string;
  timeLabel: string;
  location: string;
}

export interface ReminderRecord extends ReminderRecordInput {
  identifier: string;
}

export type ReminderRecordMap = Record<string, ReminderRecord>;
export type StoredReminderMap = Record<string, string | ReminderRecord>;

const reminderLeadMinutes: Record<ReminderLead, number> = {
  '10_MIN': 10,
  '30_MIN': 30,
  '1_HOUR': 60,
};

export function getNewIncomingFriendRequests(seenRequestIds: string[], requests: FriendRequest[]): FriendRequest[] {
  const seenIds = new Set(seenRequestIds);
  return requests.filter((request) => request.direction === 'INCOMING' && !seenIds.has(request.id));
}

export function getNewAcceptedFriends(seenFriendIds: string[], friends: AppFriend[]): AppFriend[] {
  const seenIds = new Set(seenFriendIds);
  return friends.filter((friend) => !seenIds.has(friend.id));
}

export function getNewReceivedCardAlerts(seenCardIds: string[], alerts: ReceivedCardAlert[]): ReceivedCardAlert[] {
  const seenIds = new Set(seenCardIds);
  return alerts.filter((alert) => !seenIds.has(alert.id));
}

export function getReminderFireDate(startsAt: string, reminderLead: ReminderLead): Date | null {
  const startsAtDate = new Date(startsAt);

  if (Number.isNaN(startsAtDate.getTime())) {
    return null;
  }

  return new Date(startsAtDate.getTime() - reminderLeadMinutes[reminderLead] * 60 * 1000);
}

export function buildFriendRequestNotification(request: FriendRequest): NotificationContent {
  return {
    title: '친구 요청이 왔어요',
    body: `${request.displayName}님에게서 친구 요청이 왔어요.`,
    data: { url: '/friends', type: 'friend_request', id: request.id },
  };
}

export function buildFriendAcceptedNotification(friend: AppFriend): NotificationContent {
  return {
    title: '친구가 되었어요',
    body: `${friend.displayName}와 친구가 되었어요.`,
    data: { url: '/friends', type: 'friend_accepted', id: friend.id },
  };
}

export function buildCardReceivedNotification(alert: ReceivedCardAlert): NotificationContent {
  return {
    title: '친구가 카드를 보냈어요',
    body: `${alert.requesterName}님이 ${alert.location} 약속 카드를 보냈어요.`,
    data: { url: '/manage', type: 'card_received', id: alert.id },
  };
}

export function buildCardResponseReceivedNotification(card: PromiseCard): NotificationContent {
  const respondent = card.participants.find((participant) => {
    const choice = participant.choice ?? 'UNANSWERED';
    return choice !== 'UNANSWERED' || (participant.responses?.length ?? 0) > 0;
  });
  const respondentName = respondent?.displayName?.trim() || respondent?.name?.trim() || '친구';

  return {
    title: '응답이 도착했어요',
    body: `${respondentName}님이 ${card.location} 카드에 응답했어요.`,
    data: { url: '/manage?tab=SENT_HAS_RESPONSE', type: 'card_response_received', id: card.id },
  };
}

function getConfirmedRequesterLabel(card: PromiseCard) {
  const requesterName = (card.requesterName ?? card.hostName).trim() || '친구';
  return requesterName.endsWith('님') ? requesterName : `${requesterName}님`;
}

export function buildCardConfirmedNotification(card: PromiseCard): NotificationContent {
  const requesterLabel = getConfirmedRequesterLabel(card);

  return {
    title: '약속이 확정되었습니다',
    body: `${requesterLabel}이 약속을 확정하였습니다. 일정에 추가됩니다.`,
    data: { url: getConfirmedCardSchedulePath(card), type: 'card_confirmed', id: card.id },
  };
}

export function buildReminderNotification(input: ReminderNotificationInput): NotificationContent {
  return {
    title: '일정 리마인드',
    body: `${input.timeLabel} · ${input.location}`,
    data: { url: '/schedule', type: 'appointment_reminder', id: input.cardId },
  };
}

export function buildTestNotification(): NotificationContent {
  return {
    title: '언제볼래 테스트 알림',
    body: '폰 알림이 정상적으로 도착했어요.',
    data: { url: '/profile', type: 'test_notification', id: 'test-notification' },
  };
}

export function buildReminderSchedulePlan(
  reminderLead: ReminderLead,
  scheduleItems: ScheduleItem[],
  currentReminderIds: StoredReminderMap,
  nowMs = Date.now(),
): ReminderSchedulePlan {
  const activeKeys = new Set<string>();
  const cancelIdentifiers: string[] = [];
  const cancelledIdentifiers = new Set<string>();
  const nextScheduleItems: ReminderSchedulePlanItem[] = [];
  const keptReminders: ReminderRecordMap = {};

  function getCurrentIdentifier(mapKey: string): string | undefined {
    const currentReminder = currentReminderIds[mapKey];

    if (!currentReminder) {
      return undefined;
    }

    return typeof currentReminder === 'string' ? currentReminder : currentReminder.identifier;
  }

  function cancelIdentifier(identifier: string | undefined) {
    if (!identifier || cancelledIdentifiers.has(identifier)) {
      return;
    }

    cancelledIdentifiers.add(identifier);
    cancelIdentifiers.push(identifier);
  }

  function isSameReminder(currentReminder: string | ReminderRecord | undefined, record: ReminderRecordInput): currentReminder is ReminderRecord {
    return (
      typeof currentReminder === 'object' &&
      currentReminder !== null &&
      currentReminder.fireDate === record.fireDate &&
      currentReminder.reminderLead === record.reminderLead &&
      currentReminder.startsAt === record.startsAt &&
      currentReminder.timeLabel === record.timeLabel &&
      currentReminder.location === record.location
    );
  }

  for (const item of scheduleItems) {
    if (!item.startsAt || item.status !== 'REMINDER_ON') {
      continue;
    }

    const fireDate = getReminderFireDate(item.startsAt, reminderLead);

    if (!fireDate || fireDate.getTime() <= nowMs) {
      continue;
    }

    const mapKey = item.cardId || item.id;

    if (activeKeys.has(mapKey)) {
      continue;
    }

    activeKeys.add(mapKey);
    const record: ReminderRecordInput = {
      fireDate: fireDate.toISOString(),
      reminderLead,
      startsAt: item.startsAt,
      timeLabel: item.timeLabel,
      location: item.location,
    };
    const currentReminder = currentReminderIds[mapKey];

    if (isSameReminder(currentReminder, record)) {
      keptReminders[mapKey] = currentReminder;
      continue;
    }

    cancelIdentifier(getCurrentIdentifier(mapKey));
    nextScheduleItems.push({
      mapKey,
      fireDate,
      record,
      content: buildReminderNotification({
        cardId: mapKey,
        title: item.title,
        startsAt: item.startsAt,
        timeLabel: item.timeLabel,
        location: item.location,
      }),
    });
  }

  for (const [mapKey, identifier] of Object.entries(currentReminderIds)) {
    if (!activeKeys.has(mapKey)) {
      cancelIdentifier(typeof identifier === 'string' ? identifier : identifier.identifier);
    }
  }

  return {
    cancelIdentifiers,
    scheduleItems: nextScheduleItems,
    keptReminders,
  };
}
