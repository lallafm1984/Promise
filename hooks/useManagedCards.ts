import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { getActivePromiseRepository } from '@/data/promiseRepository';
import { usePromiseData } from '@/hooks/usePromiseData';
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
  const { recentCards, isLoading, persisted, error } = usePromiseData();
  const createdCards = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const removedIds = useSyncExternalStore(subscribe, getRemovedSnapshot, getRemovedSnapshot);

  const managedCards = useMemo(
    () => [
      ...createdCards,
      ...recentCards.filter(
        (card) =>
          !removedIds.includes(card.id) && !createdCards.some((createdCard) => createdCard.id === card.id),
      ),
    ],
    [createdCards, recentCards, removedIds],
  );

  const addManagedCard = useCallback(async (card: PromiseCard) => {
    const { persisted, repository } = await getActivePromiseRepository();
    const savedCard = await repository.createManagedCard(card);

    removedCardIds = removedCardIds.filter((cardId) => cardId !== card.id);
    localCards = [
      savedCard,
      ...localCards.filter((currentCard) => currentCard.id !== savedCard.id && currentCard.id !== card.id),
    ];
    emitChange();

    return {
      card: savedCard,
      persisted,
    };
  }, []);

  const removeManagedCard = useCallback(async (cardId: string) => {
    const { repository } = await getActivePromiseRepository();
    await repository.deleteManagedCard(cardId);

    localCards = localCards.filter((currentCard) => currentCard.id !== cardId);

    if (!removedCardIds.includes(cardId)) {
      removedCardIds = [...removedCardIds, cardId];
    }

    emitChange();
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
    confirmManagedCard,
    respondToReceivedCard,
    isLoading,
    persisted,
    error,
  };
}
