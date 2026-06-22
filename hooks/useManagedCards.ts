import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { usePromiseData } from '@/hooks/usePromiseData';
import {
  buildManagedCardArchiveCache,
  mergeRemoteManagedCardsIntoArchive,
  parseManagedCardArchiveCache,
  type ManagedCardArchiveState,
} from '@/lib/managedCardArchive';
import {
  getPastAppointmentLocalSeedBatch,
  isPastAppointmentLocalSeedEnabled,
  mergePastAppointmentLocalSeedArchive,
} from '@/lib/managedCardTestSeed';
import {
  hideManagedPastCardFromLocalState,
  hideReceivedRepliedCardFromLocalState,
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  removeManagedCardFromLocalState,
} from '@/lib/managedCards';
import type { PromiseCard, PromiseRepository } from '@/types/promise';

const MANAGED_CARD_ARCHIVE_CACHE_PREFIX = '@whenbollae/managed-card-archive/v1';
const emptyManagedCardArchive: ManagedCardArchiveState = {
  localCards: [],
  removedCardIds: [],
  hiddenPastCardIds: [],
  hiddenReceivedReplyCardIds: [],
  updatedAt: null,
};

let localCards: PromiseCard[] = [];
let removedCardIds: string[] = [];
let hiddenPastCardIds: string[] = [];
let hiddenReceivedReplyCardIds: string[] = [];
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

function getHiddenPastSnapshot() {
  return hiddenPastCardIds;
}

