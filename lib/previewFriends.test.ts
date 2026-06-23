import { describe, expect, it } from 'vitest';

import {
  getPreviewFriendOptions,
  getPreviewRecipientProfileIds,
  togglePreviewFriendSelection,
} from './previewFriends';
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
const otherFriend: AppFriend = {
  id: 'friend-other',
  profileId: 'profile-other',
  displayName: 'Other Friend',
  handle: 'other',
  avatarLabel: 'O',
  color: '#FFE0B8',
  lastActiveLabel: 'now',
};

describe('preview friend test options', () => {
  it('does not provide fake recipient options when the account has no app friends', () => {
    const result = getPreviewFriendOptions([]);

    expect(result.isUsingTestFriends).toBe(false);
    expect(result.options).toEqual([]);
  });

  it('does not send fake recipient profile ids for test friends', () => {
    const result = getPreviewFriendOptions([]);
    const recipientIds = getPreviewRecipientProfileIds([], ['test-friend-jiu']);

    expect(recipientIds).toEqual([]);
  });

  it('uses real friend recipient profile ids when friends exist', () => {
    const recipientIds = getPreviewRecipientProfileIds([realFriend], [realFriend.id]);

    expect(recipientIds).toEqual(['profile-real']);
  });

  it('keeps multiple real recipient profile ids in selection order', () => {
    const recipientIds = getPreviewRecipientProfileIds(
      [realFriend, otherFriend],
      [otherFriend.id, realFriend.id],
    );

    expect(recipientIds).toEqual(['profile-other', 'profile-real']);
  });

  it('toggles multiple selected friends without replacing existing selections', () => {
    expect(togglePreviewFriendSelection([], 'friend-a')).toEqual(['friend-a']);
    expect(togglePreviewFriendSelection(['friend-a'], 'friend-b')).toEqual(['friend-a', 'friend-b']);
    expect(togglePreviewFriendSelection(['friend-a', 'friend-b'], 'friend-a')).toEqual(['friend-b']);
  });

  it('does not expand preview-only QA rows', () => {
    expect(getPreviewFriendOptions([realFriend]).options).toEqual([realFriend]);
    expect(getPreviewRecipientProfileIds([realFriend], ['qa-preview-friend-2'])).toEqual([]);
  });
});
