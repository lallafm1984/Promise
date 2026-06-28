import { buildScheduleLabels, getCandidateEndsAt } from '@/lib/cardMenu';
import type {
  CreateManualScheduleInput,
  CreateRecurringTodoInput,
  CreateTodoInput,
  DisplayScheduleItem,
  RecurringTodoCompletion,
  RecurringTodoItem,
  TodoItem,
  UpdateTodoInput,
  WeekdayIndex,
} from '@/types/promise';

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
  recurringTodos: RecurringTodoItem[];
  recurringTodoCompletions: RecurringTodoCompletion[];
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

function cleanOptionalText(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function isWeekdayIndex(value: number): value is WeekdayIndex {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function normalizeWeekdays(weekdays: number[]): WeekdayIndex[] {
  return Array.from(new Set(weekdays.filter(isWeekdayIndex))).sort((left, right) => left - right);
}

function getWeekdayFromDateKey(dateKey: string): WeekdayIndex | null {
  const [year, month, day] = dateKey.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getDay() as WeekdayIndex;
}

function getRecurringCompletion(
  completions: RecurringTodoCompletion[],
  recurringTodoId: string,
  dateKey: string,
) {
  return completions.find((completion) => completion.recurringTodoId === recurringTodoId && completion.dateKey === dateKey);
}

export function createLocalManualScheduleItem(
  input: CreateManualScheduleInput,
  id: string,
): DisplayScheduleItem {
  const startsAt = input.startsAt;
  const endsAt = input.endsAt || getCandidateEndsAt(startsAt);
  const scheduleLabels = buildScheduleLabels(startsAt, endsAt) ?? {
    dateLabel: '날짜 미정',
    timeLabel: '시간 미정',
  };

  return {
    id,
    cardId: id,
    title: input.title.trim(),
    startsAt,
    endsAt,
    dateLabel: scheduleLabels.dateLabel,
    timeLabel: scheduleLabels.timeLabel,
    location: input.location.trim() || '장소 미정',
    status: 'REMINDER_ON',
    source: 'MANUAL',
    colorKey: input.colorKey,
  };
}

export function createLocalRecurringTodoItem(input: CreateRecurringTodoInput, id: string): RecurringTodoItem {
  return {
    id,
    title: input.title.trim(),
    detail: cleanOptionalText(input.detail, '오늘 중'),
    weekdays: normalizeWeekdays(input.weekdays),
    colorKey: input.colorKey,
  };
}

export function createLocalTodoItem(input: CreateTodoInput, id: string): TodoItem {
  return {
    id,
    dateKey: input.dateKey,
    title: input.title.trim(),
    detail: cleanOptionalText(input.detail, '오늘 중'),
    done: false,
    colorKey: input.colorKey,
  };
}

export function updateLocalTodoItem(todo: TodoItem, input: UpdateTodoInput): TodoItem {
  return {
    ...todo,
    dateKey: input.dateKey,
    title: input.title.trim(),
    detail: cleanOptionalText(input.detail, '오늘 중'),
    colorKey: input.colorKey,
  };
}

export function toggleLocalTodoItem(todo: TodoItem): TodoItem {
  return {
    ...todo,
    done: !todo.done,
  };
}

export function buildRecurringTodoForDate(
  recurringTodo: RecurringTodoItem,
  dateKey: string,
  completions: RecurringTodoCompletion[],
): TodoItem | null {
  const weekday = getWeekdayFromDateKey(dateKey);

  if (weekday === null || !recurringTodo.weekdays.includes(weekday)) {
    return null;
  }

  const completion = getRecurringCompletion(completions, recurringTodo.id, dateKey);

  return {
    id: `recurring-${recurringTodo.id}-${dateKey}`,
    dateKey,
    title: recurringTodo.title,
    detail: recurringTodo.detail,
    done: completion?.done ?? false,
    colorKey: recurringTodo.colorKey,
    source: 'RECURRING',
    recurringTodoId: recurringTodo.id,
  };
}

export function getTodosForDate(
  todos: TodoItem[],
  recurringTodos: RecurringTodoItem[],
  recurringTodoCompletions: RecurringTodoCompletion[],
  dateKey: string,
) {
  const oneTimeTodos = todos.filter((todo) => todo.dateKey === dateKey);
  const generatedTodos = recurringTodos
    .map((recurringTodo) => buildRecurringTodoForDate(recurringTodo, dateKey, recurringTodoCompletions))
    .filter((todo): todo is TodoItem => Boolean(todo));

  return [...oneTimeTodos, ...generatedTodos];
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

    const {
      manualScheduleItems,
      todos,
      recurringTodos = [],
      recurringTodoCompletions = [],
      pendingMutations,
      persisted,
      syncedAt,
    } = parsed.payload;

    if (
      !Array.isArray(manualScheduleItems) ||
      !Array.isArray(todos) ||
      !Array.isArray(recurringTodos) ||
      !Array.isArray(recurringTodoCompletions) ||
      !Array.isArray(pendingMutations) ||
      !pendingMutations.every(isSchedulePlannerMutation) ||
      typeof persisted !== 'boolean'
    ) {
      return null;
    }

    return {
      manualScheduleItems: manualScheduleItems.map((item) => ({
        ...item,
        status: 'REMINDER_ON',
      })),
      todos,
      recurringTodos,
      recurringTodoCompletions,
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
