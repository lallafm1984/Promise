import { useEffect, useState } from 'react';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { getPromiseDataLoadErrorState, type PromiseDataState } from '@/lib/promiseDataState';
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

  return state;
}
