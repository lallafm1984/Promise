import { describe, expect, it } from 'vitest';

import { getPreviewFriendOptions, getPreviewRecipientProfileIds, selectOnePreviewFriend } from './previewFriends';
import type { AppFriend } from './friends';

const realFriend: AppFriend = {
  id: 'friend-real',
  profileId: 'profile-real',
  displayName: 'Real Friend',
  handle: 'real',
  avatarLabel: 'R',
  color: '#BFE8FF',
  lastActiveLabel: 'now',
};

describe('preview friend test options', () => {
  it('provides selectable test friends when the account has no app friends', () => {
    const result = getPreviewFriendOptions([]);

    expect(result.isUsingTestFriends).toBe(true);
    expect(result.options).toHaveLength(12);
    expect(result.options[0].id).toMatch(/^test-friend-/);
  });

  it('does not send fake recipient profile ids for test friends', () => {
    const result = getPreviewFriendOptions([]);
    const recipientIds = getPreviewRecipientProfileIds([], [result.options[0].id]);

    expect(recipientIds).toEqual([]);
  });

  it('uses real friend recipient profile ids when friends exist', () => {
    const recipientIds = getPreviewRecipientProfileIds([realFriend], [realFriend.id]);

    expect(recipientIds).toEqual(['profile-real']);
  });

  it('keeps only one selected friend at a time', () => {
    expect(selectOnePreviewFriend([], 'friend-a')).toEqual(['friend-a']);
    expect(selectOnePreviewFriend(['friend-a'], 'friend-b')).toEqual(['friend-b']);
    expect(selectOnePreviewFriend(['friend-b'], 'friend-b')).toEqual([]);
  });
});
