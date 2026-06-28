import type { PostgrestError } from '@supabase/supabase-js';

import type { FriendRepository } from '@/data/friendRepository';
import {
  assertSupabase,
  ensureProfile,
  getAuthenticatedUser,
  getProfileAvatarLabel,
  getProfileColor,
  type ProfileRow,
} from '@/data/supabaseProfile';
import { supabase } from '@/lib/supabase';
import { normalizeFriendHandle, type AppFriend, type FriendProfile, type FriendRequest, type FriendState } from '@/lib/friends';

type JoinedProfile = ProfileRow | ProfileRow[] | null;

interface FriendRequestRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  message: string;
  created_at: string;
  requester: JoinedProfile;
  addressee: JoinedProfile;
}

interface FriendshipRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
  user_a: JoinedProfile;
  user_b: JoinedProfile;
}

function getJoinedProfile(value: JoinedProfile): ProfileRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapFriendProfile(profile: ProfileRow, id: string): FriendProfile {
  return {
    id,
    profileId: profile.id,
    displayName: profile.display_name,
    handle: profile.handle,
    avatarLabel: getProfileAvatarLabel(profile.display_name),
    color: getProfileColor(profile.handle),
  };
}

function mapFriendship(row: FriendshipRow, userId: string): AppFriend | null {
  const otherProfile = getJoinedProfile(row.user_a_id === userId ? row.user_b : row.user_a);

  if (!otherProfile) {
    return null;
  }

  return {
    ...mapFriendProfile(otherProfile, row.id),
    lastActiveLabel: '',
  };
}

function mapRequest(row: FriendRequestRow, userId: string): FriendRequest | null {
  const direction = row.requester_id === userId ? 'OUTGOING' : 'INCOMING';
  const otherProfile = getJoinedProfile(direction === 'OUTGOING' ? row.addressee : row.requester);

  if (!otherProfile) {
    return null;
  }

  return {
    ...mapFriendProfile(otherProfile, row.id),
    direction,
    requestedAt: row.created_at,
    message: row.message || undefined,
  };
}

function getPostgrestCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as PostgrestError).code : undefined;
}

async function listFriendStateForUser(): Promise<FriendState> {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  await ensureProfile(user);

  const [friendshipsResult, requestsResult, profilesResult] = await Promise.all([
    client
      .from('friendships')
      .select(
        'id, user_a_id, user_b_id, created_at, user_a:profiles!friendships_user_a_id_fkey(id, handle, display_name, avatar_url, timezone), user_b:profiles!friendships_user_b_id_fkey(id, handle, display_name, avatar_url, timezone)',
      )
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    client
      .from('friend_requests')
      .select(
        'id, requester_id, addressee_id, message, created_at, requester:profiles!friend_requests_requester_id_fkey(id, handle, display_name, avatar_url, timezone), addressee:profiles!friend_requests_addressee_id_fkey(id, handle, display_name, avatar_url, timezone)',
      )
      .eq('status', 'PENDING')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    client
      .from('profiles')
      .select('id, handle, display_name, avatar_url, timezone')
      .neq('id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (friendshipsResult.error) {
    throw friendshipsResult.error;
  }

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const friends = ((friendshipsResult.data ?? []) as FriendshipRow[])
    .map((row) => mapFriendship(row, user.id))
    .filter((friend): friend is AppFriend => Boolean(friend));
  const requests = ((requestsResult.data ?? []) as FriendRequestRow[])
    .map((row) => mapRequest(row, user.id))
    .filter((request): request is FriendRequest => Boolean(request));
  const blockedProfileIds = new Set([
    user.id,
    ...friends.map((friend) => friend.profileId),
    ...requests.map((request) => request.profileId),
  ]);
  const suggestions = ((profilesResult.data ?? []) as ProfileRow[])
    .filter((profile) => !blockedProfileIds.has(profile.id))
    .slice(0, 5)
    .map((profile) => ({
      ...mapFriendProfile(profile, `suggestion-${profile.id}`),
      mutualCount: 0,
    }));

  return {
    friends,
    requests,
    suggestions,
  };
}

async function insertFriendRequest(addresseeId: string) {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  await ensureProfile(user);

  if (addresseeId === user.id) {
    throw new Error('내 계정은 친구로 추가할 수 없어요.');
  }

  const { error } = await client.from('friend_requests').insert({
    requester_id: user.id,
    addressee_id: addresseeId,
  });

  if (error && getPostgrestCode(error) !== '23505') {
    throw error;
  }

  return listFriendStateForUser();
}

export async function isSupabaseFriendRepositoryAvailable() {
  if (!supabase) {
    return false;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

export const supabaseFriendRepository: FriendRepository = {
  async listFriendState() {
    return listFriendStateForUser();
  },

  async acceptRequest(requestId) {
    const client = assertSupabase();
    const { error } = await client.from('friend_requests').update({ status: 'ACCEPTED' }).eq('id', requestId);

    if (error) {
      throw error;
    }

    return listFriendStateForUser();
  },

  async declineRequest(requestId) {
    const client = assertSupabase();
    const { error } = await client.from('friend_requests').update({ status: 'DECLINED' }).eq('id', requestId);

    if (error) {
      throw error;
    }

    return listFriendStateForUser();
  },

  async addFriend(suggestionId) {
    const profileId = suggestionId.replace(/^suggestion-/, '');
    return insertFriendRequest(profileId);
  },

  async sendRequestToHandle(rawHandle) {
    const handle = normalizeFriendHandle(rawHandle);

    if (!handle) {
      throw new Error('친구 아이디를 입력해 주세요.');
    }

    const client = assertSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('id, handle, display_name, avatar_url, timezone')
      .eq('handle', handle)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(`@${handle} 계정을 찾을 수 없어요.`);
    }

    return insertFriendRequest((data as ProfileRow).id);
  },

  async deleteFriend(friendId) {
    const client = assertSupabase();
    const { error } = await client.from('friendships').delete().eq('id', friendId);

    if (error) {
      throw error;
    }

    return listFriendStateForUser();
  },

  async cancelRequest(requestId) {
    const client = assertSupabase();
    const { error } = await client.from('friend_requests').update({ status: 'CANCELLED' }).eq('id', requestId);

    if (error) {
      throw error;
    }

    return listFriendStateForUser();
  },
};
