import { describe, expect, it } from 'vitest';

import {
  acceptFriendRequest,
  cancelOutgoingRequest,
  declineFriendRequest,
  getFriendSummary,
  normalizeFriendHandle,
  removeFriend,
  sendFriendRequest,
  sendFriendRequestByHandle,
  type FriendState,
} from './friends';

const baseState: FriendState = {
  friends: [
    {
      id: 'friend-jiu',
      profileId: 'profile-jiu',
      displayName: '지우',
      handle: 'jiwoo',
      avatarLabel: '우',
      color: '#BFE8FF',
      lastActiveLabel: '방금 전',
    },
  ],
  requests: [
    {
      id: 'request-harin',
      direction: 'INCOMING',
      profileId: 'profile-harin',
      displayName: '하린',
      handle: 'harin',
      avatarLabel: '린',
      color: '#FFE0B8',
      requestedAt: '2026-06-15T10:30:00+09:00',
      message: '성수 약속 같이 잡자',
    },
    {
      id: 'request-yuna',
      direction: 'OUTGOING',
      profileId: 'profile-yuna',
      displayName: '유나',
      handle: 'yuna',
      avatarLabel: '윤',
      color: '#DDEBFF',
      requestedAt: '2026-06-15T09:20:00+09:00',
    },
  ],
  suggestions: [
    {
      id: 'suggestion-soo',
      profileId: 'profile-soo',
      displayName: '수아',
      handle: 'sua',
      avatarLabel: '수',
      color: '#FFF0B8',
      mutualCount: 2,
    },
  ],
};

describe('friend helpers', () => {
  it('accepts an incoming request and adds the sender to friends', () => {
    const nextState = acceptFriendRequest(baseState, 'request-harin');

    expect(nextState.requests.map((request) => request.id)).toEqual(['request-yuna']);
    expect(nextState.friends.map((friend) => friend.profileId)).toEqual(['profile-harin', 'profile-jiu']);
  });

  it('declines an incoming request without changing friends', () => {
    const nextState = declineFriendRequest(baseState, 'request-harin');

    expect(nextState.requests.map((request) => request.id)).toEqual(['request-yuna']);
    expect(nextState.friends).toEqual(baseState.friends);
  });

  it('turns a suggested profile into an outgoing request', () => {
    const nextState = sendFriendRequest(baseState, 'suggestion-soo', '2026-06-15T12:00:00+09:00');

    expect(nextState.suggestions).toEqual([]);
    expect(nextState.requests.at(-1)).toMatchObject({
      direction: 'OUTGOING',
      profileId: 'profile-soo',
      displayName: '수아',
    });
  });

  it('normalizes profile links and raw handles before sending requests', () => {
    expect(normalizeFriendHandle('@MINSOO')).toBe('minsoo');
    expect(normalizeFriendHandle('https://whenbollae.app/@minsoo?from=share')).toBe('minsoo');
  });

  it('turns a typed handle into an outgoing request', () => {
    const nextState = sendFriendRequestByHandle(baseState, '@minsoo', '2026-06-15T12:30:00+09:00');

    expect(nextState.requests.at(-1)).toMatchObject({
      direction: 'OUTGOING',
      profileId: 'profile-minsoo',
      handle: 'minsoo',
      requestedAt: '2026-06-15T12:30:00+09:00',
    });
  });

  it('does not duplicate a friend or pending request when adding by handle', () => {
    const friendDuplicate = sendFriendRequestByHandle(baseState, '@jiwoo', '2026-06-15T12:30:00+09:00');
    const requestDuplicate = sendFriendRequestByHandle(baseState, '@yuna', '2026-06-15T12:30:00+09:00');

    expect(friendDuplicate).toEqual(baseState);
    expect(requestDuplicate).toEqual(baseState);
  });

  it('removes a friend from the friend list', () => {
    const nextState = removeFriend(baseState, 'friend-jiu');

    expect(nextState.friends).toEqual([]);
    expect(nextState.requests).toEqual(baseState.requests);
  });

  it('cancels only outgoing friend requests', () => {
    const afterIncomingAttempt = cancelOutgoingRequest(baseState, 'request-harin');
    const afterOutgoingCancel = cancelOutgoingRequest(baseState, 'request-yuna');

    expect(afterIncomingAttempt).toEqual(baseState);
    expect(afterOutgoingCancel.requests.map((request) => request.id)).toEqual(['request-harin']);
  });

  it('summarizes friends and request queues for UI badges', () => {
    expect(getFriendSummary(baseState)).toEqual({
      friendCount: 1,
      incomingCount: 1,
      outgoingCount: 1,
      suggestionCount: 1,
    });
  });
});
