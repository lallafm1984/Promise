import { getCandidateEndsAt } from '@/lib/cardMenu';
import { formatSelectedDate } from '@/lib/scheduleCalendar';
import type { CreateManualScheduleInput, DisplayScheduleItem, TodoItem } from '@/types/promise';

export type SchedulePlannerMutation =
  | {
      id: string;
      kind: 'CREATE_MANUAL_SCHEDULE';
      localId: string;
      input: CreateManualScheduleInput;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'UPDATE_MANUAL_SCHEDULE';
      scheduleId: string;
      input: CreateManualScheduleInput;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'DELETE_MANUAL_SCHEDULE';
      scheduleId: string;
      createdAt: string;
    };

export interface SchedulePlannerCachePayload {
  manualScheduleItems: DisplayScheduleItem[];
  todos: TodoItem[];
  pendingMutations: SchedulePlannerMutation[];
  persisted: boolean;
  syncedAt: string | null;
}

interface StoredSchedulePlannerCache {
  version: 1;
  cachedAt: string;
  payload: SchedulePlannerCachePayload;
}

const SCHEDULE_PLANNER_CACHE_VERSION = 1;

function padTwo(value: number) {
  return String(value).padStart(2, '0');
}

function formatScheduleTimeLabel(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime())) {
    return '시간 미정';
  }

  if (Number.isNaN(end.getTime())) {
    return `${padTwo(start.getHours())}:${padTwo(start.getMinutes())}`;
  }

  return `${padTwo(start.getHours())}:${padTwo(start.getMinutes())} - ${padTwo(end.getHours())}:${padTwo(
    end.getMinutes(),
  )}`;
}

function isSchedulePlannerMutation(value: unknown): value is SchedulePlannerMutation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const mutation = value as Record<string, unknown>;

  return (
    typeof mutation.id === 'string' &&
    typeof mutation.kind === 'string' &&
    typeof mutation.createdAt === 'string' &&
    (mutation.kind === 'DELETE_MANUAL_SCHEDULE' || typeof mutation.input === 'object')
  );
}

function getMutationScheduleId(mutation: SchedulePlannerMutation) {
  return mutation.kind === 'CREATE_MANUAL_SCHEDULE' ? mutation.localId : mutation.scheduleId;
}

export function createLocalManualScheduleItem(
  input: CreateManualScheduleInput,
  id: string,
): DisplayScheduleItem {
  const startsAt = input.startsAt;
  const endsAt = input.endsAt || getCandidateEndsAt(startsAt);
  const startsAtDate = new Date(startsAt);

  return {
    id,
    cardId: id,
    title: input.title.trim(),
    startsAt,
    endsAt,
    dateLabel: Number.isNaN(startsAtDate.getTime()) ? '날짜 미정' : formatSelectedDate(startsAtDate),
    timeLabel: formatScheduleTimeLabel(startsAt, endsAt),
    location: input.location.trim() || '장소 미정',
    status: 'READY',
    source: 'MANUAL',
    colorKey: input.colorKey,
  };
}

export function buildSchedulePlannerCache(
  payload: SchedulePlannerCachePayload,
  cachedAt = new Date().toISOString(),
) {
  return JSON.stringify({
    version: SCHEDULE_PLANNER_CACHE_VERSION,
    cachedAt,
    payload,
  } satisfies StoredSchedulePlannerCache);
}

export function parseSchedulePlannerCache(value: string | null): SchedulePlannerCachePayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredSchedulePlannerCache>;

    if (parsed.version !== SCHEDULE_PLANNER_CACHE_VERSION || !parsed.payload) {
      return null;
    }

    const { manualScheduleItems, todos, pendingMutations, persisted, syncedAt } = parsed.payload;

    if (
      !Array.isArray(manualScheduleItems) ||
      !Array.isArray(todos) ||
      !Array.isArray(pendingMutations) ||
      !pendingMutations.every(isSchedulePlannerMutation) ||
      typeof persisted !== 'boolean'
    ) {
      return null;
    }

    return {
      manualScheduleItems,
      todos,
      pendingMutations,
      persisted,
      syncedAt: typeof syncedAt === 'string' ? syncedAt : null,
    };
  } catch {
    return null;
  }
}

export function enqueueSchedulePlannerMutation(
  mutations: SchedulePlannerMutation[],
  nextMutation: SchedulePlannerMutation,
): SchedulePlannerMutation[] {
  const scheduleId = getMutationScheduleId(nextMutation);
  const createMutation = mutations.find(
    (mutation) => mutation.kind === 'CREATE_MANUAL_SCHEDULE' && mutation.localId === scheduleId,
  );

  if (nextMutation.kind === 'UPDATE_MANUAL_SCHEDULE' && createMutation?.kind === 'CREATE_MANUAL_SCHEDULE') {
    return mutations.map((mutation) =>
      mutation.id === createMutation.id ? { ...mutation, input: nextMutation.input } : mutation,
    );
  }

  if (nextMutation.kind === 'DELETE_MANUAL_SCHEDULE' && createMutation) {
    return mutations.filter((mutation) => getMutationScheduleId(mutation) !== scheduleId);
  }

  const withoutOlderMutationForSchedule = mutations.filter((mutation) => {
    if (mutation.kind === 'CREATE_MANUAL_SCHEDULE') {
      return true;
    }

    return getMutationScheduleId(mutation) !== scheduleId;
  });

  return [...withoutOlderMutationForSchedule, nextMutation];
}

export function applyManualScheduleMutations(
  manualScheduleItems: DisplayScheduleItem[],
  pendingMutations: SchedulePlannerMutation[],
) {
  return pendingMutations.reduce<DisplayScheduleItem[]>((items, mutation) => {
    switch (mutation.kind) {
      case 'CREATE_MANUAL_SCHEDULE': {
        const item = createLocalManualScheduleItem(mutation.input, mutation.localId);
        return [item, ...items.filter((currentItem) => currentItem.id !== item.id)];
      }
      case 'UPDATE_MANUAL_SCHEDULE': {
        const item = createLocalManualScheduleItem(mutation.input, mutation.scheduleId);
        return items.map((currentItem) => (currentItem.id === mutation.scheduleId ? item : currentItem));
      }
      case 'DELETE_MANUAL_SCHEDULE':
        return items.filter((currentItem) => currentItem.id !== mutation.scheduleId);
    }
  }, manualScheduleItems);
}
