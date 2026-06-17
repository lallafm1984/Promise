export type FriendRequestDirection = 'INCOMING' | 'OUTGOING';

export interface FriendProfile {
  id: string;
  profileId: string;
  displayName: string;
  handle: string;
  avatarLabel: string;
  color: string;
}

export interface AppFriend extends FriendProfile {
  lastActiveLabel: string;
}

export interface FriendRequest extends FriendProfile {
  direction: FriendRequestDirection;
  requestedAt: string;
  message?: string;
}

export interface FriendSuggestion extends FriendProfile {
  mutualCount: number;
}

export interface FriendState {
  friends: AppFriend[];
  requests: FriendRequest[];
  suggestions: FriendSuggestion[];
}

export interface FriendSummary {
  friendCount: number;
  incomingCount: number;
  outgoingCount: number;
  suggestionCount: number;
}

const profileColors = ['#BFE8FF', '#FFC9BA', '#FFE0B8', '#DDEBFF', '#FFF0B8', '#E9DDFF', '#DDF4F2'];

export function normalizeFriendHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^whenbollae\.app\/?/i, '')
    .replace(/^\/+/, '')
    .replace(/^@/, '')
    .split(/[/?#\s]/)[0]
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

function getProfileColor(handle: string) {
  const seed = handle.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return profileColors[seed % profileColors.length];
}

function buildRequestFromHandle(handle: string, requestedAt: string): FriendRequest {
  const displayName = handle.length > 0 ? handle[0].toUpperCase() + handle.slice(1) : '친구';
  const avatarLabel = displayName.slice(0, 1);

  return {
    id: `request-profile-${handle}`,
    direction: 'OUTGOING',
    profileId: `profile-${handle}`,
    displayName,
    handle,
    avatarLabel,
    color: getProfileColor(handle),
    requestedAt,
  };
}

export function getFriendSummary(state: FriendState): FriendSummary {
  return {
    friendCount: state.friends.length,
    incomingCount: state.requests.filter((request) => request.direction === 'INCOMING').length,
    outgoingCount: state.requests.filter((request) => request.direction === 'OUTGOING').length,
    suggestionCount: state.suggestions.length,
  };
}

export function acceptFriendRequest(state: FriendState, requestId: string): FriendState {
  const request = state.requests.find((currentRequest) => currentRequest.id === requestId);

  if (!request || request.direction !== 'INCOMING') {
    return state;
  }

  const alreadyFriends = state.friends.some((friend) => friend.profileId === request.profileId);
  const acceptedFriend: AppFriend = {
    id: `friend-${request.profileId}`,
    profileId: request.profileId,
    displayName: request.displayName,
    handle: request.handle,
    avatarLabel: request.avatarLabel,
    color: request.color,
    lastActiveLabel: '방금 수락',
  };

  return {
    ...state,
    friends: alreadyFriends ? state.friends : [acceptedFriend, ...state.friends],
    requests: state.requests.filter((currentRequest) => currentRequest.id !== requestId),
  };
}

export function declineFriendRequest(state: FriendState, requestId: string): FriendState {
  const request = state.requests.find((currentRequest) => currentRequest.id === requestId);

  if (!request || request.direction !== 'INCOMING') {
    return state;
  }

  return {
    ...state,
    requests: state.requests.filter((currentRequest) => currentRequest.id !== requestId),
  };
}

export function removeFriend(state: FriendState, friendId: string): FriendState {
  return {
    ...state,
    friends: state.friends.filter((friend) => friend.id !== friendId),
  };
}

export function cancelOutgoingRequest(state: FriendState, requestId: string): FriendState {
  const request = state.requests.find((currentRequest) => currentRequest.id === requestId);

  if (!request || request.direction !== 'OUTGOING') {
    return state;
  }

  return {
    ...state,
    requests: state.requests.filter((currentRequest) => currentRequest.id !== requestId),
  };
}

export function sendFriendRequestByHandle(
  state: FriendState,
  rawHandle: string,
  requestedAt = new Date().toISOString(),
): FriendState {
  const handle = normalizeFriendHandle(rawHandle);

  if (handle.length === 0) {
    return state;
  }

  const profileId = `profile-${handle}`;
  const alreadyRequested = state.requests.some(
    (request) => request.profileId === profileId || request.handle.toLowerCase() === handle,
  );
  const alreadyFriends = state.friends.some(
    (friend) => friend.profileId === profileId || friend.handle.toLowerCase() === handle,
  );

  if (alreadyRequested || alreadyFriends) {
    return state;
  }

  return {
    ...state,
    requests: [...state.requests, buildRequestFromHandle(handle, requestedAt)],
  };
}

export function sendFriendRequest(state: FriendState, suggestionId: string, requestedAt = new Date().toISOString()): FriendState {
  const suggestion = state.suggestions.find((currentSuggestion) => currentSuggestion.id === suggestionId);

  if (!suggestion) {
    return state;
  }

  const alreadyRequested = state.requests.some((request) => request.profileId === suggestion.profileId);
  const alreadyFriends = state.friends.some((friend) => friend.profileId === suggestion.profileId);

  if (alreadyRequested || alreadyFriends) {
    return {
      ...state,
      suggestions: state.suggestions.filter((currentSuggestion) => currentSuggestion.id !== suggestionId),
    };
  }

  const request: FriendRequest = {
    id: `request-${suggestion.profileId}`,
    direction: 'OUTGOING',
    profileId: suggestion.profileId,
    displayName: suggestion.displayName,
    handle: suggestion.handle,
    avatarLabel: suggestion.avatarLabel,
    color: suggestion.color,
    requestedAt,
  };

  return {
    ...state,
    requests: [...state.requests, request],
    suggestions: state.suggestions.filter((currentSuggestion) => currentSuggestion.id !== suggestionId),
  };
}
