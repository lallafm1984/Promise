import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { usePromiseData } from '@/hooks/usePromiseData';
import {
  buildManagedCardArchiveCache,
  mergeRemoteManagedCardsIntoArchive,
  parseManagedCardArchiveCache,
} from '@/lib/managedCardArchive';
import {
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  removeManagedCardFromLocalState,
} from '@/lib/managedCards';
import type { PromiseCard, PromiseRepository } from '@/types/promise';

const MANAGED_CARD_ARCHIVE_CACHE_PREFIX = '@whenbollae/managed-card-archive/v1';

let localCards: PromiseCard[] = [];
let removedCardIds: string[] = [];
let activeArchiveCacheKey: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return localCards;
}

function getRemovedSnapshot() {
  return removedCardIds;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getManagedCardArchiveCacheKey(profileId?: string | null) {
  return `${MANAGED_CARD_ARCHIVE_CACHE_PREFIX}:${profileId ?? 'anonymous'}`;
}

function hasSameLocalArchive(nextCards: PromiseCard[], nextRemovedCardIds: string[]) {
  return (
    buildManagedCardArchiveCache({
      localCards,
      removedCardIds,
      updatedAt: null,
    }) ===
    buildManagedCardArchiveCache({
      localCards: nextCards,
      removedCardIds: nextRemovedCardIds,
      updatedAt: null,
    })
  );
}

function persistLocalArchive() {
  const cacheKey = activeArchiveCacheKey;

  if (!cacheKey) {
    return;
  }

  void AsyncStorage.setItem(
    cacheKey,
    buildManagedCardArchiveCache({
      localCards,
      removedCardIds,
      updatedAt: new Date().toISOString(),
    }),
  );
}

function commitLocalArchive(nextCards: PromiseCard[], nextRemovedCardIds: string[]) {
  if (hasSameLocalArchive(nextCards, nextRemovedCardIds)) {
    return;
  }

  localCards = nextCards;
  removedCardIds = nextRemovedCardIds;
  emitChange();
  persistLocalArchive();
}

export function useManagedCards() {
  const { profile, recentCards, isLoading, persisted, error, reload } = usePromiseData();
  const createdCards = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const removedIds = useSyncExternalStore(subscribe, getRemovedSnapshot, getRemovedSnapshot);

  const managedCards = useMemo(
    () => mergeManagedCardsView(createdCards, recentCards, removedIds),
    [createdCards, recentCards, removedIds],
  );

  useEffect(() => {
    const cacheKey = getManagedCardArchiveCacheKey(profile?.id);
    let cancelled = false;

    if (activeArchiveCacheKey === cacheKey) {
      return;
    }

    activeArchiveCacheKey = cacheKey;
    localCards = [];
    removedCardIds = [];
    emitChange();

    void AsyncStorage.getItem(cacheKey).then((rawCache) => {
      if (cancelled || activeArchiveCacheKey !== cacheKey) {
        return;
      }

      const parsed = parseManagedCardArchiveCache(rawCache);

      if (!parsed) {
        return;
      }

      localCards = parsed.localCards;
      removedCardIds = parsed.removedCardIds;
      emitChange();
    });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (isLoading || recentCards.length === 0) {
      return;
    }

    commitLocalArchive(
      mergeRemoteManagedCardsIntoArchive(localCards, recentCards, removedCardIds),
      removedCardIds,
    );
  }, [isLoading, recentCards]);

  const addManagedCard = useCallback(async (card: PromiseCard) => {
    const { persisted, repository } = await getActivePromiseRepository();
    let savedCard = card;
    let didPersist = persisted;
    let saveFailed = false;

    try {
      savedCard = await repository.createManagedCard(card);
    } catch (error) {
      console.warn('[PromiseCards] Failed to create managed card', error);
      didPersist = false;
      saveFailed = true;
    }

    commitLocalArchive(
      mergeManagedCardIntoLocalCards(localCards, savedCard, card.id),
      removedCardIds.filter((cardId) => cardId !== card.id),
    );

    return {
      card: savedCard,
      persisted: didPersist,
      saveFailed,
    };
  }, []);

  const removeManagedCard = useCallback(async (cardId: string) => {
    const { repository } = await getActivePromiseRepository();
    let deleteFailed = false;

    try {
      await repository.deleteManagedCard(cardId);
    } catch (error) {
      console.warn('[PromiseCards] Failed to delete managed card', error);
      deleteFailed = true;
    }

    const removedState = removeManagedCardFromLocalState(localCards, removedCardIds, cardId);
    commitLocalArchive(removedState.localCards, removedState.removedCardIds);

    return {
      deleteFailed,
    };
  }, []);

  const sendManagedCardToRecipients = useCallback(async (card: PromiseCard, recipientProfileIds: string[]) => {
    const { persisted, repository } = await getActivePromiseRepository();
    let savedCard = card;
    let didPersist = persisted;
    let saveFailed = false;

    try {
      savedCard = await repository.sendManagedCardToRecipients(card.id, recipientProfileIds);
    } catch (error) {
      console.warn('[PromiseCards] Failed to send managed card to recipients', error);
      savedCard = mergeRecipientProfileIds(card, recipientProfileIds);
      didPersist = false;
      saveFailed = true;
    }

    commitLocalArchive(
      mergeManagedCardIntoLocalCards(localCards, savedCard, card.id),
      removedCardIds,
    );

    return {
      card: savedCard,
      persisted: didPersist,
      saveFailed,
    };
  }, []);

  const requestManagedCardChange = useCallback(async (card: PromiseCard) => {
    const { persisted, repository } = await getActivePromiseRepository();
    let savedCard = card;
    let didPersist = persisted;
    let saveFailed = false;

    try {
      savedCard = await repository.requestManagedCardChange(card);
    } catch (error) {
      console.warn('[PromiseCards] Failed to request managed card change', error);
      didPersist = false;
      saveFailed = true;
    }

    commitLocalArchive(
      mergeManagedCardIntoLocalCards(localCards, savedCard, card.id),
      removedCardIds.filter((cardId) => cardId !== savedCard.id),
    );

    return {
      card: savedCard,
      persisted: didPersist,
      saveFailed,
    };
  }, []);

  const confirmManagedCard = useCallback(async (cardId: string, candidateId: string) => {
    const { repository } = await getActivePromiseRepository();
    const confirmedCard = await repository.confirmManagedCard({ cardId, candidateId });

    commitLocalArchive(
      [confirmedCard, ...localCards.filter((currentCard) => currentCard.id !== confirmedCard.id)],
      removedCardIds.filter((removedCardId) => removedCardId !== confirmedCard.id),
    );

    return confirmedCard;
  }, []);

  const respondToReceivedCard = useCallback(
    async (
      cardId: string,
      responses: Parameters<PromiseRepository['respondToReceivedCard']>[0]['responses'],
    ) => {
      const { repository } = await getActivePromiseRepository();
      const respondedCard = await repository.respondToReceivedCard({ cardId, responses });

      commitLocalArchive(
        [respondedCard, ...localCards.filter((currentCard) => currentCard.id !== respondedCard.id)],
        removedCardIds,
      );

      return respondedCard;
    },
    [],
  );

  return {
    profile,
    managedCards,
    removedCardIds: removedIds,
    addManagedCard,
    removeManagedCard,
    sendManagedCardToRecipients,
    requestManagedCardChange,
    confirmManagedCard,
    respondToReceivedCard,
    isLoading,
    persisted,
    error,
    reload,
  };
}
