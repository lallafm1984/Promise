import { describe, expect, it } from 'vitest';

import type { CreateManualScheduleInput, DisplayScheduleItem } from '@/types/promise';
import {
  applyManualScheduleMutations,
  buildSchedulePlannerCache,
  createLocalManualScheduleItem,
  enqueueSchedulePlannerMutation,
  parseSchedulePlannerCache,
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
  timeLabel: '21:00 - 22:00',
  location: '강남',
  status: 'READY',
  source: 'MANUAL',
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
      pendingMutations: [mutation],
      persisted: false,
      syncedAt: null,
    });

    expect(parseSchedulePlannerCache(cache)).toEqual({
      manualScheduleItems: [serverSchedule],
      todos: [],
      pendingMutations: [mutation],
      persisted: false,
      syncedAt: null,
    });
    expect(parseSchedulePlannerCache('bad')).toBeNull();
  });

  it('creates a local schedule item from user input', () => {
    expect(createLocalManualScheduleItem(scheduleInput, 'local-schedule-1')).toMatchObject({
      id: 'local-schedule-1',
      cardId: 'local-schedule-1',
      title: '성수 카페',
      location: '성수',
      source: 'MANUAL',
      colorKey: 'sky',
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
