import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSchedulePlannerCacheKey } from '@/data/localSchedulePlannerStorage';
import {
  buildSchedulePlannerCache,
  createLocalRecurringTodoItem,
  createLocalManualScheduleItem,
  createLocalTodoItem,
  parseSchedulePlannerCache,
  toggleLocalTodoItem,
  updateLocalTodoItem,
  type SchedulePlannerMutation,
} from '@/lib/schedulePlannerState';
import { supabase } from '@/lib/supabase';
import { refreshEnabledNotificationsWithManualScheduleItems } from '@/hooks/useAppNotifications';
import type {
  CreateManualScheduleInput,
  CreateRecurringTodoInput,
  CreateTodoInput,
  DisplayScheduleItem,
  RecurringTodoCompletion,
  RecurringTodoItem,
  TodoItem,
  UpdateTodoInput,
} from '@/types/promise';

interface SchedulePlannerState {
  manualScheduleItems: DisplayScheduleItem[];
  todos: TodoItem[];
  recurringTodos: RecurringTodoItem[];
  recurringTodoCompletions: RecurringTodoCompletion[];
  pendingMutations: SchedulePlannerMutation[];
  isLoading: boolean;
  isMutating: boolean;
  persisted: boolean;
  syncedAt: string | null;
  error: string | null;
}

interface SchedulePlannerActions {
  createManualScheduleItem: (input: CreateManualScheduleInput) => Promise<DisplayScheduleItem>;
  updateManualScheduleItem: (scheduleId: string, input: CreateManualScheduleInput) => Promise<DisplayScheduleItem>;
  deleteManualScheduleItem: (scheduleId: string) => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<TodoItem>;
  updateTodo: (todoId: string, input: UpdateTodoInput) => Promise<TodoItem>;
  deleteTodo: (todoId: string) => Promise<void>;
  toggleTodo: (todoId: string) => Promise<TodoItem>;
  createRecurringTodo: (input: CreateRecurringTodoInput) => RecurringTodoItem;
  deleteRecurringTodo: (recurringTodoId: string) => void;
  toggleRecurringTodoCompletion: (recurringTodoId: string, dateKey: string) => void;
}

type SchedulePlannerContextValue = SchedulePlannerState & SchedulePlannerActions;

const SchedulePlannerContext = createContext<SchedulePlannerContextValue | null>(null);

