import { getRecipientProfileIds } from './cardMenu';
import type { AppFriend } from './friends';

export const TEST_PREVIEW_APP_FRIENDS: AppFriend[] = [
  {
    id: 'test-friend-jiu',
    profileId: 'test-profile-jiu',
    displayName: '테스트 지우',
    handle: 'test-jiu',
    avatarLabel: '지',
    color: '#BFE8FF',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-seoa',
    profileId: 'test-profile-seoa',
    displayName: '테스트 서아',
    handle: 'test-seoa',
    avatarLabel: '서',
    color: '#FFE0B8',
    lastActiveLabel: '테스트',
  },
];

export function getPreviewFriendOptions(friends: AppFriend[]) {
  if (friends.length > 0) {
    return {
      options: friends,
      isUsingTestFriends: false,
    };
  }

  return {
    options: TEST_PREVIEW_APP_FRIENDS,
    isUsingTestFriends: true,
  };
}

export function getPreviewRecipientProfileIds(friends: AppFriend[], selectedFriendIds: string[]): string[] {
  if (friends.length === 0) {
    return [];
  }

  return getRecipientProfileIds(friends, selectedFriendIds);
}

export function selectOnePreviewFriend(selectedFriendIds: string[], friendId: string): string[] {
  return selectedFriendIds.includes(friendId) ? [] : [friendId];
}
