import {
  getManagedCardScope,
  getManagedStatusGroup,
  getPrimarySlot,
  type ManagedCardCurrentProfile,
  type ManagedStatusGroup,
} from './cardMenu';
import { toDateKey } from './scheduleCalendar';
import type { AppointmentStatus, PromiseCard, ScheduleItem } from '@/types/promise';

export interface ManagedCardDeleteConfirmation {
  title: string;
  body: string;
  confirmLabel: string;
  directDeleteLabel?: string;
  shareDeleteLabel?: string;
}

export interface CardScheduleDeleteConfirmation {
  title: string;
  body: string;
  confirmLabel?: string;
  directDeleteLabel?: string;
  shareDeleteLabel?: string;
}

export const CARD_CORE_CHANGE_POLICY = {
  title: '시간·장소 변경',
  body: '시간이나 장소를 바꾸려면 새 카드로 다시 공유해 주세요. 기존 응답은 기존 약속 기준으로 보관돼요.',
  actionLabel: '새 카드 만들기',
} as const;

export type DeliveredCardManagePath = `/manage?group=${ManagedStatusGroup}&scroll=${string}`;
export type ConfirmedCardSchedulePath = '/schedule' | `/schedule?date=${string}`;

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

function getAnsweredResponseCount(card: PromiseCard): number {
  return card.participants.reduce((total, participant) => {
    const representativeCount = participant.choice && participant.choice !== 'UNANSWERED' ? 1 : 0;
    const candidateResponseCount =
      participant.responses?.filter((response) => response.choice !== 'UNANSWERED').length ?? 0;

    return total + Math.max(representativeCount, candidateResponseCount);
  }, 0);
}

function hasSameCandidateResponseTargets(localCard: PromiseCard, remoteCard: PromiseCard): boolean {
  if (localCard.candidates.length !== remoteCard.candidates.length) {
    return false;
  }

  const remoteCandidatesById = new Map(remoteCard.candidates.map((candidate) => [candidate.id, candidate]));
  return localCard.candidates.every((candidate) => {
    const remoteCandidate = remoteCandidatesById.get(candidate.id);

    return (
      remoteCandidate?.startsAt === candidate.startsAt &&
      remoteCandidate.endsAt === candidate.endsAt &&
      remoteCandidate.label === candidate.label
    );
  });
}

