import { useEffect, useState } from 'react';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import {
  createPromiseDataRefreshChannelName,
  getPromiseDataLoadErrorState,
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

  useEffect(() => {
    let isMounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const { persisted, repository } = await getActivePromiseRepository();
        const [profile, recentCards, scheduleItems] = await Promise.all([
          repository.getHostProfile(),
          repository.listRecentCards(),
          repository.listScheduleItems(),
        ]);

        if (isMounted) {
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
        if (isMounted) {
          setState((current) => getPromiseDataLoadErrorState(current, error));
        }
      }
    }

    function scheduleLoad() {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void load();
      }, 250);
    }

    load();
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
      isMounted = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      subscription?.unsubscribe();
      void dataChangeChannel?.unsubscribe();
    };
  }, []);

  return state;
}
