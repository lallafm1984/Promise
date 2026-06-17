import { describe, expect, it } from 'vitest';

import type { AppFriend, FriendRequest } from '@/lib/friends';
import type { ReceivedCardAlert } from '@/types/promise';
import {
  buildCardReceivedNotification,
  buildFriendAcceptedNotification,
  buildFriendRequestNotification,
  buildReminderNotification,
  buildReminderSchedulePlan,
  buildTestNotification,
  getNewAcceptedFriends,
  getNewIncomingFriendRequests,
  getNewReceivedCardAlerts,
  getReminderFireDate,
} from './notifications';

function localIso(month: number, day: number, hours: number, minutes: number): string {
  return new Date(2026, month - 1, day, hours, minutes, 0, 0).toISOString();
}

const incomingRequest: FriendRequest = {
  id: 'request-harin',
  direction: 'INCOMING',
  profileId: 'profile-harin',
  displayName: '하린',
  handle: 'harin',
  avatarLabel: '린',
  color: '#FFE0B8',
  requestedAt: localIso(6, 16, 12, 0),
};

const outgoingRequest: FriendRequest = {
  ...incomingRequest,
  id: 'request-yuna',
  direction: 'OUTGOING',
  profileId: 'profile-yuna',
  displayName: '유나',
};

const cardAlert: ReceivedCardAlert = {
  id: 'card-seongsu',
  title: '성수 카페에서 언제볼래?',
  location: '성수 카페',
  requesterName: '민서',
  createdAt: localIso(6, 16, 13, 0),
};

const acceptedFriend: AppFriend = {
  id: 'friend-yuna',
  profileId: 'profile-yuna',
  displayName: '유나',
  handle: 'yuna',
  avatarLabel: '유',
  color: '#DDEBFF',
  lastActiveLabel: '계정 동기화됨',
};

