import { describe, expect, it } from 'vitest';

import type { HostProfile, PromiseCard, ScheduleItem } from '@/types/promise';
import {
  createPromiseDataRefreshChannelName,
  getPromiseDataLoadErrorState,
  shouldReloadPromiseDataForAppState,
  type PromiseDataState,
} from './promiseDataState';

const profile: HostProfile = {
  id: 'profile-minseo',
  displayName: '민서',
  handle: 'minseo',
  profileUrl: 'whenbollae.app/@minseo',
  timezone: 'Asia/Seoul',
  availabilitySummary: [],
  reminderLead: '30_MIN',
};

const recentCard: PromiseCard = {
  id: 'card-seongsu',
  mode: 'DIRECT',
  status: 'PENDING',
  title: '성수에서 이때볼래?',
  hostName: '민서',
  location: '성수',
  message: '',
  sharedUrl: 'whenbollae.app/c/card-seongsu',
  createdAt: '2026-06-16T10:00:00+09:00',
  candidates: [],
  participants: [],
};

const scheduleItem: ScheduleItem = {
  id: 'schedule-seongsu',
  cardId: 'card-seongsu',
  title: '성수에서 이때볼래?',
  startsAt: '2026-06-20T12:00:00+09:00',
  endsAt: '2026-06-20T13:00:00+09:00',
  dateLabel: '6월 20일',
  timeLabel: '12:00 - 13:00',
  location: '성수',
  status: 'REMINDER_ON',
};

describe('promise data state', () => {
  it('creates a fresh realtime channel name for each mounted data subscriber', () => {
    const firstChannelName = createPromiseDataRefreshChannelName();
    const secondChannelName = createPromiseDataRefreshChannelName();

    expect(firstChannelName).toMatch(/^promise-data-refresh-\d+$/);
    expect(secondChannelName).toMatch(/^promise-data-refresh-\d+$/);
    expect(secondChannelName).not.toBe(firstChannelName);
  });

  it('clears previously loaded user data when a reload fails', () => {
    const current: PromiseDataState = {
      profile,
      recentCards: [recentCard],
      scheduleItems: [scheduleItem],
      isLoading: true,
      persisted: true,
      error: null,
    };

    expect(getPromiseDataLoadErrorState(current, new Error('세션이 만료됐어요.'))).toEqual({
      profile: null,
      recentCards: [],
      scheduleItems: [],
      isLoading: false,
      persisted: false,
      error: '세션이 만료됐어요.',
    });
  });

  it('uses the generic copy for non-error failures', () => {
    const current: PromiseDataState = {
      profile: null,
      recentCards: [],
      scheduleItems: [],
      isLoading: true,
      persisted: false,
      error: null,
    };

    expect(getPromiseDataLoadErrorState(current, 'bad')).toMatchObject({
      error: '데이터를 불러오지 못했어요.',
    });
  });

  it('reloads promise data when the app returns to the foreground', () => {
    expect(shouldReloadPromiseDataForAppState('active')).toBe(true);
    expect(shouldReloadPromiseDataForAppState('background')).toBe(false);
    expect(shouldReloadPromiseDataForAppState('inactive')).toBe(false);
  });
});
