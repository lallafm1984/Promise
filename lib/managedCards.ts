import { getManagedStatusGroup, type ManagedStatusGroup } from './cardMenu';
import type { AppointmentStatus, PromiseCard, ScheduleItem } from '@/types/promise';

export interface ManagedCardDeleteConfirmation {
  title: string;
  body: string;
  confirmLabel: string;
}

export const CARD_CORE_CHANGE_POLICY = {
  title: '시간·장소 변경',
  body: '시간이나 장소를 바꾸려면 새 카드로 다시 공유해 주세요. 기존 응답은 기존 약속 기준으로 보관돼요.',
  actionLabel: '새 카드 만들기',
} as const;

export type DeliveredCardManagePath = `/manage?group=${ManagedStatusGroup}&scroll=${string}`;

const RECENT_RECEIVED_CARD_STATUSES: AppointmentStatus[] = ['PENDING', 'VOTING', 'DECLINED', 'CONFIRMED'];

export function getRecentReceivedCardStatuses(): AppointmentStatus[] {
  return [...RECENT_RECEIVED_CARD_STATUSES];
}

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
  const recentCardsById = new Map(recentCards.map((card) => [card.id, card]));
  const createdCardIds = new Set(createdCards.map((card) => card.id));

  return [
    ...createdCards
      .filter((card) => !removedCardIds.includes(card.id))
      .map((card) => recentCardsById.get(card.id) ?? card),
    ...recentCards.filter(
      (card) => !removedCardIds.includes(card.id) && !createdCardIds.has(card.id),
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

export function getScheduleCardManageGroup(item: Pick<ScheduleItem, 'startsAt'>, now = new Date()): ManagedStatusGroup {
  if (!item.startsAt) {
    return 'CONFIRMED';
  }

  const startsAt = new Date(item.startsAt);

  if (!Number.isNaN(startsAt.getTime()) && startsAt < now) {
    return 'PAST';
  }

  return 'CONFIRMED';
}

export function getScheduleCardManagePath(
  item: Pick<ScheduleItem, 'startsAt'>,
  scrollKey: string,
  now = new Date(),
): DeliveredCardManagePath {
  const group = getScheduleCardManageGroup(item, now);
  return `/manage?group=${group}&scroll=${encodeURIComponent(scrollKey)}` as DeliveredCardManagePath;
}

export function getManagedCardDeleteConfirmation(card: PromiseCard): ManagedCardDeleteConfirmation {
  return {
    title: '카드 취소',
    body: `${card.title} 카드를 취소하고 관리함에서 제거할까요?`,
    confirmLabel: '취소하기',
  };
}

export function buildCardCancellationMessage(item: Pick<ScheduleItem, 'title' | 'dateLabel' | 'timeLabel' | 'location'>): string {
  return [
    `${item.title} 일정이 취소 되었어요.`,
    '',
    `언제: ${item.dateLabel} ${item.timeLabel}`,
    `어디서: ${item.location}`,
  ].join('\n');
}
