import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import {
  createPromiseDataRefreshChannelName,
  getPromiseDataLoadErrorState,
  shouldReloadPromiseDataForAppState,
  type PromiseDataState,
} from '@/lib/promiseDataState';
import { supabase } from '@/lib/supabase';

const initialState: PromiseDataState = {
  profile: null,
  recentCards: [],
  scheduleItems: [],
  isLoading: true,
  persisted: false,
  error: null,
};

export function usePromiseData() {
  const [state, setState] = useState<PromiseDataState>(initialState);
  const isMountedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { persisted, repository } = await getActivePromiseRepository();
      const [profile, recentCards, scheduleItems] = await Promise.all([
        repository.getHostProfile(),
        repository.listRecentCards(),
        repository.listScheduleItems(),
      ]);

      if (isMountedRef.current) {
        setState({
          profile,
          recentCards,
          scheduleItems,
          isLoading: false,
          persisted,
          error: null,
        });
      }
    } catch (error) {
      if (isMountedRef.current) {
        setState((current) => getPromiseDataLoadErrorState(current, error));
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleLoad() {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void load();
      }, 250);
    }

    void load();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (shouldReloadPromiseDataForAppState(nextState)) {
        scheduleLoad();
      }
    });
    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange(() => {
        void load();
      }) ?? { data: { subscription: null } };
    const dataChangeChannel = supabase
      ?.channel(createPromiseDataRefreshChannelName())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_cards' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_respondents' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_candidate_responses' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, scheduleLoad)
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      appStateSubscription.remove();
      subscription?.unsubscribe();
      void dataChangeChannel?.unsubscribe();
    };
  }, [load]);

  return {
    ...state,
    reload: load,
  };
}
