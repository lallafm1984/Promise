import { getRecipientProfileIds } from './cardMenu';
import type { AppFriend } from './friends';

export function getPreviewFriendOptions(friends: AppFriend[]) {
  if (friends.length > 0) {
    return {
      options: friends,
      isUsingTestFriends: false,
    };
  }

  return {
    options: [],
    isUsingTestFriends: false,
  };
}

export function getPreviewRecipientProfileIds(friends: AppFriend[], selectedFriendIds: string[]): string[] {
  if (friends.length === 0) {
    return [];
  }

  return getRecipientProfileIds(friends, selectedFriendIds);
}

export function togglePreviewFriendSelection(selectedFriendIds: string[], friendId: string): string[] {
  return selectedFriendIds.includes(friendId)
    ? selectedFriendIds.filter((selectedFriendId) => selectedFriendId !== friendId)
    : [...selectedFriendIds, friendId];
}
