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
  {
    id: 'test-friend-minjun',
    profileId: 'test-profile-minjun',
    displayName: '테스트 민준',
    handle: 'test-minjun',
    avatarLabel: '민',
    color: '#D8F5C7',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-harin',
    profileId: 'test-profile-harin',
    displayName: '테스트 하린',
    handle: 'test-harin',
    avatarLabel: '하',
    color: '#FFD6E7',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-doyun',
    profileId: 'test-profile-doyun',
    displayName: '테스트 도윤',
    handle: 'test-doyun',
    avatarLabel: '도',
    color: '#D7D9FF',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-yuna',
    profileId: 'test-profile-yuna',
    displayName: '테스트 유나',
    handle: 'test-yuna',
    avatarLabel: '유',
    color: '#C8F0EA',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-sihyun',
    profileId: 'test-profile-sihyun',
    displayName: '테스트 시현',
    handle: 'test-sihyun',
    avatarLabel: '시',
    color: '#FFE6A7',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-chaeun',
    profileId: 'test-profile-chaeun',
    displayName: '테스트 채은',
    handle: 'test-chaeun',
    avatarLabel: '채',
    color: '#F4D2FF',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-joon',
    profileId: 'test-profile-joon',
    displayName: '테스트 준',
    handle: 'test-joon',
    avatarLabel: '준',
    color: '#CFE8FF',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-nari',
    profileId: 'test-profile-nari',
    displayName: '테스트 나리',
    handle: 'test-nari',
    avatarLabel: '나',
    color: '#FFD1C2',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-taeho',
    profileId: 'test-profile-taeho',
    displayName: '테스트 태호',
    handle: 'test-taeho',
    avatarLabel: '태',
    color: '#D6F2B8',
    lastActiveLabel: '테스트',
  },
  {
    id: 'test-friend-sora',
    profileId: 'test-profile-sora',
    displayName: '테스트 소라',
    handle: 'test-sora',
    avatarLabel: '소',
    color: '#FAD0D7',
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
