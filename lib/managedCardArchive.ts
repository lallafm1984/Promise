import type { PromiseCard } from '@/types/promise';
import { getPreferredManagedCardSnapshot } from '@/lib/managedCards';

export interface ManagedCardArchiveState {
  localCards: PromiseCard[];
  removedCardIds: string[];
  hiddenPastCardIds: string[];
  hiddenReceivedReplyCardIds: string[];
  updatedAt: string | null;
}

interface ManagedCardArchivePayload extends ManagedCardArchiveState {
  version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPromiseCard(value: unknown): value is PromiseCard {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.mode === 'string' &&
    typeof value.status === 'string' &&
    typeof value.title === 'string' &&
    typeof value.sharedUrl === 'string' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.participants)
  );
}

export function buildManagedCardArchiveCache(state: ManagedCardArchiveState): string {
  return JSON.stringify({
    version: 1,
    localCards: state.localCards,
    removedCardIds: Array.from(new Set(state.removedCardIds)),
    hiddenPastCardIds: Array.from(new Set(state.hiddenPastCardIds)),
    hiddenReceivedReplyCardIds: Array.from(new Set(state.hiddenReceivedReplyCardIds)),
    updatedAt: state.updatedAt,
  } satisfies ManagedCardArchivePayload);
}

export function parseManagedCardArchiveCache(raw: string | null): ManagedCardArchiveState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    const localCards = Array.isArray(parsed.localCards) ? parsed.localCards.filter(isPromiseCard) : null;
    const removedCardIds = Array.isArray(parsed.removedCardIds)
      ? parsed.removedCardIds.filter((cardId): cardId is string => typeof cardId === 'string')
      : null;
    const hiddenPastCardIds = Array.isArray(parsed.hiddenPastCardIds)
      ? parsed.hiddenPastCardIds.filter((cardId): cardId is string => typeof cardId === 'string')
      : [];
    const hiddenReceivedReplyCardIds = Array.isArray(parsed.hiddenReceivedReplyCardIds)
      ? parsed.hiddenReceivedReplyCardIds.filter((cardId): cardId is string => typeof cardId === 'string')
      : [];

    if (!localCards || !removedCardIds) {
      return null;
    }

    return {
      localCards,
      removedCardIds: Array.from(new Set(removedCardIds)),
      hiddenPastCardIds: Array.from(new Set(hiddenPastCardIds)),
      hiddenReceivedReplyCardIds: Array.from(new Set(hiddenReceivedReplyCardIds)),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

export function mergeRemoteManagedCardsIntoArchive(
  localCards: PromiseCard[],
  remoteCards: PromiseCard[],
  removedCardIds: string[],
): PromiseCard[] {
  const removedCardIdSet = new Set(removedCardIds);
  const remoteCardsById = new Map(remoteCards.map((card) => [card.id, card]));
  const localCardIds = new Set(localCards.map((card) => card.id));

  return [
    ...localCards
      .filter((card) => !removedCardIdSet.has(card.id))
      .map((card) => {
        const remoteCard = remoteCardsById.get(card.id);
        return remoteCard ? getPreferredManagedCardSnapshot(card, remoteCard) : card;
      }),
    ...remoteCards.filter((card) => !removedCardIdSet.has(card.id) && !localCardIds.has(card.id)),
  ];
}