describe('notification helpers', () => {
  it('filters only new incoming friend requests', () => {
    expect(getNewIncomingFriendRequests(['request-old'], [incomingRequest, outgoingRequest]).map((request) => request.id)).toEqual([
      'request-harin',
    ]);
    expect(getNewIncomingFriendRequests(['request-harin'], [incomingRequest, outgoingRequest])).toEqual([]);
  });

  it('filters only newly received card alerts', () => {
    expect(getNewReceivedCardAlerts(['card-old'], [cardAlert]).map((alert) => alert.id)).toEqual(['card-seongsu']);
    expect(getNewReceivedCardAlerts(['card-seongsu'], [cardAlert])).toEqual([]);
  });

  it('filters only newly accepted friends', () => {
    expect(getNewAcceptedFriends(['friend-old'], [acceptedFriend]).map((friend) => friend.id)).toEqual(['friend-yuna']);
    expect(getNewAcceptedFriends(['friend-yuna'], [acceptedFriend])).toEqual([]);
  });

  it('calculates reminder dates from the selected lead time', () => {
    expect(getReminderFireDate(localIso(6, 20, 17, 0), '10_MIN')?.toISOString()).toBe(localIso(6, 20, 16, 50));
    expect(getReminderFireDate(localIso(6, 20, 17, 0), '30_MIN')?.toISOString()).toBe(localIso(6, 20, 16, 30));
    expect(getReminderFireDate(localIso(6, 20, 17, 0), '1_HOUR')?.toISOString()).toBe(localIso(6, 20, 16, 0));
    expect(getReminderFireDate('bad-date', '30_MIN')).toBeNull();
  });

  it('builds user-facing notification copy', () => {
    expect(buildFriendRequestNotification(incomingRequest)).toEqual({
      title: '새 친구 요청',
      body: '하린님이 친구를 요청했어요.',
      data: { url: '/friends', type: 'friend_request', id: 'request-harin' },
    });
    expect(buildFriendAcceptedNotification(acceptedFriend)).toEqual({
      title: '친구 추가 완료',
      body: '유나님과 친구가 되었어요.',
      data: { url: '/friends', type: 'friend_accepted', id: 'friend-yuna' },
    });
    expect(buildCardReceivedNotification(cardAlert)).toEqual({
      title: '새 약속 카드',
      body: '민서님이 성수 카페 약속 카드를 보냈어요.',
      data: { url: '/manage', type: 'card_received', id: 'card-seongsu' },
    });
    expect(
      buildReminderNotification({
        cardId: 'card-gangnam',
        title: '강남 CGV에서 볼래?',
        startsAt: localIso(6, 20, 17, 0),
        timeLabel: '17:00 - 19:20',
        location: '강남 CGV',
      }),
    ).toEqual({
      title: '약속 리마인드',
      body: '17:00 - 19:20 · 강남 CGV',
      data: { url: '/schedule', type: 'appointment_reminder', id: 'card-gangnam' },
    });
    expect(buildTestNotification()).toEqual({
      title: '언제볼래 테스트 알림',
      body: '폰 알림이 정상적으로 도착했어요.',
      data: { url: '/profile', type: 'test_notification', id: 'test-notification' },
    });
  });

  it('cancels stale reminder notifications when appointments are no longer schedulable', () => {
    const futureSchedule = {
      id: 'manual-dinner',
      cardId: 'manual-dinner',
      title: '저녁 약속',
      startsAt: localIso(6, 20, 18, 0),
      endsAt: localIso(6, 20, 19, 0),
      dateLabel: '6월 20일',
      timeLabel: '18:00 - 19:00',
      location: '성수',
      status: 'REMINDER_ON' as const,
    };

    const plan = buildReminderSchedulePlan(
      '30_MIN',
      [futureSchedule],
      {
        'manual-dinner': 'existing-active-notification',
        'removed-card': 'stale-notification',
      },
      new Date(localIso(6, 20, 12, 0)).getTime(),
    );

    expect(plan.cancelIdentifiers).toEqual(['existing-active-notification', 'stale-notification']);
    expect(plan.scheduleItems.map((item) => item.mapKey)).toEqual(['manual-dinner']);
    expect(plan.scheduleItems[0]?.fireDate.toISOString()).toBe(localIso(6, 20, 17, 30));
  });

  it('keeps unchanged reminder notifications instead of rescheduling on every refresh', () => {
    const futureSchedule = {
      id: 'manual-dinner',
      cardId: 'manual-dinner',
      title: '저녁 약속',
      startsAt: localIso(6, 20, 18, 0),
      endsAt: localIso(6, 20, 19, 0),
      dateLabel: '6월 20일',
      timeLabel: '18:00 - 19:00',
      location: '성수',
      status: 'REMINDER_ON' as const,
    };
    const currentReminder = {
      identifier: 'existing-active-notification',
      fireDate: localIso(6, 20, 17, 30),
      reminderLead: '30_MIN' as const,
      startsAt: futureSchedule.startsAt,
      timeLabel: futureSchedule.timeLabel,
      location: futureSchedule.location,
    };

    const plan = buildReminderSchedulePlan(
      '30_MIN',
      [futureSchedule],
      {
        'manual-dinner': currentReminder,
      },
      new Date(localIso(6, 20, 12, 0)).getTime(),
    );

    expect(plan.cancelIdentifiers).toEqual([]);
    expect(plan.scheduleItems).toEqual([]);
    expect(plan.keptReminders).toEqual({
      'manual-dinner': currentReminder,
    });
  });

  it('deduplicates repeated schedule items for the same appointment card', () => {
    const futureSchedule = {
      id: 'schedule-gangnam-movie',
      cardId: 'card-gangnam-movie',
      title: '강남 CGV',
      startsAt: localIso(6, 20, 17, 0),
      endsAt: localIso(6, 20, 19, 20),
      dateLabel: '6월 20일',
      timeLabel: '17:00 - 19:20',
      location: '강남 CGV',
      status: 'REMINDER_ON' as const,
    };

    const plan = buildReminderSchedulePlan(
      '30_MIN',
      [
        futureSchedule,
        {
          ...futureSchedule,
          id: 'schedule-gangnam-movie-duplicate',
        },
      ],
      {},
      new Date(localIso(6, 20, 12, 0)).getTime(),
    );

    expect(plan.scheduleItems.map((item) => item.mapKey)).toEqual(['card-gangnam-movie']);
  });
});
