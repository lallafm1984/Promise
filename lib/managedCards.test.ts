import { describe, expect, it } from 'vitest';

import {
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  getDeliveredCardManageGroup,
  getDeliveredCardManagePath,
  getManagedCardDeleteConfirmation,
  removeManagedCardFromLocalState,
} from './managedCards';
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
    sharedUrl: `https://whenbollae.app/c/${id}`,
    createdAt: '2026-06-17T16:00:00+09:00',
    candidates: [],
    participants: [],
  };
}

describe('managed card local state', () => {
  it('keeps a locally saved preview card first so manage shows it while remote sync is unavailable', () => {
    const previewCard = buildCard('preview-card');
    const recentCard = buildCard('recent-card', 'VOTING');

    const localCards = mergeManagedCardIntoLocalCards([], previewCard);
    const managedCards = mergeManagedCardsView(localCards, [recentCard], []);

    expect(managedCards.map((card) => card.id)).toEqual(['preview-card', 'recent-card']);
    expect(managedCards[0].status).toBe('PENDING');
  });

  it('replaces an optimistic card with the saved card without leaving duplicates', () => {
    const previewCard = buildCard('preview-card');
    const savedCard = buildCard('saved-card');

    const localCards = mergeManagedCardIntoLocalCards([previewCard], savedCard, previewCard.id);

    expect(localCards.map((card) => card.id)).toEqual(['saved-card']);
  });

  it('adds recipient profile ids without duplicating existing recipients', () => {
    const card = {
      ...buildCard('preview-card'),
      recipientProfileIds: ['profile-jiu'],
    };

    expect(mergeRecipientProfileIds(card, ['profile-jiu', 'profile-seoa']).recipientProfileIds).toEqual([
      'profile-jiu',
      'profile-seoa',
    ]);
  });

  it('hides a card from both local and recent cards after delete is requested', () => {
    const localCard = buildCard('local-card');
    const recentCard = buildCard('recent-card');

    const removedState = removeManagedCardFromLocalState([localCard], [], localCard.id);
    const removedRecentState = removeManagedCardFromLocalState(removedState.localCards, removedState.removedCardIds, recentCard.id);
    const managedCards = mergeManagedCardsView(removedRecentState.localCards, [recentCard], removedRecentState.removedCardIds);

    expect(removedRecentState.localCards).toEqual([]);
    expect(removedRecentState.removedCardIds).toEqual(['local-card', 'recent-card']);
    expect(managedCards).toEqual([]);
  });

  it('targets the manage tab that contains the delivered card', () => {
    expect(getDeliveredCardManageGroup(buildCard('direct-card', 'PENDING'))).toBe('PENDING');
    expect(getDeliveredCardManageGroup(buildCard('poll-card', 'VOTING'))).toBe('VOTING');
    expect(getDeliveredCardManagePath(buildCard('direct-card', 'PENDING'), 'after-create')).toBe(
      '/manage?group=PENDING&scroll=after-create',
    );
  });

  it('builds confirmation copy before deleting a managed card', () => {
    expect(getManagedCardDeleteConfirmation(buildCard('dinner-card'))).toEqual({
      title: '카드 삭제',
      body: 'dinner-card card 카드를 삭제할까요?',
      confirmLabel: '삭제',
    });
  });
});
