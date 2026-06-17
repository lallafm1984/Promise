import { useCallback, useEffect, useMemo, useState } from 'react';

import { getActiveFriendRepository, type FriendRepository } from '@/data/friendRepository';
import { getFriendSummary, type FriendState } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

const emptyFriendState: FriendState = {
  friends: [],
  requests: [],
  suggestions: [],
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '친구 정보를 불러오지 못했어요.';
}

export function useFriends() {
  const [state, setState] = useState<FriendState>(emptyFriendState);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = useMemo(() => getFriendSummary(state), [state]);

  const loadFriends = useCallback(async () => {
    setIsLoading(true);

    try {
      const { persisted, repository } = await getActiveFriendRepository();
      const nextState = await repository.listFriendState();
      setState(nextState);
      setIsPersisted(persisted);
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();

    const subscription = supabase?.auth.onAuthStateChange(() => {
      void loadFriends();
    });

    return () => {
      subscription?.data.subscription.unsubscribe();
    };
  }, [loadFriends]);

  const runAction = useCallback(
    async (operation: (repository: FriendRepository) => Promise<FriendState>) => {
      setIsMutating(true);

      try {
        const { persisted, repository } = await getActiveFriendRepository();
        const nextState = await operation(repository);
        setState(nextState);
        setIsPersisted(persisted);
        setError(null);
        return nextState;
      } catch (nextError) {
        const message = getErrorMessage(nextError);
        setError(message);
        throw new Error(message);
      } finally {
        setIsMutating(false);
      }
    },
    [],
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
    friends: state.friends,
    requests: state.requests,
    suggestions: state.suggestions,
    summary,
    isLoading,
    isMutating,
    isPersisted,
    error,
    reload: loadFriends,
    acceptRequest,
    declineRequest,
    addFriend,
    sendRequestToHandle,
    deleteFriend,
    cancelRequest,
  };
}