const initialState: SchedulePlannerState = {
  manualScheduleItems: [],
  todos: [],
  recurringTodos: [],
  recurringTodoCompletions: [],
  pendingMutations: [],
  isLoading: true,
  isMutating: false,
  persisted: false,
  syncedAt: null,
  error: null,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '일정 데이터를 저장하지 못했어요.';
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toCachePayload(state: SchedulePlannerState) {
  return {
    manualScheduleItems: state.manualScheduleItems,
    todos: state.todos,
    recurringTodos: state.recurringTodos,
    recurringTodoCompletions: state.recurringTodoCompletions,
    pendingMutations: state.pendingMutations,
    persisted: state.persisted,
    syncedAt: state.syncedAt,
  };
}

function useSchedulePlannerController(): SchedulePlannerContextValue {
  const [state, setState] = useState<SchedulePlannerState>(initialState);
  const stateRef = useRef(initialState);
  const activeCacheKeyRef = useRef<string | null>(null);

  const commitState = useCallback((nextState: SchedulePlannerState) => {
    stateRef.current = nextState;
    setState(nextState);

    if (activeCacheKeyRef.current) {
      void AsyncStorage.setItem(activeCacheKeyRef.current, buildSchedulePlannerCache(toCachePayload(nextState)));
    }
  }, []);

  const updateState = useCallback(
    (updater: (current: SchedulePlannerState) => SchedulePlannerState) => {
      const nextState = updater(stateRef.current);
      commitState(nextState);
      return nextState;
    },
    [commitState],
  );

  const markLocalScheduleReady = useCallback(() => {
    const cacheKey = activeCacheKeyRef.current;

    if (!cacheKey) {
      return;
    }

    commitState({
      ...stateRef.current,
      pendingMutations: [],
      isLoading: false,
      isMutating: false,
      persisted: false,
      syncedAt: stateRef.current.syncedAt ?? new Date().toISOString(),
      error: null,
    });
  }, [commitState]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const cacheKey = await getSchedulePlannerCacheKey();

        if (!isMounted) {
          return;
        }

        if (activeCacheKeyRef.current !== cacheKey) {
          activeCacheKeyRef.current = cacheKey;
          stateRef.current = initialState;
          setState(initialState);
        }

        const cachedPayload = parseSchedulePlannerCache(await AsyncStorage.getItem(cacheKey));

        if (activeCacheKeyRef.current !== cacheKey) {
          return;
        }

        if (cachedPayload && isMounted) {
          commitState({
            manualScheduleItems: cachedPayload.manualScheduleItems,
            todos: cachedPayload.todos,
            recurringTodos: cachedPayload.recurringTodos,
            recurringTodoCompletions: cachedPayload.recurringTodoCompletions,
            pendingMutations: [],
            isLoading: false,
            isMutating: false,
            persisted: false,
            syncedAt: cachedPayload.syncedAt,
            error: null,
          });
        }

        markLocalScheduleReady();
      } catch (error) {
        if (isMounted) {
          commitState({
            ...stateRef.current,
            isLoading: false,
            isMutating: false,
            error: getErrorMessage(error),
          });
        }
      }
    }

    load();
    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange(() => {
        void load();
      }) ?? { data: { subscription: null } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [commitState, markLocalScheduleReady]);

  const createManualScheduleItem = useCallback(async (input: CreateManualScheduleInput) => {
    const localId = createLocalId('local-schedule');
    const item = createLocalManualScheduleItem(input, localId);

    const nextState = updateState((current) => ({
      ...current,
      manualScheduleItems: [item, ...current.manualScheduleItems.filter((currentItem) => currentItem.id !== item.id)],
      pendingMutations: [],
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));
    void refreshEnabledNotificationsWithManualScheduleItems(nextState.manualScheduleItems);

    return item;
  }, [updateState]);

  const updateManualScheduleItem = useCallback(async (scheduleId: string, input: CreateManualScheduleInput) => {
    const item = createLocalManualScheduleItem(input, scheduleId);
    const existingItem = stateRef.current.manualScheduleItems.find((currentItem) => currentItem.id === scheduleId);

    if (!existingItem) {
      throw new Error('일정을 찾지 못했어요.');
    }

    const nextState = updateState((current) => ({
      ...current,
      manualScheduleItems: current.manualScheduleItems.map((currentItem) =>
        currentItem.id === item.id ? item : currentItem,
      ),
      pendingMutations: [],
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));
    void refreshEnabledNotificationsWithManualScheduleItems(nextState.manualScheduleItems);

    return item;
  }, [updateState]);

  const deleteManualScheduleItem = useCallback(async (scheduleId: string) => {
    const existingItem = stateRef.current.manualScheduleItems.find((item) => item.id === scheduleId);

    if (!existingItem) {
      throw new Error('일정을 찾지 못했어요.');
    }

    const nextState = updateState((current) => ({
      ...current,
      manualScheduleItems: current.manualScheduleItems.filter((item) => item.id !== scheduleId),
      pendingMutations: [],
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));
    void refreshEnabledNotificationsWithManualScheduleItems(nextState.manualScheduleItems);
  }, [updateState]);

  const createTodo = useCallback(async (input: CreateTodoInput) => {
    const todo = createLocalTodoItem(input, createLocalId('local-todo'));

    updateState((current) => ({
      ...current,
      todos: [todo, ...current.todos.filter((currentTodo) => currentTodo.id !== todo.id)],
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));

    return todo;
  }, [updateState]);

  const toggleTodo = useCallback(async (todoId: string) => {
    const todo = stateRef.current.todos.find((currentTodo) => currentTodo.id === todoId);

    if (!todo) {
      throw new Error('할일을 찾지 못했어요.');
    }

    const toggledTodo = toggleLocalTodoItem(todo);

    updateState((current) => ({
      ...current,
      todos: current.todos.map((currentTodo) => (currentTodo.id === todoId ? toggledTodo : currentTodo)),
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));

    return toggledTodo;
  }, [updateState]);

  const updateTodo = useCallback(async (todoId: string, input: UpdateTodoInput) => {
    const todo = stateRef.current.todos.find((currentTodo) => currentTodo.id === todoId);

    if (!todo) {
      throw new Error('할일을 찾지 못했어요.');
    }

    const updatedTodo = updateLocalTodoItem(todo, input);

    updateState((current) => ({
      ...current,
      todos: current.todos.map((currentTodo) => (currentTodo.id === todoId ? updatedTodo : currentTodo)),
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));

    return updatedTodo;
  }, [updateState]);

  const deleteTodo = useCallback(async (todoId: string) => {
    const todo = stateRef.current.todos.find((currentTodo) => currentTodo.id === todoId);

    if (!todo) {
      throw new Error('할일을 찾지 못했어요.');
    }

    updateState((current) => ({
      ...current,
      todos: current.todos.filter((currentTodo) => currentTodo.id !== todoId),
      isMutating: false,
      persisted: false,
      syncedAt: new Date().toISOString(),
      error: null,
    }));
  }, [updateState]);

  const createRecurringTodo = useCallback((input: CreateRecurringTodoInput) => {
    const recurringTodo = createLocalRecurringTodoItem(input, createLocalId('local-recurring-todo'));

    updateState((current) => ({
      ...current,
      recurringTodos: [recurringTodo, ...current.recurringTodos.filter((todo) => todo.id !== recurringTodo.id)],
      isMutating: false,
      error: null,
    }));

    return recurringTodo;
  }, [updateState]);

  const deleteRecurringTodo = useCallback((recurringTodoId: string) => {
    updateState((current) => ({
      ...current,
      recurringTodos: current.recurringTodos.filter((todo) => todo.id !== recurringTodoId),
      recurringTodoCompletions: current.recurringTodoCompletions.filter(
        (completion) => completion.recurringTodoId !== recurringTodoId,
      ),
      isMutating: false,
      error: null,
    }));
  }, [updateState]);

  const toggleRecurringTodoCompletion = useCallback((recurringTodoId: string, dateKey: string) => {
    updateState((current) => {
      const existingCompletion = current.recurringTodoCompletions.find(
        (completion) => completion.recurringTodoId === recurringTodoId && completion.dateKey === dateKey,
      );
      const nextDone = !(existingCompletion?.done ?? false);
      const otherCompletions = current.recurringTodoCompletions.filter(
        (completion) => completion.recurringTodoId !== recurringTodoId || completion.dateKey !== dateKey,
      );

      return {
        ...current,
        recurringTodoCompletions: nextDone
          ? [...otherCompletions, { recurringTodoId, dateKey, done: true }]
          : otherCompletions,
        isMutating: false,
        error: null,
      };
    });
  }, [updateState]);

  return {
    ...state,
    createManualScheduleItem,
    updateManualScheduleItem,
    deleteManualScheduleItem,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    createRecurringTodo,
    deleteRecurringTodo,
    toggleRecurringTodoCompletion,
  };
}

export function SchedulePlannerProvider({ children }: { children: ReactNode }) {
  const value = useSchedulePlannerController();

  return createElement(SchedulePlannerContext.Provider, { value }, children);
}

export function useSchedulePlanner() {
  const value = useContext(SchedulePlannerContext);

  if (!value) {
    throw new Error('useSchedulePlanner must be used within SchedulePlannerProvider.');
  }

  return value;
}
