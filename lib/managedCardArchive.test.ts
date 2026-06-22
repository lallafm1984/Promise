import { describe, expect, it } from 'vitest';

import {
  buildManagedCardArchiveCache,
  mergeRemoteManagedCardsIntoArchive,
  parseManagedCardArchiveCache,
} from './managedCardArchive';
import type { PromiseCard } from '@/types/promise';

function buildCard(id: string, status: PromiseCard['status'] = 'PENDING'): PromiseCard {
  return {
    id,
    mode: 'DIRECT',
    status,
    title: `${id} card`,
    hostName: 'host',
    location: 'place',
    message: '',
    sharedUrl: `https://promise.4ltree.com/c/${id}`,
    createdAt: '2026-06-20T10:00:00.000Z',
    expiresAt: '2026-06-23T10:00:00.000Z',
    candidates: [],
    participants: [],
  };
}

describe('managed card archive', () => {
  it('round-trips locally archived cards and removed ids', () => {
    const cache = buildManagedCardArchiveCache({
      localCards: [buildCard('card-1')],
      removedCardIds: ['removed-card'],
      hiddenPastCardIds: ['past-card'],
      hiddenReceivedReplyCardIds: ['replied-card'],
      updatedAt: '2026-06-20T10:00:00.000Z',
    });

    expect(parseManagedCardArchiveCache(cache)).toEqual({
      localCards: [buildCard('card-1')],
      removedCardIds: ['removed-card'],
      hiddenPastCardIds: ['past-card'],
      hiddenReceivedReplyCardIds: ['replied-card'],
      updatedAt: '2026-06-20T10:00:00.000Z',
    });
  });

  it('defaults hidden id lists for older archive caches', () => {
    const cache = JSON.stringify({
      version: 1,
      localCards: [buildCard('card-1')],
      removedCardIds: ['removed-card'],
      updatedAt: '2026-06-20T10:00:00.000Z',
    });

    expect(parseManagedCardArchiveCache(cache)?.hiddenPastCardIds).toEqual([]);
    expect(parseManagedCardArchiveCache(cache)?.hiddenReceivedReplyCardIds).toEqual([]);
  });

  it('ignores malformed archives instead of crashing hydration', () => {
    expect(parseManagedCardArchiveCache('{bad json')).toBeNull();
    expect(parseManagedCardArchiveCache(JSON.stringify({ version: 2, localCards: [] }))).toBeNull();
  });

  it('stores remote cards locally so the app can keep showing them after server cleanup', () => {
    const localCard = buildCard('local-card');
    const remoteCard = buildCard('remote-card', 'VOTING');

    expect(mergeRemoteManagedCardsIntoArchive([localCard], [remoteCard], []).map((card) => card.id)).toEqual([
      'local-card',
      'remote-card',
    ]);
  });

  it('applies remote status updates to already archived cards', () => {
    const localPending = buildCard('card-1', 'PENDING');
    const remoteConfirmed = buildCard('card-1', 'CONFIRMED');

    expect(mergeRemoteManagedCardsIntoArchive([localPending], [remoteConfirmed], [])[0]).toEqual(remoteConfirmed);
  });

  it('does not restore cards the user removed locally', () => {
    expect(mergeRemoteManagedCardsIntoArchive([], [buildCard('removed-card')], ['removed-card'])).toEqual([]);
  });
});
