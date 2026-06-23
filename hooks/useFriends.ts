import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { getActiveFriendRepository, type FriendRepository } from '@/data/friendRepository';
import { getAccountScopedStorageKey } from '@/lib/accountScopedStorage';
import {
  buildFriendDataCache,
  createFriendDataRefreshChannelName,
  getFriendDataLoadErrorState,
  getFriendDataSnapshotKey,
  parseFriendDataCache,
  shouldReloadFriendDataForAppState,
  shouldSkipFriendDataReload,
  type FriendDataPayload,
  type FriendDataState,
} from '@/lib/friendDataState';
import { getFriendSummary, type FriendState } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

const FRIEND_DATA_CACHE_PREFIX = '@whenbollae/friend-data-cache/v1';
const FRIEND_DATA_RELOAD_DEBOUNCE_MS = 900;
const FRIEND_DATA_RELOAD_MIN_INTERVAL_MS = 30_000;

const emptyFriendState: FriendState = {
  friends: [],
  requests: [],
  suggestions: [],
};

const initialFriendDataState: FriendDataState = {
  ...emptyFriendState,
  isLoading: true,
  isMutating: false,
  isPersisted: false,
  error: null,
};

type FriendDataActions = {
  reload: (options?: { force?: boolean }) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<FriendState>;
  declineRequest: (requestId: string) => Promise<FriendState>;
  addFriend: (suggestionId: string) => Promise<FriendState>;
  sendRequestToHandle: (handle: string) => Promise<FriendState>;
  deleteFriend: (friendId: string) => Promise<FriendState>;
  cancelRequest: (requestId: string) => Promise<FriendState>;
};

type FriendsContextValue = FriendDataState &
  FriendDataActions & {
    summary: ReturnType<typeof getFriendSummary>;
  };

const FriendsContext = createContext<FriendsContextValue | null>(null);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '친구 정보를 불러오지 못했어요.';
}

async function getFriendDataCacheKey() {
  const authSession = await supabase?.auth.getSession();

  return getAccountScopedStorageKey(FRIEND_DATA_CACHE_PREFIX, authSession?.data.session?.user.id ?? null);
}

