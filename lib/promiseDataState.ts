import type { HostProfile, PromiseCard, ScheduleItem } from '@/types/promise';

export interface PromiseDataState {
  profile: HostProfile | null;
  recentCards: PromiseCard[];
  scheduleItems: ScheduleItem[];
  isLoading: boolean;
  persisted: boolean;
  syncVersion: string | null;
  error: string | null;
}

export type PromiseDataPayload = Pick<
  PromiseDataState,
  'profile' | 'recentCards' | 'scheduleItems' | 'persisted' | 'syncVersion'
>;

interface PromiseDataReloadDecisionInput {
  force?: boolean;
  hasSnapshot: boolean;
  lastLoadedAtMs: number | null;
  minIntervalMs: number;
  nowMs: number;
}

interface StoredPromiseDataCache {
  version: 1;
  cachedAt: string;
  payload: PromiseDataPayload;
}

export const PROMISE_DATA_CACHE_VERSION = 1;

let promiseDataRefreshChannelSequence = 0;

export function createPromiseDataRefreshChannelName() {
  promiseDataRefreshChannelSequence += 1;
  return `promise-data-refresh-${promiseDataRefreshChannelSequence}`;
}

export function shouldReloadPromiseDataForAppState(state: string) {
  return state === 'active';
}

export function shouldSkipPromiseDataReload(input: PromiseDataReloadDecisionInput) {
  if (input.force || !input.hasSnapshot || input.lastLoadedAtMs === null) {
    return false;
  }

  return input.nowMs - input.lastLoadedAtMs < input.minIntervalMs;
}

export function getPromiseDataLoadErrorState(_current: PromiseDataState, error: unknown): PromiseDataState {
  return {
    profile: null,
    recentCards: [],
    scheduleItems: [],
    isLoading: false,
    persisted: false,
    syncVersion: null,
    error: error instanceof Error ? error.message : '데이터를 불러오지 못했어요.',
  };
}

export function buildPromiseDataCache(payload: PromiseDataPayload, cachedAt = new Date().toISOString()): string {
  return JSON.stringify({
    version: PROMISE_DATA_CACHE_VERSION,
    cachedAt,
    payload,
  } satisfies StoredPromiseDataCache);
}

export function parsePromiseDataCache(value: string | null): PromiseDataPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredPromiseDataCache>;

    if (parsed.version !== PROMISE_DATA_CACHE_VERSION || !parsed.payload) {
      return null;
    }

    const { profile, recentCards, scheduleItems, persisted, syncVersion } = parsed.payload;

    if (!Array.isArray(recentCards) || !Array.isArray(scheduleItems) || typeof persisted !== 'boolean') {
      return null;
    }

    return {
      profile: profile ?? null,
      recentCards,
      scheduleItems,
      persisted,
      syncVersion: typeof syncVersion === 'string' ? syncVersion : null,
    };
  } catch {
    return null;
  }
}

export function getPromiseDataSnapshotKey(payload: PromiseDataPayload): string {
  return JSON.stringify(payload);
}