export function getPreferredManagedCardSnapshot(localCard: PromiseCard, remoteCard: PromiseCard): PromiseCard {
  if (
    localCard.requesterName &&
    hasSameCandidateResponseTargets(localCard, remoteCard) &&
    getAnsweredResponseCount(localCard) > getAnsweredResponseCount(remoteCard)
  ) {
    return {
      ...remoteCard,
      candidates: localCard.candidates,
      participants: localCard.participants,
    };
  }

  return remoteCard;
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
      .map((card) => {
        const remoteCard = recentCardsById.get(card.id);
        return remoteCard ? getPreferredManagedCardSnapshot(card, remoteCard) : card;
      }),
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

export function hideManagedPastCardFromLocalState(
  hiddenPastCardIds: string[],
  card: PromiseCard,
  now = new Date(),
): { hiddenPastCardIds: string[]; removedCardIds: string[] } {
  const statusGroup = getManagedStatusGroup(card, now);

  if (statusGroup !== 'PAST' && statusGroup !== 'CONFIRMED') {
    return {
      hiddenPastCardIds,
      removedCardIds: [],
    };
  }

  return {
    hiddenPastCardIds: hiddenPastCardIds.includes(card.id) ? hiddenPastCardIds : [...hiddenPastCardIds, card.id],
    removedCardIds: [],
  };
}

export function hideReceivedRepliedCardFromLocalState(
  hiddenReceivedReplyCardIds: string[],
  card: PromiseCard,
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): { hiddenReceivedReplyCardIds: string[]; removedCardIds: string[] } {
  if (getManagedCardScope(card) !== 'RECEIVED') {
    return {
      hiddenReceivedReplyCardIds,
      removedCardIds: [],
    };
  }

  return {
    hiddenReceivedReplyCardIds: hiddenReceivedReplyCardIds.includes(card.id)
      ? hiddenReceivedReplyCardIds
      : [...hiddenReceivedReplyCardIds, card.id],
    removedCardIds: [],
  };
}

export function filterManagedCardsByHiddenPastIds(
  cards: PromiseCard[],
  hiddenPastCardIds: string[],
  now = new Date(),
): PromiseCard[] {
  if (hiddenPastCardIds.length === 0) {
    return cards;
  }

  const hiddenPastCardIdSet = new Set(hiddenPastCardIds);
  return cards.filter((card) => {
    if (!hiddenPastCardIdSet.has(card.id)) {
      return true;
    }

    const statusGroup = getManagedStatusGroup(card, now);
    return statusGroup !== 'PAST' && statusGroup !== 'CONFIRMED';
  });
}

export function filterManagedCardsByHiddenReceivedReplyIds(
  cards: PromiseCard[],
  hiddenReceivedReplyCardIds: string[],
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): PromiseCard[] {
  if (hiddenReceivedReplyCardIds.length === 0) {
    return cards;
  }

  const hiddenReceivedReplyCardIdSet = new Set(hiddenReceivedReplyCardIds);
  return cards.filter((card) => !hiddenReceivedReplyCardIdSet.has(card.id) || getManagedCardScope(card) !== 'RECEIVED');
}

export function filterScheduleItemsByRemovedCardIds<T extends Pick<ScheduleItem, 'cardId'>>(
  scheduleItems: T[],
  removedCardIds: string[],
): T[] {
  if (removedCardIds.length === 0) {
    return scheduleItems;
  }

  const removedCardIdSet = new Set(removedCardIds);
  return scheduleItems.filter((item) => !removedCardIdSet.has(item.cardId));
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

export function getConfirmedCardSchedulePath(card: PromiseCard): ConfirmedCardSchedulePath {
  const selectedSlot = getPrimarySlot(card);

  if (!selectedSlot?.startsAt) {
    return '/schedule';
  }

  const startsAt = new Date(selectedSlot.startsAt);

  if (Number.isNaN(startsAt.getTime())) {
    return '/schedule';
  }

  return `/schedule?date=${toDateKey(startsAt)}`;
}

export function getManagedCardDeleteConfirmation(card: PromiseCard): ManagedCardDeleteConfirmation {
  if (card.status === 'CONFIRMED') {
    return getManagedCardOnlyDeleteConfirmation();
  }

  return {
    title: '카드 삭제',
    body: `${card.title} 카드를 삭제하고 관리함에서 제거할까요?`,
    confirmLabel: '삭제하기',
  };
}

export function getManagedCardOnlyDeleteConfirmation(): ManagedCardDeleteConfirmation {
  return {
    title: '카드 삭제',
    body: '관리함에서 카드만 삭제할까요? 일정에는 영향을 주지 않아요.',
    confirmLabel: '삭제',
  };
}

export function getManagedPastCardHideConfirmation(card: PromiseCard): ManagedCardDeleteConfirmation {
  return getManagedCardOnlyDeleteConfirmation();
}

export function getReceivedReplyCardHideConfirmation(): ManagedCardDeleteConfirmation {
  return getManagedCardOnlyDeleteConfirmation();
}

export function getCardScheduleDeleteConfirmation(
  item: Pick<ScheduleItem, 'title' | 'startsAt'>,
  now = new Date(),
): CardScheduleDeleteConfirmation {
  if (getScheduleCardManageGroup(item, now) === 'PAST') {
    return {
      title: '일정 삭제',
      body: '지난 약속을 삭제할까요?',
      confirmLabel: '삭제',
    };
  }

  return {
    title: '일정 삭제',
    body: `"${item.title}" 약속카드를 삭제할까요?`,
    confirmLabel: '삭제',
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