function useFriendsController(): FriendsContextValue {
  const [state, setState] = useState<FriendDataState>(initialFriendDataState);
  const isMountedRef = useRef(false);
  const activeCacheKeyRef = useRef<string | null>(null);
  const lastSnapshotKeyRef = useRef<string | null>(null);
  const lastLoadedAtMsRef = useRef<number | null>(null);
  const summary = useMemo(
    () =>
      getFriendSummary({
        friends: state.friends,
        requests: state.requests,
        suggestions: state.suggestions,
      }),
    [state.friends, state.requests, state.suggestions],
  );

  const resetLoadedDataRefs = useCallback(() => {
    lastSnapshotKeyRef.current = null;
    lastLoadedAtMsRef.current = null;
  }, []);

  const applyPayload = useCallback((payload: FriendDataPayload) => {
    const nextSnapshotKey = getFriendDataSnapshotKey(payload);
    lastSnapshotKeyRef.current = nextSnapshotKey;

    setState((current) => {
      const currentSnapshotKey = getFriendDataSnapshotKey({
        friendState: {
          friends: current.friends,
          requests: current.requests,
          suggestions: current.suggestions,
        },
        persisted: current.isPersisted,
      });

      if (currentSnapshotKey === nextSnapshotKey && !current.isLoading && current.error === null) {
        return current;
      }

      return {
        ...payload.friendState,
        isLoading: false,
        isMutating: current.isMutating,
        isPersisted: payload.persisted,
        error: null,
      };
    });
  }, []);

  const hydrateCache = useCallback(async () => {
    const cacheKey = await getFriendDataCacheKey();
    const didChangeCacheKey = activeCacheKeyRef.current !== cacheKey;

    if (didChangeCacheKey) {
      activeCacheKeyRef.current = cacheKey;
      resetLoadedDataRefs();
    }

    const cachedPayload = parseFriendDataCache(await AsyncStorage.getItem(cacheKey));

    if (cachedPayload && isMountedRef.current) {
      applyPayload(cachedPayload);
    } else if (didChangeCacheKey && isMountedRef.current) {
      setState(initialFriendDataState);
    }
  }, [applyPayload, resetLoadedDataRefs]);

  const loadFriends = useCallback(
    async (options: { force?: boolean } = {}) => {
      let cacheKey: string | null = null;

      try {
        cacheKey = await getFriendDataCacheKey();

        if (activeCacheKeyRef.current !== cacheKey) {
          activeCacheKeyRef.current = cacheKey;
          resetLoadedDataRefs();

          if (isMountedRef.current) {
            setState(initialFriendDataState);
          }
        }

        const nowMs = Date.now();

        if (
          shouldSkipFriendDataReload({
            force: options.force,
            hasSnapshot: lastSnapshotKeyRef.current !== null,
            lastLoadedAtMs: lastLoadedAtMsRef.current,
            minIntervalMs: FRIEND_DATA_RELOAD_MIN_INTERVAL_MS,
            nowMs,
          })
        ) {
          return;
        }

        if (isMountedRef.current && lastSnapshotKeyRef.current === null) {
          setState((current) => ({
            ...current,
            isLoading: true,
            error: null,
          }));
        }

        const { persisted, repository } = await getActiveFriendRepository();
        const friendState = await repository.listFriendState();
        const payload: FriendDataPayload = {
          friendState,
          persisted,
        };

        if (isMountedRef.current && activeCacheKeyRef.current === cacheKey) {
          applyPayload(payload);
          lastLoadedAtMsRef.current = nowMs;
          await AsyncStorage.setItem(cacheKey, buildFriendDataCache(payload));
        }
      } catch (nextError) {
        if (isMountedRef.current && (!cacheKey || activeCacheKeyRef.current === cacheKey)) {
          setState((current) => getFriendDataLoadErrorState(current, nextError));
          lastLoadedAtMsRef.current = null;
        }
      }
    },
    [applyPayload, resetLoadedDataRefs],
  );

  useEffect(() => {
    isMountedRef.current = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let dataChangeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    let dataChangeInstallId = 0;

    function scheduleLoad(options: { force?: boolean } = {}) {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void loadFriends(options);
      }, FRIEND_DATA_RELOAD_DEBOUNCE_MS);
    }

    function uninstallDataChangeChannel() {
      dataChangeInstallId += 1;

      if (dataChangeChannel) {
        void dataChangeChannel.unsubscribe();
        dataChangeChannel = null;
      }
    }

    async function installDataChangeChannel() {
      const installId = dataChangeInstallId + 1;
      dataChangeInstallId = installId;

      if (dataChangeChannel) {
        void dataChangeChannel.unsubscribe();
        dataChangeChannel = null;
      }

      if (!supabase) {
        return;
      }

      const accountId = (await supabase.auth.getSession()).data.session?.user.id;

      if (!accountId || !isMountedRef.current || installId !== dataChangeInstallId) {
        return;
      }

      dataChangeChannel = supabase
        .channel(createFriendDataRefreshChannelName())
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mobile_sync_versions',
            filter: `user_id=eq.${accountId}`,
          },
          () => {
            scheduleLoad({ force: true });
          },
        )
        .subscribe();
    }

    void (async () => {
      await hydrateCache();
      await loadFriends({ force: lastSnapshotKeyRef.current === null });
      await installDataChangeChannel();
    })();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (shouldReloadFriendDataForAppState(nextState)) {
        scheduleLoad({ force: true });
      }
    });
    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          activeCacheKeyRef.current = null;
          resetLoadedDataRefs();
          setState(initialFriendDataState);
          uninstallDataChangeChannel();
          return;
        }

        void (async () => {
          await hydrateCache();
          await loadFriends({ force: true });
          await installDataChangeChannel();
        })();
      }) ?? { data: { subscription: null } };

    return () => {
      isMountedRef.current = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      appStateSubscription.remove();
      subscription?.unsubscribe();
      uninstallDataChangeChannel();
    };
  }, [hydrateCache, loadFriends, resetLoadedDataRefs]);

  const runAction = useCallback(
    async (operation: (repository: FriendRepository) => Promise<FriendState>) => {
      let cacheKey: string | null = null;

      setState((current) => ({
        ...current,
        isMutating: true,
        error: null,
      }));

      try {
        cacheKey = await getFriendDataCacheKey();

        if (activeCacheKeyRef.current !== cacheKey) {
          activeCacheKeyRef.current = cacheKey;
          resetLoadedDataRefs();
        }

        const { persisted, repository } = await getActiveFriendRepository();
        const nextFriendState = await operation(repository);
        const payload: FriendDataPayload = {
          friendState: nextFriendState,
          persisted,
        };

        if (isMountedRef.current && activeCacheKeyRef.current === cacheKey) {
          applyPayload(payload);
          lastLoadedAtMsRef.current = Date.now();
          await AsyncStorage.setItem(cacheKey, buildFriendDataCache(payload));
        }

        return nextFriendState;
      } catch (nextError) {
        const message = getErrorMessage(nextError);

        if (isMountedRef.current && (!cacheKey || activeCacheKeyRef.current === cacheKey)) {
          setState((current) => ({
            ...getFriendDataLoadErrorState(current, nextError),
            error: message,
          }));
        }

        throw new Error(message);
      } finally {
        if (isMountedRef.current) {
          setState((current) => ({
            ...current,
            isMutating: false,
          }));
        }
      }
    },
    [applyPayload, resetLoadedDataRefs],
  );

  const acceptRequest = useCallback((requestId: string) => runAction((repository) => repository.acceptRequest(requestId)), [runAction]);
  const declineRequest = useCallback((requestId: string) => runAction((repository) => repository.declineRequest(requestId)), [runAction]);
  const addFriend = useCallback((suggestionId: string) => runAction((repository) => repository.addFriend(suggestionId)), [runAction]);
  const sendRequestToHandle = useCallback(
    (handle: string) => runAction((repository) => repository.sendRequestToHandle(handle)),
    [runAction],
  );
  const deleteFriend = useCallback((friendId: string) => runAction((repository) => repository.deleteFriend(friendId)), [runAction]);
  const cancelRequest = useCallback((requestId: string) => runAction((repository) => repository.cancelRequest(requestId)), [runAction]);

  return {
    ...state,
    summary,
    reload: loadFriends,
    acceptRequest,
    declineRequest,
    addFriend,
    sendRequestToHandle,
    deleteFriend,
    cancelRequest,
  };
}

export function FriendsProvider({ children }: { children: ReactNode }) {
  const value = useFriendsController();

  return createElement(FriendsContext.Provider, { value }, children);
}

export function useFriends() {
  const value = useContext(FriendsContext);

  if (!value) {
    throw new Error('useFriends must be used within FriendsProvider.');
  }

  return value;
}
