import { useCallback, useEffect, useState } from 'react';

import { getActiveScheduleRepository } from '@/data/scheduleRepository';
import { supabase } from '@/lib/supabase';
import type { CreateManualScheduleInput, CreateTodoInput, DisplayScheduleItem, TodoItem } from '@/types/promise';

interface SchedulePlannerState {
  manualScheduleItems: DisplayScheduleItem[];
  todos: TodoItem[];
  isLoading: boolean;
  isMutating: boolean;
  persisted: boolean;
  error: string | null;
}

const initialState: SchedulePlannerState = {
  manualScheduleItems: [],
  todos: [],
  isLoading: true,
  isMutating: false,
  persisted: false,
  error: null,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '일정 데이터를 저장하지 못했어요.';
}

export function useSchedulePlanner() {
  const [state, setState] = useState<SchedulePlannerState>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const { persisted, repository } = await getActiveScheduleRepository();
        const [manualScheduleItems, todos] = await Promise.all([
          repository.listManualScheduleItems(),
          repository.listTodos(),
        ]);

        if (isMounted) {
          setState({
            manualScheduleItems,
            todos,
            isLoading: false,
            isMutating: false,
            persisted,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState((current) => ({
            ...current,
            isLoading: false,
            isMutating: false,
            error: getErrorMessage(error),
          }));
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
    setState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const item = await repository.createManualScheduleItem(input);
      setState((current) => ({
        ...current,
        manualScheduleItems: [item, ...current.manualScheduleItems.filter((currentItem) => currentItem.id !== item.id)],
        isMutating: false,
        persisted,
        error: null,
      }));
      return item;
    } catch (error) {
      setState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, []);

  const updateManualScheduleItem = useCallback(async (scheduleId: string, input: CreateManualScheduleInput) => {
    setState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const item = await repository.updateManualScheduleItem(scheduleId, input);
      setState((current) => ({
        ...current,
        manualScheduleItems: current.manualScheduleItems.map((currentItem) =>
          currentItem.id === item.id ? item : currentItem,
        ),
        isMutating: false,
        persisted,
        error: null,
      }));
      return item;
    } catch (error) {
      setState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, []);

  const deleteManualScheduleItem = useCallback(async (scheduleId: string) => {
    setState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      await repository.deleteManualScheduleItem(scheduleId);
      setState((current) => ({
        ...current,
        manualScheduleItems: current.manualScheduleItems.filter((item) => item.id !== scheduleId),
        isMutating: false,
        persisted,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, []);

  const createTodo = useCallback(async (input: CreateTodoInput) => {
    setState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const todo = await repository.createTodo(input);
      setState((current) => ({
        ...current,
        todos: [todo, ...current.todos.filter((currentTodo) => currentTodo.id !== todo.id)],
        isMutating: false,
        persisted,
        error: null,
      }));
      return todo;
    } catch (error) {
      setState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, []);

  const toggleTodo = useCallback(async (todoId: string) => {
    setState((current) => ({ ...current, isMutating: true, error: null }));

    try {
      const { persisted, repository } = await getActiveScheduleRepository();
      const todo = await repository.toggleTodo(todoId);
      setState((current) => ({
        ...current,
        todos: current.todos.map((currentTodo) => (currentTodo.id === todo.id ? todo : currentTodo)),
        isMutating: false,
        persisted,
        error: null,
      }));
      return todo;
    } catch (error) {
      setState((current) => ({ ...current, isMutating: false, error: getErrorMessage(error) }));
      throw error;
    }
  }, []);

  return {
    ...state,
    createManualScheduleItem,
    updateManualScheduleItem,
    deleteManualScheduleItem,
    createTodo,
    toggleTodo,
  };
}
