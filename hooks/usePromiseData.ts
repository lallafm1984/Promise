import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { getAccountScopedStorageKey } from '@/lib/accountScopedStorage';
import {
  buildPromiseDataCache,
  createPromiseDataRefreshChannelName,
  getPromiseDataLoadErrorState,
  getPromiseDataSnapshotKey,
  parsePromiseDataCache,
  shouldReloadPromiseDataForAppState,
  shouldSkipPromiseDataReload,
  type PromiseDataPayload,
  type PromiseDataState,
} from '@/lib/promiseDataState';
import { supabase } from '@/lib/supabase';

const PROMISE_DATA_CACHE_PREFIX = '@whenbollae/promise-data-cache/v1';
const PROMISE_DATA_RELOAD_DEBOUNCE_MS = 900;
const PROMISE_DATA_RELOAD_MIN_INTERVAL_MS = 30_000;

const initialState: PromiseDataState = {
  profile: null,
  recentCards: [],
  scheduleItems: [],
  isLoading: true,
  persisted: false,
  syncVersion: null,
  error: null,
};

async function getPromiseDataCacheKey() {
  const authSession = await supabase?.auth.getSession();

  return getAccountScopedStorageKey(PROMISE_DATA_CACHE_PREFIX, authSession?.data.session?.user.id ?? null);
}

export function usePromiseData() {
  const [state, setState] = useState<PromiseDataState>(initialState);
  const isMountedRef = useRef(false);
  const activeCacheKeyRef = useRef<string | null>(null);
  const lastSnapshotKeyRef = useRef<string | null>(null);
  const lastLoadedAtMsRef = useRef<number | null>(null);
  const lastSyncVersionRef = useRef<string | null>(null);

  const resetLoadedDataRefs = useCallback(() => {
    lastSnapshotKeyRef.current = null;
    lastLoadedAtMsRef.current = null;
    lastSyncVersionRef.current = null;
  }, []);

  const applyPayload = useCallback((payload: PromiseDataPayload) => {
    const nextSnapshotKey = getPromiseDataSnapshotKey(payload);
    lastSnapshotKeyRef.current = nextSnapshotKey;
    lastSyncVersionRef.current = payload.syncVersion;

    setState((current) => {
      if (
        getPromiseDataSnapshotKey({
          profile: current.profile,
          recentCards: current.recentCards,
          scheduleItems: current.scheduleItems,
          persisted: current.persisted,
          syncVersion: current.syncVersion,
        }) === nextSnapshotKey &&
        !current.isLoading &&
        current.error === null
      ) {
        return current;
      }

      return {
        profile: payload.profile,
        recentCards: payload.recentCards,
        scheduleItems: payload.scheduleItems,
        isLoading: false,
        persisted: payload.persisted,
        syncVersion: payload.syncVersion,
        error: null,
      };
    });
  }, []);

  const hydrateCache = useCallback(async () => {
    const cacheKey = await getPromiseDataCacheKey();
    const didChangeCacheKey = activeCacheKeyRef.current !== cacheKey;

    if (didChangeCacheKey) {
      activeCacheKeyRef.current = cacheKey;
      resetLoadedDataRefs();
    }

    const cachedPayload = parsePromiseDataCache(await AsyncStorage.getItem(cacheKey));

    if (cachedPayload && isMountedRef.current) {
      applyPayload(cachedPayload);
    } else if (didChangeCacheKey && isMountedRef.current) {
      setState(initialState);
    }
  }, [applyPayload, resetLoadedDataRefs]);

  const load = useCallback(async (options: { force?: boolean } = {}) => {
    let cacheKey: string | null = null;

    try {
      cacheKey = await getPromiseDataCacheKey();

      if (activeCacheKeyRef.current !== cacheKey) {
        activeCacheKeyRef.current = cacheKey;
        resetLoadedDataRefs();

        if (isMountedRef.current) {
          setState(initialState);
        }
      }

      const nowMs = Date.now();

      if (
        shouldSkipPromiseDataReload({
          force: options.force,
          hasSnapshot: lastSnapshotKeyRef.current !== null,
          lastLoadedAtMs: lastLoadedAtMsRef.current,
          minIntervalMs: PROMISE_DATA_RELOAD_MIN_INTERVAL_MS,
          nowMs,
        })
      ) {
        return;
      }

      const { persisted, repository } = await getActivePromiseRepository();
      let checkedSyncVersion: string | null = null;

      if (persisted && !options.force && lastSyncVersionRef.current) {
        try {
          const syncSnapshot = await repository.getMobileSyncSnapshot(lastSyncVersionRef.current);
          checkedSyncVersion = syncSnapshot.syncVersion;

          if (!syncSnapshot.hasChanges) {
            lastLoadedAtMsRef.current = nowMs;
            return;
          }
        } catch {
          checkedSyncVersion = null;
        }
      }

      const [profile, recentCards, scheduleItems] = await Promise.all([
        repository.getHostProfile(),
        repository.listRecentCards(),
        repository.listScheduleItems(),
      ]);
      const syncVersion =
        checkedSyncVersion ??
        (await repository
          .getMobileSyncSnapshot(null)
          .then((syncSnapshot) => syncSnapshot.syncVersion)
          .catch(() => new Date().toISOString()));
      const payload: PromiseDataPayload = {
        profile,
        recentCards,
        scheduleItems,
        persisted,
        syncVersion,
      };

      if (isMountedRef.current && activeCacheKeyRef.current === cacheKey) {
        applyPayload(payload);
        lastLoadedAtMsRef.current = nowMs;
        await AsyncStorage.setItem(cacheKey, buildPromiseDataCache(payload));
      }
    } catch (error) {
      if (isMountedRef.current && (!cacheKey || activeCacheKeyRef.current === cacheKey)) {
        setState((current) => getPromiseDataLoadErrorState(current, error));
        resetLoadedDataRefs();
      }
    }
  }, [applyPayload, resetLoadedDataRefs]);

  useEffect(() => {
    isMountedRef.current = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleLoad(options: { force?: boolean } = {}) {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void load(options);
      }, PROMISE_DATA_RELOAD_DEBOUNCE_MS);
    }

    void (async () => {
      await hydrateCache();
      await load({ force: lastSnapshotKeyRef.current === null });
    })();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (shouldReloadPromiseDataForAppState(nextState)) {
        scheduleLoad();
      }
    });
    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          activeCacheKeyRef.current = null;
          resetLoadedDataRefs();
          setState(initialState);
          return;
        }

        void (async () => {
          await hydrateCache();
          await load({ force: true });
        })();
      }) ?? { data: { subscription: null } };
    const dataChangeChannel = supabase
      ?.channel(createPromiseDataRefreshChannelName())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_cards' }, () =>
        scheduleLoad({ force: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_respondents' }, () =>
        scheduleLoad({ force: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_candidate_responses' }, () =>
        scheduleLoad({ force: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_recipients' }, () =>
        scheduleLoad({ force: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () =>
        scheduleLoad({ force: true }),
      )
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
  }, [hydrateCache, load, resetLoadedDataRefs]);

  return {
    ...state,
    reload: load,
  };
}