function getHiddenReceivedReplySnapshot() {
  return hiddenReceivedReplyCardIds;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getManagedCardArchiveCacheKey(profileId?: string | null) {
  return `${MANAGED_CARD_ARCHIVE_CACHE_PREFIX}:${profileId ?? 'anonymous'}`;
}

function hasSameLocalArchive(
  nextCards: PromiseCard[],
  nextRemovedCardIds: string[],
  nextHiddenPastCardIds: string[],
  nextHiddenReceivedReplyCardIds: string[],
) {
  return (
    buildManagedCardArchiveCache({
      localCards,
      removedCardIds,
      hiddenPastCardIds,
      hiddenReceivedReplyCardIds,
      updatedAt: null,
    }) ===
    buildManagedCardArchiveCache({
      localCards: nextCards,
      removedCardIds: nextRemovedCardIds,
      hiddenPastCardIds: nextHiddenPastCardIds,
      hiddenReceivedReplyCardIds: nextHiddenReceivedReplyCardIds,
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
      hiddenPastCardIds,
      hiddenReceivedReplyCardIds,
      updatedAt: new Date().toISOString(),
    }),
  );
}

function commitLocalArchive(
  nextCards: PromiseCard[],
  nextRemovedCardIds: string[],
  nextHiddenPastCardIds = hiddenPastCardIds,
  nextHiddenReceivedReplyCardIds = hiddenReceivedReplyCardIds,
) {
  if (hasSameLocalArchive(nextCards, nextRemovedCardIds, nextHiddenPastCardIds, nextHiddenReceivedReplyCardIds)) {
    return;
  }

  localCards = nextCards;
  removedCardIds = nextRemovedCardIds;
  hiddenPastCardIds = nextHiddenPastCardIds;
  hiddenReceivedReplyCardIds = nextHiddenReceivedReplyCardIds;
  emitChange();
  persistLocalArchive();
}

export function useManagedCards() {
  const { profile, recentCards, isLoading, persisted, error, reload } = usePromiseData();
  const createdCards = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const removedIds = useSyncExternalStore(subscribe, getRemovedSnapshot, getRemovedSnapshot);
  const hiddenPastIds = useSyncExternalStore(subscribe, getHiddenPastSnapshot, getHiddenPastSnapshot);
  const hiddenReceivedReplyIds = useSyncExternalStore(
    subscribe,
    getHiddenReceivedReplySnapshot,
    getHiddenReceivedReplySnapshot,
  );

  const managedCards = useMemo(
    () => mergeManagedCardsView(createdCards, recentCards, removedIds),
    [createdCards, recentCards, removedIds],
  );

  useEffect(() => {
    const cacheKey = getManagedCardArchiveCacheKey(profile?.id);
    const shouldSeedPastAppointments = Boolean(profile?.id) && isPastAppointmentLocalSeedEnabled();
    const seedBatchId = getPastAppointmentLocalSeedBatch();
    let cancelled = false;

    if (activeArchiveCacheKey === cacheKey) {
      return;
    }

    activeArchiveCacheKey = cacheKey;
    localCards = [];
    removedCardIds = [];
    hiddenPastCardIds = [];
    hiddenReceivedReplyCardIds = [];
    emitChange();

    void AsyncStorage.getItem(cacheKey).then((rawCache) => {
      if (cancelled || activeArchiveCacheKey !== cacheKey) {
        return;
      }

      const parsed = parseManagedCardArchiveCache(rawCache);
      const archive = shouldSeedPastAppointments
        ? mergePastAppointmentLocalSeedArchive(parsed ?? emptyManagedCardArchive, { batchId: seedBatchId })
        : parsed;

      if (!archive) {
        return;
      }

      localCards = archive.localCards;
      removedCardIds = archive.removedCardIds;
      hiddenPastCardIds = archive.hiddenPastCardIds;
      hiddenReceivedReplyCardIds = archive.hiddenReceivedReplyCardIds;
      emitChange();

      if (shouldSeedPastAppointments && archive !== parsed) {
        void AsyncStorage.setItem(cacheKey, buildManagedCardArchiveCache(archive));
      }
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
      hiddenPastCardIds,
      hiddenReceivedReplyCardIds,
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
      hiddenPastCardIds.filter((cardId) => cardId !== card.id),
      hiddenReceivedReplyCardIds.filter((cardId) => cardId !== card.id),
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
    commitLocalArchive(
      removedState.localCards,
      removedState.removedCardIds,
      hiddenPastCardIds.filter((hiddenPastCardId) => hiddenPastCardId !== cardId),
      hiddenReceivedReplyCardIds.filter((hiddenReceivedReplyCardId) => hiddenReceivedReplyCardId !== cardId),
    );

    return {
      deleteFailed,
    };
  }, []);

  const hideManagedPastCard = useCallback((card: PromiseCard, now = new Date()) => {
    const hiddenState = hideManagedPastCardFromLocalState(hiddenPastCardIds, card, now);
    commitLocalArchive(localCards, removedCardIds, hiddenState.hiddenPastCardIds, hiddenReceivedReplyCardIds);
  }, []);

  const hideReceivedRepliedCard = useCallback(
    (card: PromiseCard, now = new Date(), currentProfile?: { id: string; displayName: string }) => {
      const hiddenState = hideReceivedRepliedCardFromLocalState(
        hiddenReceivedReplyCardIds,
        card,
        now,
        currentProfile,
      );
      commitLocalArchive(localCards, removedCardIds, hiddenPastCardIds, hiddenState.hiddenReceivedReplyCardIds);
    },
    [],
  );

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
      hiddenPastCardIds,
      hiddenReceivedReplyCardIds,
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
      hiddenPastCardIds.filter((cardId) => cardId !== savedCard.id),
      hiddenReceivedReplyCardIds.filter((cardId) => cardId !== savedCard.id),
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
      hiddenPastCardIds.filter((hiddenPastCardId) => hiddenPastCardId !== confirmedCard.id),
      hiddenReceivedReplyCardIds.filter((hiddenReceivedReplyCardId) => hiddenReceivedReplyCardId !== confirmedCard.id),
    );

    return confirmedCard;
  }, []);

  const respondToReceivedCard = useCallback(
    async (
      cardId: string,
      responses: Parameters<PromiseRepository['respondToReceivedCard']>[0]['responses'],
      respondentComment?: Parameters<PromiseRepository['respondToReceivedCard']>[0]['respondentComment'],
    ) => {
      const { repository } = await getActivePromiseRepository();
      const respondedCard = await repository.respondToReceivedCard({ cardId, responses, respondentComment });

      commitLocalArchive(
        [respondedCard, ...localCards.filter((currentCard) => currentCard.id !== respondedCard.id)],
        removedCardIds,
        hiddenPastCardIds,
        hiddenReceivedReplyCardIds.filter((hiddenReceivedReplyCardId) => hiddenReceivedReplyCardId !== respondedCard.id),
      );

      return respondedCard;
    },
    [],
  );

  return {
    profile,
    managedCards,
    removedCardIds: removedIds,
    hiddenPastCardIds: hiddenPastIds,
    hiddenReceivedReplyCardIds: hiddenReceivedReplyIds,
    addManagedCard,
    removeManagedCard,
    hideManagedPastCard,
    hideReceivedRepliedCard,
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
