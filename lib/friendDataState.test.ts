import { describe, expect, it } from 'vitest';

import type { AppFriend, FriendRequest, FriendState, FriendSuggestion } from './friends';
import {
  buildFriendDataCache,
  createFriendDataRefreshChannelName,
  getFriendDataLoadErrorState,
  getFriendDataSnapshotKey,
  parseFriendDataCache,
  shouldReloadFriendDataForAppState,
  shouldSkipFriendDataReload,
  type FriendDataState,
} from './friendDataState';

const friend: AppFriend = {
  id: 'friend-jiu',
  profileId: 'profile-jiu',
  displayName: '지우',
  handle: 'jiu',
  avatarLabel: '지',
  color: '#BFE8FF',
  lastActiveLabel: '계정 동기화됨',
};

const request: FriendRequest = {
  id: 'request-harin',
  profileId: 'profile-harin',
  displayName: '하린',
  handle: 'harin',
  avatarLabel: '하',
  color: '#FFC9BA',
  direction: 'INCOMING',
  requestedAt: '2026-06-23T09:00:00.000Z',
};

const suggestion: FriendSuggestion = {
  id: 'suggestion-yuna',
  profileId: 'profile-yuna',
  displayName: '유나',
  handle: 'yuna',
  avatarLabel: '유',
  color: '#FFE0B8',
  mutualCount: 0,
};

const friendState: FriendState = {
  friends: [friend],
  requests: [request],
  suggestions: [suggestion],
};

describe('friend data state', () => {
  it('serializes and restores cached friend state payloads', () => {
    const payload = {
      friendState,
      persisted: true,
    };
    const cache = buildFriendDataCache(payload, '2026-06-23T12:00:00.000Z');

    expect(parseFriendDataCache(cache)).toEqual(payload);
    expect(parseFriendDataCache('bad json')).toBeNull();
    expect(parseFriendDataCache(JSON.stringify({ version: 0, payload }))).toBeNull();
    expect(parseFriendDataCache(JSON.stringify({ version: 1, payload: { friendState: {}, persisted: true } }))).toBeNull();
  });

  it('keeps cached friend data visible when a reload fails', () => {
    const current: FriendDataState = {
      ...friendState,
      isLoading: true,
      isMutating: false,
      isPersisted: true,
      error: null,
    };

    expect(getFriendDataLoadErrorState(current, new Error('세션이 만료되었어요.'))).toEqual({
      ...friendState,
      isLoading: false,
      isMutating: false,
      isPersisted: true,
      error: '세션이 만료되었어요.',
    });
  });

  it('reloads friend data when the app returns to the foreground', () => {
    expect(shouldReloadFriendDataForAppState('active')).toBe(true);
    expect(shouldReloadFriendDataForAppState('background')).toBe(false);
    expect(shouldReloadFriendDataForAppState('inactive')).toBe(false);
  });

  it('creates stable snapshot keys and unique realtime channel names', () => {
    const payload = {
      friendState,
      persisted: true,
    };
    const firstChannelName = createFriendDataRefreshChannelName();
    const secondChannelName = createFriendDataRefreshChannelName();

    expect(getFriendDataSnapshotKey(payload)).toBe(getFriendDataSnapshotKey({ ...payload }));
    expect(firstChannelName).toMatch(/^friend-data-refresh-\d+$/);
    expect(secondChannelName).toMatch(/^friend-data-refresh-\d+$/);
    expect(secondChannelName).not.toBe(firstChannelName);
  });

  it('skips non-forced reloads inside the minimum interval when cached data exists', () => {
    expect(
      shouldSkipFriendDataReload({
        force: false,
        hasSnapshot: true,
        lastLoadedAtMs: 1_000,
        minIntervalMs: 30_000,
        nowMs: 10_000,
      }),
    ).toBe(true);

    expect(
      shouldSkipFriendDataReload({
        force: true,
        hasSnapshot: true,
        lastLoadedAtMs: 1_000,
        minIntervalMs: 30_000,
        nowMs: 10_000,
      }),
    ).toBe(false);
  });
});
