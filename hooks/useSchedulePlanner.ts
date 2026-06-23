import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActiveScheduleRepository } from '@/data/scheduleRepository';
import { getAccountScopedStorageKey } from '@/lib/accountScopedStorage';
import {
  applyManualScheduleMutations,
  buildSchedulePlannerCache,
  createLocalRecurringTodoItem,
  createLocalManualScheduleItem,
  enqueueSchedulePlannerMutation,
  parseSchedulePlannerCache,
  type SchedulePlannerMutation,
} from '@/lib/schedulePlannerState';
import { supabase } from '@/lib/supabase';
import type {
  CreateManualScheduleInput,
  CreateRecurringTodoInput,
  CreateTodoInput,
  DisplayScheduleItem,
  RecurringTodoCompletion,
  RecurringTodoItem,
  SchedulePlannerRepository,
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

const SCHEDULE_PLANNER_CACHE_PREFIX = '@whenbollae/schedule-planner-cache/v1';

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

async function getSchedulePlannerCacheKey() {
  const authSession = await supabase?.auth.getSession();

  return getAccountScopedStorageKey(SCHEDULE_PLANNER_CACHE_PREFIX, authSession?.data.session?.user.id ?? null);
}

interface FlushPendingMutationsResult {
  remainingMutations: SchedulePlannerMutation[];
  flushedMutationIds: string[];
  localToRemoteScheduleIds: Map<string, string>;
}

async function flushPendingMutations(repository: SchedulePlannerRepository, pendingMutations: SchedulePlannerMutation[]) {
  const localToRemoteScheduleIds = new Map<string, string>();
  const flushedMutationIds: string[] = [];

  for (let index = 0; index < pendingMutations.length; index += 1) {
    const mutation = pendingMutations[index];

    try {
      switch (mutation.kind) {
        case 'CREATE_MANUAL_SCHEDULE': {
          const item = await repository.createManualScheduleItem(mutation.input);
          localToRemoteScheduleIds.set(mutation.localId, item.id);
          break;
        }
        case 'UPDATE_MANUAL_SCHEDULE': {
          const scheduleId = localToRemoteScheduleIds.get(mutation.scheduleId) ?? mutation.scheduleId;
          await repository.updateManualScheduleItem(scheduleId, mutation.input);
          break;
        }
        case 'DELETE_MANUAL_SCHEDULE': {
          const scheduleId = localToRemoteScheduleIds.get(mutation.scheduleId) ?? mutation.scheduleId;
          await repository.deleteManualScheduleItem(scheduleId);
          break;
        }
      }
      flushedMutationIds.push(mutation.id);
    } catch {
      return {
        remainingMutations: pendingMutations.slice(index),
        flushedMutationIds,
        localToRemoteScheduleIds,
      } satisfies FlushPendingMutationsResult;
    }
  }

  return {
    remainingMutations: [],
    flushedMutationIds,
    localToRemoteScheduleIds,
  } satisfies FlushPendingMutationsResult;
}

function remapScheduleMutationIds(
  mutation: SchedulePlannerMutation,
  localToRemoteScheduleIds: Map<string, string>,
): SchedulePlannerMutation {
  if (mutation.kind === 'CREATE_MANUAL_SCHEDULE') {
    return mutation;
  }

  const scheduleId = localToRemoteScheduleIds.get(mutation.scheduleId);

  return scheduleId ? { ...mutation, scheduleId } : mutation;
}

function mergePendingMutationsAfterFlush(
  latestMutations: SchedulePlannerMutation[],
  originalMutations: SchedulePlannerMutation[],
  flushResult: FlushPendingMutationsResult,
) {
  if (latestMutations === originalMutations) {
    return flushResult.remainingMutations;
  }

  const flushedMutationIdSet = new Set(flushResult.flushedMutationIds);

  return latestMutations
    .filter((mutation) => !flushedMutationIdSet.has(mutation.id))
    .map((mutation) => remapScheduleMutationIds(mutation, flushResult.localToRemoteScheduleIds));
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

  const syncWithRepository = useCallback(async () => {
    const cacheKey = activeCacheKeyRef.current;

    if (!cacheKey) {
      return;
    }

    const commitIfCurrentAccount = (nextState: SchedulePlannerState) => {
      if (activeCacheKeyRef.current === cacheKey) {
        commitState(nextState);
      }
    };

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const current = stateRef.current;
      const flushResult =
        persisted && current.pendingMutations.length > 0
          ? await flushPendingMutations(repository, current.pendingMutations)
          : ({
              remainingMutations: current.pendingMutations,
              flushedMutationIds: [],
              localToRemoteScheduleIds: new Map<string, string>(),
            } satisfies FlushPendingMutationsResult);
      const [serverManualScheduleItems, todos] = await Promise.all([
        repository.listManualScheduleItems(),
        repository.listTodos(),
      ]);
      const pendingMutations = mergePendingMutationsAfterFlush(
        stateRef.current.pendingMutations,
        current.pendingMutations,
        flushResult,
      );
      const manualScheduleItems = applyManualScheduleMutations(serverManualScheduleItems, pendingMutations);

      commitIfCurrentAccount({
        ...stateRef.current,
        manualScheduleItems,
        todos,
        recurringTodos: stateRef.current.recurringTodos,
        recurringTodoCompletions: stateRef.current.recurringTodoCompletions,
        pendingMutations,
        isLoading: false,
        isMutating: false,
        persisted: persisted && pendingMutations.length === 0,
        syncedAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      commitIfCurrentAccount({
        ...stateRef.current,
        isLoading: false,
        isMutating: false,
        error: getErrorMessage(error),
      });
    }
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
            pendingMutations: cachedPayload.pendingMutations,
            isLoading: false,
            isMutating: false,
            persisted: cachedPayload.persisted,
            syncedAt: cachedPayload.syncedAt,
            error: null,
          });
        }

        await syncWithRepository();
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
  }, []);

  const createManualScheduleItem = useCallback(async (input: CreateManualScheduleInput) => {
    const localId = createLocalId('local-schedule');
    const item = createLocalManualScheduleItem(input, localId);
    const mutation: SchedulePlannerMutation = {
      id: createLocalId('mutation'),
      kind: 'CREATE_MANUAL_SCHEDULE',
      localId,
      input,
      createdAt: new Date().toISOString(),
    };

    updateState((current) => ({
      ...current,
      manualScheduleItems: [item, ...current.manualScheduleItems.filter((currentItem) => currentItem.id !== item.id)],
      pendingMutations: enqueueSchedulePlannerMutation(current.pendingMutations, mutation),
      isMutating: false,
      persisted: false,
      error: null,
    }));
    void syncWithRepository();

    return item;
  }, [syncWithRepository, updateState]);

  const updateManualScheduleItem = useCallback(async (scheduleId: string, input: CreateManualScheduleInput) => {
    const item = createLocalManualScheduleItem(input, scheduleId);
    const mutation: SchedulePlannerMutation = {
      id: createLocalId('mutation'),
      kind: 'UPDATE_MANUAL_SCHEDULE',
      scheduleId,
      input,
      createdAt: new Date().toISOString(),
    };

    updateState((current) => ({
      ...current,
      manualScheduleItems: current.manualScheduleItems.map((currentItem) =>
        currentItem.id === item.id ? item : currentItem,
      ),
      pendingMutations: enqueueSchedulePlannerMutation(current.pendingMutations, mutation),
      isMutating: false,
      persisted: false,
      error: null,
    }));
    void syncWithRepository();

    return item;
  }, [syncWithRepository, updateState]);

  const deleteManualScheduleItem = useCallback(async (scheduleId: string) => {
    const mutation: SchedulePlannerMutation = {
      id: createLocalId('mutation'),
      kind: 'DELETE_MANUAL_SCHEDULE',
      scheduleId,
      createdAt: new Date().toISOString(),
    };

    updateState((current) => ({
      ...current,
      manualScheduleItems: current.manualScheduleItems.filter((item) => item.id !== scheduleId),
      pendingMutations: enqueueSchedulePlannerMutation(current.pendingMutations, mutation),
      isMutating: false,
      persisted: false,
      error: null,
    }));
    void syncWithRepository();
  }, [syncWithRepository, updateState]);

  const createTodo = useCallback(async (input: CreateTodoInput) => {
    updateState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const todo = await repository.createTodo(input);
      updateState((current) => ({
        ...current,
        todos: [todo, ...current.todos.filter((currentTodo) => currentTodo.id !== todo.id)],
        isMutating: false,
        persisted,
        syncedAt: new Date().toISOString(),
        error: null,
      }));
      return todo;
    } catch (error) {
      updateState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, [updateState]);

  const toggleTodo = useCallback(async (todoId: string) => {
    const previousTodos = stateRef.current.todos;
    const optimisticTodo = previousTodos.find((todo) => todo.id === todoId);

    if (!optimisticTodo) {
      throw new Error('할일을 찾지 못했어요.');
    }

    updateState((current) => ({
      ...current,
      todos: current.todos.map((todo) => (todo.id === todoId ? { ...todo, done: !todo.done } : todo)),
      isMutating: false,
      error: null,
    }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const todo = await repository.toggleTodo(todoId);
      updateState((current) => ({
        ...current,
        todos: current.todos.map((currentTodo) => (currentTodo.id === todo.id ? todo : currentTodo)),
        isMutating: false,
        persisted,
        syncedAt: new Date().toISOString(),
        error: null,
      }));
      return todo;
    } catch (error) {
      updateState((current) => ({
        ...current,
        todos: previousTodos,
        isMutating: false,
        error: getErrorMessage(error),
      }));
      throw error;
    }
  }, [updateState]);

  const updateTodo = useCallback(async (todoId: string, input: UpdateTodoInput) => {
    updateState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const todo = await repository.updateTodo(todoId, input);
      updateState((current) => ({
        ...current,
        todos: current.todos.map((currentTodo) => (currentTodo.id === todo.id ? todo : currentTodo)),
        isMutating: false,
        persisted,
        syncedAt: new Date().toISOString(),
        error: null,
      }));
      return todo;
    } catch (error) {
      updateState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, [updateState]);

  const deleteTodo = useCallback(async (todoId: string) => {
    updateState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      await repository.deleteTodo(todoId);
      updateState((current) => ({
        ...current,
        todos: current.todos.filter((todo) => todo.id !== todoId),
        isMutating: false,
        persisted,
        syncedAt: new Date().toISOString(),
        error: null,
      }));
    } catch (error) {
      updateState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
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
