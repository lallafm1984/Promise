import { getManagedStatusGroup, type ManagedStatusGroup } from './cardMenu';
import type { PromiseCard } from '@/types/promise';

export interface ManagedCardDeleteConfirmation {
  title: string;
  body: string;
  confirmLabel: string;
}

export type DeliveredCardManagePath = `/manage?group=${ManagedStatusGroup}&scroll=${string}`;

export function mergeManagedCardIntoLocalCards(
  localCards: PromiseCard[],
  card: PromiseCard,
  replacedCardId = card.id,
): PromiseCard[] {
  return [
    card,
    ...localCards.filter((currentCard) => currentCard.id !== card.id && currentCard.id !== replacedCardId),
  ];
}

export function mergeManagedCardsView(
  createdCards: PromiseCard[],
  recentCards: PromiseCard[],
  removedCardIds: string[],
): PromiseCard[] {
  return [
    ...createdCards,
    ...recentCards.filter(
      (card) =>
        !removedCardIds.includes(card.id) && !createdCards.some((createdCard) => createdCard.id === card.id),
    ),
  ];
}

export function mergeRecipientProfileIds(card: PromiseCard, recipientProfileIds: string[]): PromiseCard {
  return {
    ...card,
    recipientProfileIds: Array.from(new Set([...(card.recipientProfileIds ?? []), ...recipientProfileIds])),
  };
}

export function removeManagedCardFromLocalState(
  localCards: PromiseCard[],
  removedCardIds: string[],
  cardId: string,
): { localCards: PromiseCard[]; removedCardIds: string[] } {
  return {
    localCards: localCards.filter((currentCard) => currentCard.id !== cardId),
    removedCardIds: removedCardIds.includes(cardId) ? removedCardIds : [...removedCardIds, cardId],
  };
}

export function getDeliveredCardManageGroup(card: PromiseCard): ManagedStatusGroup {
  const group = getManagedStatusGroup(card);
  return group === 'VOTING' ? 'VOTING' : 'PENDING';
}

export function getDeliveredCardManagePath(card: PromiseCard, scrollKey: string): DeliveredCardManagePath {
  const group = getDeliveredCardManageGroup(card);
  return `/manage?group=${group}&scroll=${encodeURIComponent(scrollKey)}` as DeliveredCardManagePath;
}

export function getManagedCardDeleteConfirmation(card: PromiseCard): ManagedCardDeleteConfirmation {
  return {
    title: '카드 삭제',
    body: `${card.title} 카드를 삭제할까요?`,
    confirmLabel: '삭제',
  };
}
