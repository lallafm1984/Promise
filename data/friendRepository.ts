import { mockFriendRepository } from '@/data/mockFriendRepository';
import { isSupabaseFriendRepositoryAvailable, supabaseFriendRepository } from '@/data/supabaseFriendRepository';
import type { FriendState } from '@/lib/friends';

export interface FriendRepository {
  listFriendState(): Promise<FriendState>;
  acceptRequest(requestId: string): Promise<FriendState>;
  declineRequest(requestId: string): Promise<FriendState>;
  addFriend(suggestionId: string): Promise<FriendState>;
  sendRequestToHandle(handle: string): Promise<FriendState>;
  deleteFriend(friendId: string): Promise<FriendState>;
  cancelRequest(requestId: string): Promise<FriendState>;
}

export async function getActiveFriendRepository(): Promise<{ persisted: boolean; repository: FriendRepository }> {
  if (await isSupabaseFriendRepositoryAvailable()) {
    return {
      persisted: true,
      repository: supabaseFriendRepository,
    };
  }

  return {
    persisted: false,
    repository: mockFriendRepository,
  };
}
