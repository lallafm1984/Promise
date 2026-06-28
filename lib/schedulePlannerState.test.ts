import { describe, expect, it } from 'vitest';

import type { CreateManualScheduleInput, DisplayScheduleItem, RecurringTodoItem, TodoItem } from '@/types/promise';
import {
  applyManualScheduleMutations,
  buildRecurringTodoForDate,
  buildSchedulePlannerCache,
  createLocalRecurringTodoItem,
  createLocalManualScheduleItem,
  createLocalTodoItem,
  enqueueSchedulePlannerMutation,
  getTodosForDate,
  parseSchedulePlannerCache,
  toggleLocalTodoItem,
  updateLocalTodoItem,
  type SchedulePlannerMutation,
} from './schedulePlannerState';

const scheduleInput: CreateManualScheduleInput = {
  title: '성수 카페',
  location: '성수',
  startsAt: '2026-06-20T10:00:00.000Z',
  endsAt: '2026-06-20T11:00:00.000Z',
  colorKey: 'sky',
};

const serverSchedule: DisplayScheduleItem = {
  id: 'schedule-server',
  cardId: 'schedule-server',
  title: '서버 일정',
  startsAt: '2026-06-20T12:00:00.000Z',
  endsAt: '2026-06-20T13:00:00.000Z',
  dateLabel: '6월 20일',
  timeLabel: '21:00',
  location: '강남',
  status: 'READY',
  source: 'MANUAL',
  colorKey: 'mint',
};

const serverTodo: TodoItem = {
  id: 'todo-server',
  dateKey: '2026-06-22',
  title: '일반 할일',
  detail: '오늘 중',
  done: false,
  colorKey: 'coral',
};

const recurringTodo: RecurringTodoItem = {
  id: 'recurring-1',
  title: '운동',
  detail: '30분',
  weekdays: [1, 3, 5],
  colorKey: 'mint',
};

