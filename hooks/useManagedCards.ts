import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { usePromiseData } from '@/hooks/usePromiseData';
import {
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  removeManagedCardFromLocalState,
} from '@/lib/managedCards';
import type { PromiseCard, PromiseRepository } from '@/types/promise';

let localCards: PromiseCard[] = [];
let removedCardIds: string[] = [];
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

export function useManagedCards() {
  const { recentCards, isLoading, persisted, error, reload } = usePromiseData();
  const createdCards = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const removedIds = useSyncExternalStore(subscribe, getRemovedSnapshot, getRemovedSnapshot);

  const managedCards = useMemo(
    () => mergeManagedCardsView(createdCards, recentCards, removedIds),
    [createdCards, recentCards, removedIds],
  );

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

    removedCardIds = removedCardIds.filter((cardId) => cardId !== card.id);
    localCards = mergeManagedCardIntoLocalCards(localCards, savedCard, card.id);
    emitChange();

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
    localCards = removedState.localCards;
    removedCardIds = removedState.removedCardIds;

    emitChange();

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

    localCards = mergeManagedCardIntoLocalCards(localCards, savedCard, card.id);
    emitChange();

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

    removedCardIds = removedCardIds.filter((cardId) => cardId !== savedCard.id);
    localCards = mergeManagedCardIntoLocalCards(localCards, savedCard, card.id);
    emitChange();

    return {
      card: savedCard,
      persisted: didPersist,
      saveFailed,
    };
  }, []);

  const confirmManagedCard = useCallback(async (cardId: string, candidateId: string) => {
    const { repository } = await getActivePromiseRepository();
    const confirmedCard = await repository.confirmManagedCard({ cardId, candidateId });

    removedCardIds = removedCardIds.filter((removedCardId) => removedCardId !== confirmedCard.id);
    localCards = [confirmedCard, ...localCards.filter((currentCard) => currentCard.id !== confirmedCard.id)];
    emitChange();

    return confirmedCard;
  }, []);

  const respondToReceivedCard = useCallback(
    async (
      cardId: string,
      responses: Parameters<PromiseRepository['respondToReceivedCard']>[0]['responses'],
    ) => {
      const { repository } = await getActivePromiseRepository();
      const respondedCard = await repository.respondToReceivedCard({ cardId, responses });

      localCards = [respondedCard, ...localCards.filter((currentCard) => currentCard.id !== respondedCard.id)];
      emitChange();

      return respondedCard;
    },
    [],
  );

  return {
    managedCards,
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
