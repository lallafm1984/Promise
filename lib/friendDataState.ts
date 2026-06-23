import type { FriendState } from './friends';

export interface FriendDataState extends FriendState {
  isLoading: boolean;
  isMutating: boolean;
  isPersisted: boolean;
  error: string | null;
}

export interface FriendDataPayload {
  friendState: FriendState;
  persisted: boolean;
}

interface FriendDataReloadDecisionInput {
  force?: boolean;
  hasSnapshot: boolean;
  lastLoadedAtMs: number | null;
  minIntervalMs: number;
  nowMs: number;
}

interface StoredFriendDataCache {
  version: 1;
  cachedAt: string;
  payload: FriendDataPayload;
}

export const FRIEND_DATA_CACHE_VERSION = 1;

let friendDataRefreshChannelSequence = 0;

export function createFriendDataRefreshChannelName() {
  friendDataRefreshChannelSequence += 1;
  return `friend-data-refresh-${friendDataRefreshChannelSequence}`;
}

export function shouldReloadFriendDataForAppState(state: string) {
  return state === 'active';
}

export function shouldSkipFriendDataReload(input: FriendDataReloadDecisionInput) {
  if (input.force || !input.hasSnapshot || input.lastLoadedAtMs === null) {
    return false;
  }

  return input.nowMs - input.lastLoadedAtMs < input.minIntervalMs;
}

export function getFriendDataLoadErrorState(current: FriendDataState, error: unknown): FriendDataState {
  return {
    ...current,
    isLoading: false,
    isMutating: false,
    error: error instanceof Error ? error.message : '친구 정보를 불러오지 못했어요.',
  };
}

export function buildFriendDataCache(payload: FriendDataPayload, cachedAt = new Date().toISOString()): string {
  return JSON.stringify({
    version: FRIEND_DATA_CACHE_VERSION,
    cachedAt,
    payload,
  } satisfies StoredFriendDataCache);
}

function isFriendState(value: unknown): value is FriendState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<FriendState>;
  return Array.isArray(candidate.friends) && Array.isArray(candidate.requests) && Array.isArray(candidate.suggestions);
}

export function parseFriendDataCache(value: string | null): FriendDataPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredFriendDataCache>;
    const payload = parsed.payload as Partial<FriendDataPayload> | undefined;

    if (parsed.version !== FRIEND_DATA_CACHE_VERSION || !payload) {
      return null;
    }

    if (!isFriendState(payload.friendState) || typeof payload.persisted !== 'boolean') {
      return null;
    }

    return {
      friendState: payload.friendState,
      persisted: payload.persisted,
    };
  } catch {
    return null;
  }
}

export function getFriendDataSnapshotKey(payload: FriendDataPayload): string {
  return JSON.stringify(payload);
}
