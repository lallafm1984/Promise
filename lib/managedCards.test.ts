import { describe, expect, it } from 'vitest';

import {
  CARD_CORE_CHANGE_POLICY,
  buildCardCancellationMessage,
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  getDeliveredCardManageGroup,
  getDeliveredCardManagePath,
  getManagedCardDeleteConfirmation,
  getRecentReceivedCardStatuses,
  getScheduleCardManageGroup,
  getScheduleCardManagePath,
  removeManagedCardFromLocalState,
} from './managedCards';
import type { PromiseCard, ScheduleItem } from '@/types/promise';

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

function buildScheduleItem(startsAt: string): ScheduleItem {
  return {
    id: 'schedule-card',
    cardId: 'card-schedule',
    title: 'card schedule',
    startsAt,
    endsAt: startsAt,
    dateLabel: '6월 20일',
    timeLabel: '19:00',
    location: 'place',
    status: 'READY',
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

  it('uses the refreshed server card when a locally created card receives a remote status update', () => {
    const localPendingCard = buildCard('card-from-share', 'PENDING');
    const refreshedDeclinedCard = buildCard('card-from-share', 'DECLINED');

    const managedCards = mergeManagedCardsView([localPendingCard], [refreshedDeclinedCard], []);

    expect(managedCards).toEqual([refreshedDeclinedCard]);
    expect(managedCards[0].status).toBe('DECLINED');
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

  it('targets confirmed or past manage tabs from a card schedule item', () => {
    const now = new Date('2026-06-18T10:00:00.000Z');

    expect(getScheduleCardManageGroup(buildScheduleItem('2026-06-20T10:00:00.000Z'), now)).toBe('CONFIRMED');
    expect(getScheduleCardManageGroup(buildScheduleItem('2026-06-16T10:00:00.000Z'), now)).toBe('PAST');
    expect(getScheduleCardManagePath(buildScheduleItem('2026-06-20T10:00:00.000Z'), 'from-schedule', now)).toBe(
      '/manage?group=CONFIRMED&scroll=from-schedule',
    );
  });

  it('keeps declined received cards visible in the manage status tabs after refresh', () => {
    expect(getRecentReceivedCardStatuses()).toEqual(['PENDING', 'VOTING', 'DECLINED', 'CONFIRMED']);
  });

  it('builds confirmation copy before deleting a managed card', () => {
    expect(getManagedCardDeleteConfirmation(buildCard('dinner-card'))).toEqual({
      title: '카드 취소',
      body: 'dinner-card card 카드를 취소하고 관리함에서 제거할까요?',
      confirmLabel: '취소하기',
    });
  });

  it('treats time and location as core card changes that require a new share', () => {
    expect(CARD_CORE_CHANGE_POLICY.title).toContain('시간');
    expect(CARD_CORE_CHANGE_POLICY.title).toContain('장소');
    expect(CARD_CORE_CHANGE_POLICY.body).toContain('다시 공유');
  });

  it('builds a concise cancellation share message for card schedules', () => {
    expect(buildCardCancellationMessage(buildScheduleItem('2026-06-20T10:00:00.000Z'))).toBe(
      ['card schedule 일정이 취소 되었어요.', '', '언제: 6월 20일 19:00', '어디서: place'].join('\n'),
    );
  });
});