describe('schedule planner state', () => {
  it('serializes and restores cached schedule planner data', () => {
    const mutation: SchedulePlannerMutation = {
      id: 'mutation-1',
      kind: 'CREATE_MANUAL_SCHEDULE',
      localId: 'local-schedule-1',
      input: scheduleInput,
      createdAt: '2026-06-20T00:00:00.000Z',
    };
    const cache = buildSchedulePlannerCache({
      manualScheduleItems: [serverSchedule],
      todos: [],
      recurringTodos: [recurringTodo],
      recurringTodoCompletions: [{ recurringTodoId: recurringTodo.id, dateKey: '2026-06-22', done: true }],
      pendingMutations: [mutation],
      persisted: false,
      syncedAt: null,
    });

    expect(parseSchedulePlannerCache(cache)).toEqual({
      manualScheduleItems: [{ ...serverSchedule, status: 'REMINDER_ON' }],
      todos: [],
      recurringTodos: [recurringTodo],
      recurringTodoCompletions: [{ recurringTodoId: recurringTodo.id, dateKey: '2026-06-22', done: true }],
      pendingMutations: [mutation],
      persisted: false,
      syncedAt: null,
    });
    expect(parseSchedulePlannerCache('bad')).toBeNull();
  });

  it('creates recurring todo templates from user input', () => {
    expect(
      createLocalRecurringTodoItem(
        {
          title: '  물 마시기  ',
          detail: '',
          weekdays: [3, 1, 1, 8],
          colorKey: 'lime',
        },
        'recurring-local',
      ),
    ).toEqual({
      id: 'recurring-local',
      title: '물 마시기',
      detail: '오늘 중',
      weekdays: [1, 3],
      colorKey: 'lime',
    });
  });

  it('shows recurring todos only on selected weekdays and keeps completion per date', () => {
    expect(buildRecurringTodoForDate(recurringTodo, '2026-06-22', [])).toMatchObject({
      id: 'recurring-recurring-1-2026-06-22',
      recurringTodoId: recurringTodo.id,
      dateKey: '2026-06-22',
      done: false,
      source: 'RECURRING',
    });
    expect(buildRecurringTodoForDate(recurringTodo, '2026-06-23', [])).toBeNull();

    expect(
      getTodosForDate(
        [serverTodo],
        [recurringTodo],
        [{ recurringTodoId: recurringTodo.id, dateKey: '2026-06-22', done: true }],
        '2026-06-22',
      ),
    ).toEqual([
      serverTodo,
      expect.objectContaining({
        recurringTodoId: recurringTodo.id,
        dateKey: '2026-06-22',
        done: true,
        source: 'RECURRING',
      }),
    ]);
  });

  it('keeps todo order stable when a todo is completed', () => {
    const completedTodo: TodoItem = {
      ...serverTodo,
      id: 'todo-completed',
      title: '먼저 있던 할일',
      done: true,
    };
    const openTodo: TodoItem = {
      ...serverTodo,
      id: 'todo-open',
      title: '나중에 있던 할일',
      done: false,
    };

    expect(getTodosForDate([completedTodo, openTodo], [], [], '2026-06-22')).toEqual([completedTodo, openTodo]);
  });

  it('creates and updates one-time todos locally without changing completion state', () => {
    const todo = createLocalTodoItem(
      {
        dateKey: '2026-06-22',
        title: '  장보기  ',
        detail: '',
        colorKey: 'coral',
      },
      'local-todo-1',
    );
    const toggledTodo = toggleLocalTodoItem(todo);

    expect(todo).toEqual({
      id: 'local-todo-1',
      dateKey: '2026-06-22',
      title: '장보기',
      detail: '오늘 중',
      done: false,
      colorKey: 'coral',
    });
    expect(
      updateLocalTodoItem(toggledTodo, {
        dateKey: '2026-06-23',
        title: '세탁소',
        detail: '퇴근 후',
        colorKey: 'sky',
      }),
    ).toEqual({
      id: 'local-todo-1',
      dateKey: '2026-06-23',
      title: '세탁소',
      detail: '퇴근 후',
      done: true,
      colorKey: 'sky',
    });
  });

  it('creates a local schedule item from user input', () => {
    expect(createLocalManualScheduleItem(scheduleInput, 'local-schedule-1')).toMatchObject({
      id: 'local-schedule-1',
      cardId: 'local-schedule-1',
      title: '성수 카페',
      location: '성수',
      dateLabel: '6월 20일',
      timeLabel: '19:00',
      status: 'REMINDER_ON',
      source: 'MANUAL',
      colorKey: 'sky',
    });
  });

  it('keeps server UTC schedule times in the app schedule timezone without showing the end time', () => {
    expect(
      createLocalManualScheduleItem(
        {
          ...scheduleInput,
          startsAt: '2026-06-24T10:00:00',
          endsAt: '2026-06-24T11:00:00',
        },
        'local-schedule-utc',
      ),
    ).toMatchObject({
      dateLabel: '6월 24일',
      timeLabel: '19:00',
    });
  });

  it('coalesces pending mutations for unsynced local schedules', () => {
    const createMutation: SchedulePlannerMutation = {
      id: 'mutation-create',
      kind: 'CREATE_MANUAL_SCHEDULE',
      localId: 'local-schedule-1',
      input: scheduleInput,
      createdAt: '2026-06-20T00:00:00.000Z',
    };
    const updatedInput = { ...scheduleInput, title: '성수 저녁' };
    const updateMutation: SchedulePlannerMutation = {
      id: 'mutation-update',
      kind: 'UPDATE_MANUAL_SCHEDULE',
      scheduleId: 'local-schedule-1',
      input: updatedInput,
      createdAt: '2026-06-20T00:01:00.000Z',
    };
    const deleteMutation: SchedulePlannerMutation = {
      id: 'mutation-delete',
      kind: 'DELETE_MANUAL_SCHEDULE',
      scheduleId: 'local-schedule-1',
      createdAt: '2026-06-20T00:02:00.000Z',
    };

    const withUpdate = enqueueSchedulePlannerMutation([createMutation], updateMutation);
    expect(withUpdate).toEqual([{ ...createMutation, input: updatedInput }]);

    expect(enqueueSchedulePlannerMutation(withUpdate, deleteMutation)).toEqual([]);
  });

  it('applies pending mutations over the latest server snapshot', () => {
    const createMutation: SchedulePlannerMutation = {
      id: 'mutation-create',
      kind: 'CREATE_MANUAL_SCHEDULE',
      localId: 'local-schedule-1',
      input: scheduleInput,
      createdAt: '2026-06-20T00:00:00.000Z',
    };
    const updateMutation: SchedulePlannerMutation = {
      id: 'mutation-update',
      kind: 'UPDATE_MANUAL_SCHEDULE',
      scheduleId: 'schedule-server',
      input: { ...scheduleInput, title: '서버 일정 수정' },
      createdAt: '2026-06-20T00:01:00.000Z',
    };

    expect(applyManualScheduleMutations([serverSchedule], [createMutation, updateMutation])).toEqual([
      createLocalManualScheduleItem(scheduleInput, 'local-schedule-1'),
      createLocalManualScheduleItem({ ...scheduleInput, title: '서버 일정 수정' }, 'schedule-server'),
    ]);
  });
});
