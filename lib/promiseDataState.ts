import type { HostProfile, PromiseCard, ScheduleItem } from '@/types/promise';

export interface PromiseDataState {
  profile: HostProfile | null;
  recentCards: PromiseCard[];
  scheduleItems: ScheduleItem[];
  isLoading: boolean;
  persisted: boolean;
  error: string | null;
}

let promiseDataRefreshChannelSequence = 0;

export function createPromiseDataRefreshChannelName() {
  promiseDataRefreshChannelSequence += 1;
  return `promise-data-refresh-${promiseDataRefreshChannelSequence}`;
}

export function getPromiseDataLoadErrorState(_current: PromiseDataState, error: unknown): PromiseDataState {
  return {
    profile: null,
    recentCards: [],
    scheduleItems: [],
    isLoading: false,
    persisted: false,
    error: error instanceof Error ? error.message : '데이터를 불러오지 못했어요.',
  };
}
