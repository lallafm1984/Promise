import { describe, expect, it } from 'vitest';

import {
  CARD_CORE_CHANGE_POLICY,
  buildCardCancellationMessage,
  getCardScheduleDeleteConfirmation,
  filterScheduleItemsByRemovedCardIds,
  mergeManagedCardIntoLocalCards,
  mergeManagedCardsView,
  mergeRecipientProfileIds,
  getDeliveredCardManageGroup,
  getDeliveredCardManagePath,
  getConfirmedCardSchedulePath,
  getManagedCardDeleteConfirmation,
  getManagedPastCardHideConfirmation,
  getRecentReceivedCardStatuses,
  getReceivedReplyCardHideConfirmation,
  getScheduleCardManageGroup,
  getScheduleCardManagePath,
  hideManagedPastCardFromLocalState,
  hideReceivedRepliedCardFromLocalState,
  filterManagedCardsByHiddenPastIds,
  filterManagedCardsByHiddenReceivedReplyIds,
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

  it('keeps a local received reply when the cached remote card has not caught up yet', () => {
    const staleRemoteCard = {
      ...buildCard('received-card', 'PENDING'),
      requesterName: 'sender',
      candidates: [
        {
          id: 'slot-1',
          startsAt: '2026-06-20T10:00:00.000Z',
          endsAt: '2026-06-20T11:00:00.000Z',
          label: '6월 20일 19:00',
          shortLabel: '6/20',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
        },
      ],
      participants: [],
    };
    const localNoReplyCard = {
      ...staleRemoteCard,
      candidates: [
        {
          ...staleRemoteCard.candidates[0],
          summary: { yes: 0, maybe: 0, no: 1, unanswered: 0 },
        },
      ],
      participants: [
        {
          id: 'host-minseo',
          name: '민',
          displayName: '민서',
          color: '#FFD6E7',
          choice: 'NO' as const,
          responses: [{ candidateId: 'slot-1', choice: 'NO' as const }],
        },
      ],
    };

    const managedCards = mergeManagedCardsView([localNoReplyCard], [staleRemoteCard], []);

    expect(managedCards).toEqual([localNoReplyCard]);
  });

  it('uses the refreshed confirmed status for a received card after the sender confirms it', () => {
    const localRepliedCard = {
      ...buildCard('received-card', 'PENDING'),
      requesterName: 'sender',
      candidates: [
        {
          id: 'slot-1',
          startsAt: '2026-06-20T10:00:00.000Z',
          endsAt: '2026-06-20T11:00:00.000Z',
          label: '6??20??19:00',
          shortLabel: '6/20',
          summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 },
        },
      ],
      participants: [
        {
          id: 'profile-jiu',
          name: '지',
          displayName: '지우',
          color: '#DDEBFF',
          choice: 'YES' as const,
          responses: [{ candidateId: 'slot-1', choice: 'YES' as const }],
        },
      ],
    };
    const remoteConfirmedCard = {
      ...localRepliedCard,
      status: 'CONFIRMED' as const,
      selectedSlotId: 'slot-1',
      participants: [],
    };

    const managedCards = mergeManagedCardsView([localRepliedCard], [remoteConfirmedCard], []);

    expect(managedCards[0]).toMatchObject({
      id: 'received-card',
      status: 'CONFIRMED',
      selectedSlotId: 'slot-1',
    });
    expect(managedCards[0].participants).toEqual(localRepliedCard.participants);
  });

  it('uses the refreshed server card when received card candidates changed after an edit', () => {
    const localNoReplyCard = {
      ...buildCard('received-card', 'PENDING'),
      requesterName: 'sender',
      candidates: [
        {
          id: 'old-slot',
          startsAt: '2026-06-20T10:00:00.000Z',
          endsAt: '2026-06-20T11:00:00.000Z',
          label: '6월 20일 19:00',
          shortLabel: '6/20',
          summary: { yes: 0, maybe: 0, no: 1, unanswered: 0 },
        },
      ],
      participants: [
        {
          id: 'host-minseo',
          name: '민',
          displayName: '민서',
          color: '#FFD6E7',
          choice: 'NO' as const,
          responses: [{ candidateId: 'old-slot', choice: 'NO' as const }],
        },
      ],
    };
    const refreshedCard = {
      ...localNoReplyCard,
      candidates: [
        {
          ...localNoReplyCard.candidates[0],
          id: 'new-slot',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
        },
      ],
      participants: [],
    };

    const managedCards = mergeManagedCardsView([localNoReplyCard], [refreshedCard], []);

    expect(managedCards).toEqual([refreshedCard]);
  });

  it('uses the refreshed server card when a received card keeps a candidate id but changes the time', () => {
    const localNoReplyCard = {
      ...buildCard('received-card', 'PENDING'),
      requesterName: 'sender',
      candidates: [
        {
          id: 'slot-1',
          startsAt: '2026-06-20T10:00:00.000Z',
          endsAt: '2026-06-20T11:00:00.000Z',
          label: '6월 20일 19:00',
          shortLabel: '6/20',
          summary: { yes: 0, maybe: 0, no: 1, unanswered: 0 },
        },
      ],
      participants: [
        {
          id: 'host-minseo',
          name: '민',
          displayName: '민서',
          color: '#FFD6E7',
          choice: 'NO' as const,
          responses: [{ candidateId: 'slot-1', choice: 'NO' as const }],
        },
      ],
    };
    const refreshedCard = {
      ...localNoReplyCard,
      candidates: [
        {
          ...localNoReplyCard.candidates[0],
          startsAt: '2026-06-21T10:00:00.000Z',
          endsAt: '2026-06-21T11:00:00.000Z',
          label: '6월 21일 19:00',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
        },
      ],
      participants: [],
    };

    const managedCards = mergeManagedCardsView([localNoReplyCard], [refreshedCard], []);

    expect(managedCards).toEqual([refreshedCard]);
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

  it('hides deleted card schedules while the server snapshot still contains them', () => {
    const cardSchedule = buildScheduleItem('2026-06-20T10:00:00.000Z');
    const visibleSchedule = {
      ...buildScheduleItem('2026-06-21T10:00:00.000Z'),
      id: 'visible-schedule',
      cardId: 'visible-card',
    };

    expect(filterScheduleItemsByRemovedCardIds([cardSchedule, visibleSchedule], ['card-schedule'])).toEqual([
      visibleSchedule,
    ]);
  });

  it('targets the manage tab that contains the delivered card', () => {
    expect(getDeliveredCardManageGroup(buildCard('direct-card', 'PENDING'))).toBe('PENDING');
    expect(getDeliveredCardManageGroup(buildCard('poll-card', 'VOTING'))).toBe('VOTING');
    expect(getDeliveredCardManagePath(buildCard('direct-card', 'PENDING'), 'after-create')).toBe(
      '/manage?group=PENDING&scroll=after-create',
    );
  });

  it('hides past appointments from manage without marking their schedules as removed', () => {
    const pastCard = {
      ...buildCard('past-card', 'CONFIRMED'),
      candidates: [
        {
          id: 'past-slot',
          startsAt: '2026-06-16T10:00:00.000Z',
          endsAt: '2026-06-16T11:00:00.000Z',
          label: '6월 16일 19:00',
          shortLabel: '6월 16일',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 0 },
        },
      ],
    };
    const futureCard = {
      ...pastCard,
      id: 'future-card',
      candidates: [{ ...pastCard.candidates[0], startsAt: '2026-06-20T10:00:00.000Z' }],
    };
    const hiddenState = hideManagedPastCardFromLocalState([], pastCard, new Date('2026-06-18T10:00:00.000Z'));

    expect(hiddenState.hiddenPastCardIds).toEqual(['past-card']);
    expect(hiddenState.removedCardIds).toEqual([]);
    expect(filterManagedCardsByHiddenPastIds([pastCard, futureCard], hiddenState.hiddenPastCardIds, new Date('2026-06-18T10:00:00.000Z'))).toEqual([
      futureCard,
    ]);
    expect(filterScheduleItemsByRemovedCardIds([buildScheduleItem('2026-06-16T10:00:00.000Z')], hiddenState.removedCardIds)).toHaveLength(1);

    const futureHiddenState = hideManagedPastCardFromLocalState([], futureCard, new Date('2026-06-18T10:00:00.000Z'));

    expect(futureHiddenState.hiddenPastCardIds).toEqual(['future-card']);
    expect(futureHiddenState.removedCardIds).toEqual([]);
    expect(filterManagedCardsByHiddenPastIds([futureCard], futureHiddenState.hiddenPastCardIds, new Date('2026-06-18T10:00:00.000Z'))).toEqual([]);
    expect(filterScheduleItemsByRemovedCardIds([buildScheduleItem('2026-06-20T10:00:00.000Z')], futureHiddenState.removedCardIds)).toHaveLength(1);
  });

  it('hides received cards across received tabs without marking schedules removed', () => {
    const currentProfile = { id: 'profile-minseo', displayName: '민서' };
    const repliedCard: PromiseCard = {
      ...buildCard('received-replied-card', 'PENDING'),
      requesterName: '하린',
      participants: [
        {
          id: currentProfile.id,
          name: '민',
          displayName: currentProfile.displayName,
          color: '#FFD6E7',
          choice: 'NO',
        },
      ],
    };
    const confirmedCard: PromiseCard = {
      ...repliedCard,
      status: 'CONFIRMED',
    };
    const visibleNeedsReplyCard: PromiseCard = {
      ...buildCard('needs-reply-card', 'PENDING'),
      requesterName: '하린',
      participants: [],
    };
    const hiddenState = hideReceivedRepliedCardFromLocalState([], repliedCard, new Date('2026-06-18T10:00:00.000Z'), currentProfile);

    expect(hiddenState.hiddenReceivedReplyCardIds).toEqual([repliedCard.id]);
    expect(hiddenState.removedCardIds).toEqual([]);
    expect(
      filterManagedCardsByHiddenReceivedReplyIds(
        [repliedCard, visibleNeedsReplyCard],
        hiddenState.hiddenReceivedReplyCardIds,
        new Date('2026-06-18T10:00:00.000Z'),
        currentProfile,
      ),
    ).toEqual([visibleNeedsReplyCard]);
    expect(
      filterManagedCardsByHiddenReceivedReplyIds(
        [confirmedCard],
        hiddenState.hiddenReceivedReplyCardIds,
        new Date('2026-06-18T10:00:00.000Z'),
        currentProfile,
      ),
    ).toEqual([]);

    const hiddenNeedsReplyState = hideReceivedRepliedCardFromLocalState(
      [],
      visibleNeedsReplyCard,
      new Date('2026-06-18T10:00:00.000Z'),
      currentProfile,
    );

    expect(hiddenNeedsReplyState.hiddenReceivedReplyCardIds).toEqual([visibleNeedsReplyCard.id]);
    expect(hiddenNeedsReplyState.removedCardIds).toEqual([]);
    expect(
      filterManagedCardsByHiddenReceivedReplyIds(
        [visibleNeedsReplyCard],
        hiddenNeedsReplyState.hiddenReceivedReplyCardIds,
        new Date('2026-06-18T10:00:00.000Z'),
        currentProfile,
      ),
    ).toEqual([]);
    expect(filterScheduleItemsByRemovedCardIds([buildScheduleItem('2026-06-20T10:00:00.000Z')], hiddenState.removedCardIds)).toHaveLength(1);
  });

  it('targets confirmed or past manage tabs from a card schedule item', () => {
    const now = new Date('2026-06-18T10:00:00.000Z');

    expect(getScheduleCardManageGroup(buildScheduleItem('2026-06-20T10:00:00.000Z'), now)).toBe('CONFIRMED');
    expect(getScheduleCardManageGroup(buildScheduleItem('2026-06-16T10:00:00.000Z'), now)).toBe('PAST');
    expect(getScheduleCardManagePath(buildScheduleItem('2026-06-20T10:00:00.000Z'), 'from-schedule', now)).toBe(
      '/manage?group=CONFIRMED&scroll=from-schedule',
    );
  });

  it('targets the selected schedule date from a confirmed card', () => {
    const card = {
      ...buildCard('confirmed-card', 'CONFIRMED'),
      selectedSlotId: 'selected-slot',
      candidates: [
        {
          id: 'first-slot',
          startsAt: '2026-06-19T19:00:00',
          endsAt: '2026-06-19T20:00:00',
          label: '6월 19일 19:00',
          shortLabel: '6월 19일',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 0 },
        },
        {
          id: 'selected-slot',
          startsAt: '2026-06-20T20:00:00',
          endsAt: '2026-06-20T21:00:00',
          label: '6월 20일 20:00',
          shortLabel: '6월 20일',
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 0 },
        },
      ],
    };

    expect(getConfirmedCardSchedulePath(card)).toBe('/schedule?date=2026-06-20');
  });

  it('keeps declined received cards visible in the manage status tabs after refresh', () => {
    expect(getRecentReceivedCardStatuses()).toEqual(['PENDING', 'VOTING', 'DECLINED', 'CONFIRMED']);
  });

  it('builds confirmation copy before deleting a managed card', () => {
    expect(getManagedCardDeleteConfirmation(buildCard('dinner-card'))).toEqual({
      title: '카드 삭제',
      body: 'dinner-card card 카드를 삭제하고 관리함에서 제거할까요?',
      confirmLabel: '삭제하기',
    });
  });

  it('builds confirmation copy before hiding a past managed card', () => {
    expect(getManagedPastCardHideConfirmation(buildCard('past-card', 'CONFIRMED'))).toEqual({
      title: '카드 삭제',
      body: '관리함에서 카드만 삭제할까요? 일정에는 영향을 주지 않아요.',
      confirmLabel: '삭제',
    });
  });

  it('builds confirmation copy before hiding a replied received card', () => {
    expect(getReceivedReplyCardHideConfirmation()).toEqual({
      title: '카드 삭제',
      body: '관리함에서 카드만 삭제할까요? 일정에는 영향을 주지 않아요.',
      confirmLabel: '삭제',
    });
  });

  it('builds delete-only confirmation copy for confirmed card schedules', () => {
    expect(getCardScheduleDeleteConfirmation({ title: '6월 20일 19:00에 성수에서 볼래?' })).toEqual({
      title: '일정 삭제',
      body: '"6월 20일 19:00에 성수에서 볼래?" 약속카드를 삭제할까요?',
      confirmLabel: '삭제',
    });
    expect(getManagedCardDeleteConfirmation(buildCard('confirmed-card', 'CONFIRMED'))).toEqual({
      title: '카드 삭제',
      body: '관리함에서 카드만 삭제할까요? 일정에는 영향을 주지 않아요.',
      confirmLabel: '삭제',
    });
  });

  it('builds a delete-only confirmation for past card schedules', () => {
    expect(
      getCardScheduleDeleteConfirmation(
        { title: '6월 20일 19:00에 성수에서 볼래?', startsAt: '2026-06-16T10:00:00.000Z' },
        new Date('2026-06-18T10:00:00.000Z'),
      ),
    ).toEqual({
      title: '일정 삭제',
      body: '지난 약속을 삭제할까요?',
      confirmLabel: '삭제',
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
