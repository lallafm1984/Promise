import { buildScheduleLabels, getCandidateEndsAt } from '@/lib/cardMenu';
import { supabase } from '@/lib/supabase';
import { toDateKey } from '@/lib/scheduleCalendar';
import type {
  CreateManualScheduleInput,
  CreateTodoInput,
  DisplayScheduleItem,
  ScheduleColorKey,
  SchedulePlannerRepository,
  TodoItem,
} from '@/types/promise';

import { assertSupabase, ensureProfile, getAuthenticatedUser } from './supabaseProfile';

interface AppointmentRow {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string;
  color_key: string | null;
}

interface TodoRow {
  id: string;
  date_key: string;
  title: string;
  detail: string;
  done: boolean;
  color_key: string | null;
}

const scheduleColorKeys: ScheduleColorKey[] = ['coral', 'mint', 'lime', 'sky', 'amber'];
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export async function isSupabaseScheduleRepositoryAvailable() {
  if (!supabase) {
    return false;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

function cleanRequiredText(value: string, message: string, maxLength: number) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(message);
  }

  return trimmed.slice(0, maxLength);
}

function cleanOptionalText(value: string, fallback: string, maxLength: number) {
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function normalizeColorKey(value: string | null | undefined, fallback: ScheduleColorKey): ScheduleColorKey {
  return scheduleColorKeys.includes(value as ScheduleColorKey) ? (value as ScheduleColorKey) : fallback;
}

function normalizeScheduleTimes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    throw new Error('일정 시간을 다시 선택해주세요.');
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return {
      startsAt: start.toISOString(),
      endsAt: getCandidateEndsAt(start.toISOString()),
    };
  }

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

function mapAppointment(row: AppointmentRow): DisplayScheduleItem {
  const scheduleLabels = buildScheduleLabels(row.starts_at, row.ends_at) ?? {
    dateLabel: '날짜 미정',
    timeLabel: '시간 미정',
  };

  return {
    id: row.id,
    cardId: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dateLabel: scheduleLabels.dateLabel,
    timeLabel: scheduleLabels.timeLabel,
    location: row.location || '장소 미정',
    status: 'READY',
    source: 'MANUAL',
    colorKey: normalizeColorKey(row.color_key, 'sky'),
  };
}

function mapTodo(row: TodoRow): TodoItem {
  return {
    id: row.id,
    dateKey: row.date_key,
    title: row.title,
    detail: row.detail || '오늘 중',
    done: row.done,
    colorKey: normalizeColorKey(row.color_key, 'coral'),
  };
}

function cleanManualScheduleInput(input: CreateManualScheduleInput) {
  const times = normalizeScheduleTimes(input.startsAt, input.endsAt);

  return {
    title: cleanRequiredText(input.title, '일정 이름을 입력해주세요.', 140),
    location: cleanOptionalText(input.location, '장소 미정', 200),
    starts_at: times.startsAt,
    ends_at: times.endsAt,
    color_key: normalizeColorKey(input.colorKey, 'sky'),
  };
}

function cleanTodoInput(input: CreateTodoInput) {
  if (!dateKeyPattern.test(input.dateKey) || Number.isNaN(new Date(`${input.dateKey}T00:00:00`).getTime())) {
    throw new Error('할일 날짜를 다시 선택해주세요.');
  }

  return {
    date_key: toDateKey(new Date(`${input.dateKey}T00:00:00`)),
    title: cleanRequiredText(input.title, '할일을 입력해주세요.', 140),
    detail: cleanOptionalText(input.detail, '오늘 중', 300),
    color_key: normalizeColorKey(input.colorKey, 'coral'),
  };
}

export const supabaseScheduleRepository: SchedulePlannerRepository = {
  async listManualScheduleItems() {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const { data, error } = await client
      .from('appointments')
      .select('id, title, location, starts_at, ends_at, color_key')
      .eq('owner_id', user.id)
      .is('card_id', null)
      .is('deleted_at', null)
      .order('starts_at', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as AppointmentRow[]).map(mapAppointment);
  },

  async createManualScheduleItem(input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    await ensureProfile(user);
    const values = cleanManualScheduleInput(input);
    const { data, error } = await client
      .from('appointments')
      .insert({
        owner_id: user.id,
        card_id: null,
        candidate_id: null,
        ...values,
      })
      .select('id, title, location, starts_at, ends_at, color_key')
      .single();

    if (error) {
      throw error;
    }

    return mapAppointment(data as AppointmentRow);
  },

  async updateManualScheduleItem(scheduleId, input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const values = cleanManualScheduleInput(input);
    const { data, error } = await client
      .from('appointments')
      .update(values)
      .eq('id', scheduleId)
      .eq('owner_id', user.id)
      .is('card_id', null)
      .is('deleted_at', null)
      .select('id, title, location, starts_at, ends_at, color_key')
      .single();

    if (error) {
      throw error;
    }

    return mapAppointment(data as AppointmentRow);
  },

  async deleteManualScheduleItem(scheduleId) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const { error } = await client
      .from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .eq('owner_id', user.id)
      .is('card_id', null)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }
  },

  async listTodos() {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const { data, error } = await client
      .from('todos')
      .select('id, date_key, title, detail, done, color_key')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('date_key', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as TodoRow[]).map(mapTodo);
  },

  async createTodo(input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    await ensureProfile(user);
    const values = cleanTodoInput(input);
    const { data, error } = await client
      .from('todos')
      .insert({
        owner_id: user.id,
        ...values,
      })
      .select('id, date_key, title, detail, done, color_key')
      .single();

    if (error) {
      throw error;
    }

    return mapTodo(data as TodoRow);
  },

  async updateTodo(todoId, input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const values = cleanTodoInput(input);
    const { data, error } = await client
      .from('todos')
      .update(values)
      .eq('id', todoId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .select('id, date_key, title, detail, done, color_key')
      .single();

    if (error) {
      throw error;
    }

    return mapTodo(data as TodoRow);
  },

  async deleteTodo(todoId) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const { error } = await client
      .from('todos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', todoId)
      .eq('owner_id', user.id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }
  },

  async toggleTodo(todoId) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const { data: currentTodo, error: currentError } = await client
      .from('todos')
      .select('id, done')
      .eq('id', todoId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();

    if (currentError) {
      throw currentError;
    }

    const { data, error } = await client
      .from('todos')
      .update({ done: !currentTodo.done })
      .eq('id', todoId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .select('id, date_key, title, detail, done, color_key')
      .single();

    if (error) {
      throw error;
    }

    return mapTodo(data as TodoRow);
  },
};
