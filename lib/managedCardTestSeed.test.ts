import { describe, expect, it } from 'vitest';

import {
  buildPastAppointmentLocalSeedCards,
  isPastAppointmentLocalSeedEnabled,
  mergePastAppointmentLocalSeedArchive,
} from './managedCardTestSeed';
import type { ManagedCardArchiveState } from './managedCardArchive';

const now = new Date('2026-06-21T12:00:00+09:00');

function emptyArchive(): ManagedCardArchiveState {
  return {
    localCards: [],
    removedCardIds: [],
    hiddenPastCardIds: [],
    hiddenReceivedReplyCardIds: [],
    updatedAt: null,
  };
}

describe('managed card local past appointment seed', () => {
  it('only enables the seed when the release build opts in', () => {
    expect(isPastAppointmentLocalSeedEnabled({ EXPO_PUBLIC_PROMISE_SEED_PAST_APPOINTMENTS: '1' })).toBe(true);
    expect(isPastAppointmentLocalSeedEnabled({ EXPO_PUBLIC_PROMISE_SEED_PAST_APPOINTMENTS: '0' })).toBe(false);
  });

  it('builds confirmed past cards for sent and received past tabs', () => {
    const cards = buildPastAppointmentLocalSeedCards({ batchId: 'test-batch', now });

    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.status === 'CONFIRMED')).toBe(true);
    expect(cards.every((card) => new Date(card.candidates[0].startsAt) < now)).toBe(true);
    expect(cards.some((card) => card.requesterName)).toBe(true);
    expect(cards.some((card) => !card.requesterName)).toBe(true);
  });

  it('merges seed cards into the local archive without duplicates', () => {
    const archive = mergePastAppointmentLocalSeedArchive(emptyArchive(), { batchId: 'test-batch', now });
    const mergedAgain = mergePastAppointmentLocalSeedArchive(archive, { batchId: 'test-batch', now });

    expect(archive.localCards).toHaveLength(3);
    expect(mergedAgain.localCards.map((card) => card.id)).toEqual(archive.localCards.map((card) => card.id));
  });

  it('does not restore a seed card that was deleted from schedules', () => {
    const seedCard = buildPastAppointmentLocalSeedCards({ batchId: 'test-batch', now })[0];
    const archive = mergePastAppointmentLocalSeedArchive(
      {
        ...emptyArchive(),
        removedCardIds: [seedCard.id],
      },
      { batchId: 'test-batch', now },
    );

    expect(archive.localCards.map((card) => card.id)).not.toContain(seedCard.id);
    expect(archive.localCards).toHaveLength(2);
  });
});
