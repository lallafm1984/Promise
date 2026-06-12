import { useEffect, useState } from 'react';

import { mockPromiseRepository } from '@/data/mockPromiseRepository';
import type { HostProfile, PromiseCard, ScheduleItem } from '@/types/promise';

interface PromiseData {
  profile: HostProfile | null;
  inboxCards: PromiseCard[];
  recentCards: PromiseCard[];
  scheduleItems: ScheduleItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: PromiseData = {
  profile: null,
  inboxCards: [],
  recentCards: [],
  scheduleItems: [],
  isLoading: true,
  error: null,
};

export function usePromiseData() {
  const [state, setState] = useState<PromiseData>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [profile, inboxCards, recentCards, scheduleItems] = await Promise.all([
          mockPromiseRepository.getHostProfile(),
          mockPromiseRepository.listInboxCards(),
          mockPromiseRepository.listRecentCards(),
          mockPromiseRepository.listScheduleItems(),
        ]);

        if (isMounted) {
          setState({
            profile,
            inboxCards,
            recentCards,
            scheduleItems,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error: error instanceof Error ? error.message : '데이터를 불러오지 못했어요.',
          }));
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
