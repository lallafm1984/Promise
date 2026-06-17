import type { FriendRepository } from '@/data/friendRepository';
import {
  acceptFriendRequest,
  cancelOutgoingRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  sendFriendRequestByHandle,
  type FriendState,
} from '@/lib/friends';

const initialFriendState: FriendState = {
  friends: [
    {
      id: 'friend-jiu',
      profileId: 'profile-jiu',
      displayName: '지우',
      handle: 'jiwoo',
      avatarLabel: '지',
      color: '#BFE8FF',
      lastActiveLabel: '방금 전',
    },
    {
      id: 'friend-seoa',
      profileId: 'profile-seoa',
      displayName: '서아',
      handle: 'seoa',
      avatarLabel: '서',
      color: '#FFC9BA',
      lastActiveLabel: '어제',
    },
  ],
  requests: [
    {
      id: 'request-harin',
      direction: 'INCOMING',
      profileId: 'profile-harin',
      displayName: '하린',
      handle: 'harin',
      avatarLabel: '하',
      color: '#FFE0B8',
      requestedAt: '2026-06-15T10:30:00+09:00',
      message: '점심 약속 같이 잡자',
    },
    {
      id: 'request-yuna',
      direction: 'OUTGOING',
      profileId: 'profile-yuna',
      displayName: '유나',
      handle: 'yuna',
      avatarLabel: '유',
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
    {
      id: 'suggestion-dan',
      profileId: 'profile-dan',
      displayName: '단비',
      handle: 'danbi',
      avatarLabel: '단',
      color: '#E9DDFF',
      mutualCount: 1,
    },
  ],
};

let friendState = initialFriendState;

export const mockFriendRepository: FriendRepository = {
  async listFriendState() {
    return friendState;
  },

  async acceptRequest(requestId) {
    friendState = acceptFriendRequest(friendState, requestId);
    return friendState;
  },

  async declineRequest(requestId) {
    friendState = declineFriendRequest(friendState, requestId);
    return friendState;
  },

  async addFriend(suggestionId) {
    friendState = sendFriendRequest(friendState, suggestionId);
    return friendState;
  },

  async sendRequestToHandle(handle) {
    friendState = sendFriendRequestByHandle(friendState, handle);
    return friendState;
  },

  async deleteFriend(friendId) {
    friendState = removeFriend(friendState, friendId);
    return friendState;
  },

  async cancelRequest(requestId) {
    friendState = cancelOutgoingRequest(friendState, requestId);
    return friendState;
  },
};
