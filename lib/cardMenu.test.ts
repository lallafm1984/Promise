import { describe, expect, it } from 'vitest';

import type { PromiseCard } from '@/types/promise';
import {
  buildShareMessage,
  buildConfirmedCard,
  buildScheduleItemFromConfirmedCard,
  applyReceivedCardResponse,
  canDeleteManagedCard,
  compactDraftTimes,
  createDefaultCardDraft,
  createDefaultDraftTimes,
  ensureDraftTimeCount,
  formatCandidateResponseSummary,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
  getGeneratedCardTitle,
  getManagedCardAction,
  getManagedCardInboxTab,
  getManagedCardResponseStats,
  getManagedCardScope,
  getManagedCardTabLabel,
  getManagedCardRowMetaLabel,
  getManagedStatusGroup,
  getModeLabel,
  getRecipientProfileIds,
  getShareUrlForClipboard,
  getShareUrlForMessage,
  mergeManagedCards,
  mergeDraftDatePart,
  mergeDraftTimePart,
  removeDraftTimeAtIndex,
  validateCardDraft,
} from './cardMenu';

function localIso(month: number, day: number, hours: number, minutes: number): string {
  return new Date(2026, month - 1, day, hours, minutes, 0, 0).toISOString();
}

const june14At1930 = localIso(6, 14, 19, 30);
const june15At2000 = localIso(6, 15, 20, 0);

const baseCard: PromiseCard = {
  id: 'card-test',
  mode: 'DIRECT',
  status: 'PENDING',
  title: '6월 14일 19:30에 성수 카페에서 볼래?',
  hostName: '민서',
  location: '성수 카페',
  message: '가볍게 한 시간만 보자',
  sharedUrl: 'https://whenbollae.app/c/card-test',
  createdAt: '2026-06-12T09:00:00+09:00',
  selectedSlotId: 'slot-1',
  candidates: [
      {
        id: 'slot-1',
        startsAt: june14At1930,
        endsAt: getCandidateEndsAt(june14At1930),
        label: '6월 14일 19:30',
        shortLabel: '6.14 19:30',
        summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
    },
  ],
  participants: [],
};

describe('card menu helpers', () => {
  it('creates a fresh default card draft after a delivered card flow finishes', () => {
    const baseDate = new Date('2026-06-17T09:00:00+09:00');

    expect(createDefaultCardDraft(baseDate)).toEqual({
      mode: 'DIRECT',
      times: createDefaultDraftTimes(2, baseDate),
      location: '',
      message: '',
    });
  });

  it('creates different default candidate times for poll options', () => {
    const baseDate = new Date('2026-06-17T09:00:00+09:00');
    const defaultTimes = createDefaultDraftTimes(3, baseDate);
    const defaultHours = defaultTimes.map((time) => new Date(time).getHours());

    expect(new Set(defaultTimes).size).toBe(3);
    expect(defaultHours).toEqual([19, 20, 21]);
  });

  it('labels the two creation modes with approved product names', () => {
    expect(getModeLabel('DIRECT')).toBe('이때볼래?');
    expect(getModeLabel('POLL')).toBe('언제볼래?');
  });

  it('validates direct cards with one time and one place', () => {
    expect(validateCardDraft({ mode: 'DIRECT', times: [june14At1930], location: '성수 카페', message: '' })).toEqual({
      valid: true,
    });

    expect(validateCardDraft({ mode: 'DIRECT', times: [''], location: '성수 카페', message: '' })).toEqual({
      valid: false,
      error: '만날 시간을 골라주세요.',
    });

    expect(validateCardDraft({ mode: 'DIRECT', times: [june14At1930], location: '', message: '' })).toEqual({
      valid: false,
      error: '만날 장소를 적어주세요.',
    });
  });

  it('requires two candidate times for poll cards', () => {
    expect(validateCardDraft({ mode: 'POLL', times: [june14At1930], location: '성수 카페', message: '' })).toEqual({
      valid: false,
      error: '언제볼래?는 후보 시간이 2개 이상 필요해요.',
    });

    expect(
      validateCardDraft({
        mode: 'POLL',
        times: [june14At1930, june14At1930],
        location: '성수 카페',
        message: '',
      }),
    ).toEqual({
      valid: false,
      error: '후보 시간을 서로 다르게 입력해 주세요.',
    });

    expect(
      validateCardDraft({
        mode: 'POLL',
        times: [june14At1930, june15At2000],
        location: '성수 카페',
        message: '',
      }),
    ).toEqual({ valid: true });
  });

  it('keeps poll deletion on candidate 2+ and switches to direct when one time remains', () => {
    expect(removeDraftTimeAtIndex('POLL', [june14At1930, june15At2000, localIso(6, 16, 19, 0)], 1)).toEqual({
      mode: 'POLL',
      times: [june14At1930, localIso(6, 16, 19, 0)],
    });

    expect(removeDraftTimeAtIndex('POLL', [june14At1930, june15At2000], 1)).toEqual({
      mode: 'DIRECT',
      times: [june14At1930],
    });
  });

  it('generates direct and poll titles from time and place only', () => {
    expect(getGeneratedCardTitle({ mode: 'DIRECT', times: [june14At1930], location: '성수 카페', message: '' })).toBe(
      '6월 14일 19:30에 성수 카페에서 볼래?',
    );

    expect(
      getGeneratedCardTitle({
        mode: 'POLL',
        times: [june14At1930, june15At2000],
        location: '성수 카페',
        message: '',
      }),
    ).toBe('성수 카페에서 언제볼래?');
  });

  it('keeps draft times as valid timestamps while formatting labels for cards', () => {
    expect(compactDraftTimes([june14At1930, '', 'not-a-date'])).toEqual([june14At1930]);
    expect(ensureDraftTimeCount([june14At1930], 2)).toHaveLength(2);
    expect(formatDraftDateTimeLabel(june14At1930)).toBe('6월 14일 19:30');
    expect(formatDraftDateTimeShortLabel(june14At1930)).toBe('6/14 19:30');
    expect(mergeDraftDatePart(june14At1930, '2026-06-20')).toBe(localIso(6, 20, 19, 30));
    expect(mergeDraftTimePart(june14At1930, '20:15')).toBe(localIso(6, 14, 20, 15));
    expect(getCandidateEndsAt(june14At1930)).toBe(localIso(6, 14, 20, 30));
  });

  it('formats candidate response summaries without the removed maybe option', () => {
    expect(formatCandidateResponseSummary({ yes: 2, maybe: 4, no: 1, unanswered: 0 })).toBe('가능 2 · 어려움 1');
  });

  it('groups managed cards by status and keeps declined cards separate from past appointments', () => {
    expect(getManagedStatusGroup({ ...baseCard, status: 'PENDING' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(
      'PENDING',
    );
    expect(getManagedStatusGroup({ ...baseCard, status: 'VOTING' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(
      'VOTING',
    );
    expect(getManagedStatusGroup({ ...baseCard, status: 'CONFIRMED' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(
      'CONFIRMED',
    );
    expect(
      getManagedStatusGroup(
        {
          ...baseCard,
          status: 'CONFIRMED',
          candidates: [{ ...baseCard.candidates[0], startsAt: localIso(6, 1, 19, 30) }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toBe('PAST');
    expect(
      getManagedStatusGroup(
        {
          ...baseCard,
          status: 'DECLINED',
          candidates: [{ ...baseCard.candidates[0], startsAt: localIso(6, 1, 19, 30) }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toBe('DECLINED');
  });

  it('returns exactly one representative action per managed status group', () => {
    expect(getManagedCardAction({ ...baseCard, status: 'PENDING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'RESHARE',
      label: '공유 다시하기',
    });
    expect(
      getManagedCardAction(
        {
          ...baseCard,
          status: 'PENDING',
          participants: [{ id: 'respondent-1', name: '민', displayName: '민지', color: '#FFD6E7', choice: 'YES' }],
          candidates: [{ ...baseCard.candidates[0], summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 } }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toEqual({
      kind: 'RESULTS',
      label: '결과 보기',
    });
    expect(getManagedCardAction({ ...baseCard, status: 'VOTING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'RESHARE',
      label: '공유 다시하기',
    });
    expect(getManagedCardAction({ ...baseCard, status: 'CONFIRMED' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'SCHEDULE',
      label: '일정 보기',
    });
    expect(getManagedCardAction({ ...baseCard, status: 'DECLINED' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'RECREATE',
      label: '다시 만들기',
    });
    expect(
      getManagedCardAction(
        {
          ...baseCard,
          status: 'DECLINED',
          participants: [{ id: 'respondent-1', name: '민', displayName: '민지', color: '#FFD6E7', choice: 'NO' }],
          candidates: [{ ...baseCard.candidates[0], summary: { yes: 0, maybe: 0, no: 1, unanswered: 0 } }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toEqual({
      kind: 'RESULTS',
      label: '결과 보기',
    });
    expect(
      getManagedCardAction(
        {
          ...baseCard,
          status: 'CONFIRMED',
          candidates: [{ ...baseCard.candidates[0], startsAt: localIso(6, 1, 19, 30) }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toEqual({
      kind: 'RECREATE',
      label: '다시 만들기',
    });
  });

  it('splits managed cards into sender and receiver friendly tabs', () => {
    const ownerNoResponseCard: PromiseCard = {
      ...baseCard,
      status: 'PENDING',
      participants: [],
      candidates: [{ ...baseCard.candidates[0], summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 } }],
    };
    const ownerRespondedCard: PromiseCard = {
      ...baseCard,
      status: 'PENDING',
      participants: [{ id: 'respondent-1', name: '민', displayName: '민지', color: '#FFD6E7', choice: 'NO' }],
      candidates: [{ ...baseCard.candidates[0], summary: { yes: 0, maybe: 0, no: 1, unanswered: 0 } }],
    };
    const receivedNeedsReplyCard: PromiseCard = {
      ...baseCard,
      requesterName: '하린',
      participants: [{ id: 'other-profile', name: '지', displayName: '지우', color: '#CFF3E3', choice: 'YES' }],
    };
    const receivedRepliedCard: PromiseCard = {
      ...receivedNeedsReplyCard,
      participants: [
        { id: 'my-profile', name: '민', displayName: '민서', color: '#FFD6E7', choice: 'YES' },
        { id: 'other-profile', name: '지', displayName: '지우', color: '#CFF3E3', choice: 'NO' },
      ],
    };

    expect(getManagedCardScope(ownerNoResponseCard)).toBe('SENT');
    expect(getManagedCardScope(receivedNeedsReplyCard)).toBe('RECEIVED');
    expect(getManagedCardInboxTab(ownerNoResponseCard, new Date('2026-06-12T12:00:00+09:00'))).toBe(
      'SENT_NO_RESPONSE',
    );
    expect(getManagedCardInboxTab(ownerRespondedCard, new Date('2026-06-12T12:00:00+09:00'))).toBe(
      'SENT_HAS_RESPONSE',
    );
    expect(
      getManagedCardInboxTab(receivedNeedsReplyCard, new Date('2026-06-12T12:00:00+09:00'), {
        id: 'my-profile',
        displayName: '민서',
      }),
    ).toBe('RECEIVED_NEEDS_REPLY');
    expect(
      getManagedCardInboxTab(receivedRepliedCard, new Date('2026-06-12T12:00:00+09:00'), {
        id: 'my-profile',
        displayName: '민서',
      }),
    ).toBe('RECEIVED_REPLIED');
  });

  it('builds compact response counts for managed card rows', () => {
    const respondedCard: PromiseCard = {
      ...baseCard,
      participants: [
        { id: 'respondent-1', name: '민', displayName: '민지', color: '#FFD6E7', choice: 'YES' },
        { id: 'respondent-2', name: '지', displayName: '지우', color: '#CFF3E3', choice: 'NO' },
        { id: 'respondent-3', name: '수', displayName: '수아', color: '#FFF0B8', choice: 'UNANSWERED' },
      ],
    };

    expect(getManagedCardResponseStats(respondedCard)).toEqual({
      total: 2,
      yes: 1,
      maybe: 0,
      no: 1,
      unanswered: 1,
    });
    expect(getManagedCardRowMetaLabel(respondedCard)).toBe('응답 2명 · 가능 1 · 어려움 1');
    expect(getManagedCardRowMetaLabel({ ...baseCard, participants: [] })).toBe('아직 응답 없음');
    expect(getManagedCardTabLabel('SENT_HAS_RESPONSE')).toBe('응답 도착');
  });

  it('opens received cards instead of owner-only management actions', () => {
    const receivedCard: PromiseCard = {
      ...baseCard,
      requesterName: '하린',
    };

    expect(getManagedCardAction({ ...receivedCard, status: 'PENDING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'OPEN_RECEIVED',
      label: '카드 열기',
    });
    expect(getManagedCardAction({ ...receivedCard, status: 'VOTING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'OPEN_RECEIVED',
      label: '카드 열기',
    });
    expect(getManagedCardAction({ ...receivedCard, status: 'CONFIRMED' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'SCHEDULE',
      label: '일정 보기',
    });
    expect(
      getManagedCardAction(
        {
          ...receivedCard,
          status: 'CONFIRMED',
          candidates: [{ ...receivedCard.candidates[0], startsAt: localIso(6, 1, 19, 30) }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toEqual({
      kind: 'OPEN_RECEIVED',
      label: '카드 열기',
    });
  });

  it('allows deleting only active unconfirmed managed cards from manage', () => {
    const pastOwnerCard: PromiseCard = {
      ...baseCard,
      status: 'CONFIRMED',
      candidates: [{ ...baseCard.candidates[0], startsAt: localIso(6, 1, 19, 30) }],
    };
    const pastReceivedCard: PromiseCard = {
      ...pastOwnerCard,
      requesterName: '하린',
    };

    expect(canDeleteManagedCard(pastOwnerCard, new Date('2026-06-12T12:00:00+09:00'))).toBe(false);
    expect(canDeleteManagedCard({ ...baseCard, status: 'PENDING' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(true);
    expect(canDeleteManagedCard({ ...baseCard, status: 'VOTING' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(true);
    expect(
      canDeleteManagedCard(
        { ...baseCard, requesterName: '하린', status: 'PENDING' },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toBe(false);
    expect(canDeleteManagedCard({ ...baseCard, status: 'DECLINED' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(false);
    expect(canDeleteManagedCard({ ...baseCard, status: 'CONFIRMED' }, new Date('2026-06-12T12:00:00+09:00'))).toBe(false);
    expect(canDeleteManagedCard(pastReceivedCard, new Date('2026-06-12T12:00:00+09:00'))).toBe(false);
  });

  it('merges owned and received managed cards without duplicating owned cards', () => {
    const receivedCard: PromiseCard = {
      ...baseCard,
      id: 'received-card',
      requesterName: '하린',
    };
    const duplicatedOwnerCard: PromiseCard = {
      ...baseCard,
      id: 'card-test',
      requesterName: '하린',
    };

    expect(mergeManagedCards([baseCard], [receivedCard, duplicatedOwnerCard]).map((card) => card.id)).toEqual([
      'card-test',
      'received-card',
    ]);
  });

  it('builds a reminder-ready schedule item from a confirmed received card', () => {
    const receivedConfirmedCard: PromiseCard = {
      ...baseCard,
      status: 'CONFIRMED',
      requesterName: '하린',
      participants: [
        {
          id: 'profile-minseo',
          name: '민',
          displayName: '민서',
          comment: '조금 늦을 수 있어요',
          color: '#FFD6E7',
          choice: 'YES',
        },
      ],
    };

    expect(buildScheduleItemFromConfirmedCard(receivedConfirmedCard)).toEqual({
      id: 'schedule-card-test',
      cardId: 'card-test',
      title: '하린 · 성수 카페',
      startsAt: june14At1930,
      endsAt: getCandidateEndsAt(june14At1930),
      dateLabel: '6월 14일',
      timeLabel: '19:30 - 20:30',
      location: '성수 카페',
      status: 'REMINDER_ON',
      participants: [
        {
          id: 'profile-minseo',
          name: '민',
          displayName: '민서',
          comment: '조금 늦을 수 있어요',
          color: '#FFD6E7',
          choice: 'YES',
        },
      ],
    });

    expect(buildScheduleItemFromConfirmedCard({ ...receivedConfirmedCard, selectedSlotId: 'missing' })).toBeNull();
    expect(buildScheduleItemFromConfirmedCard({ ...receivedConfirmedCard, status: 'VOTING' })).toBeNull();
  });

  it('applies a received card response to summaries and participant state', () => {
    const responseCard: PromiseCard = {
      ...baseCard,
      requesterName: '하린',
      participants: [
        {
          id: 'profile-minseo',
          name: '민',
          displayName: '민서',
          comment: '조금 늦을 수 있어요',
          color: '#FFD6E7',
          choice: 'UNANSWERED',
        },
      ],
    };

    expect(
      applyReceivedCardResponse(responseCard, {
        respondentId: 'profile-minseo',
        respondentName: '민서',
        responses: [{ candidateId: 'slot-1', choice: 'YES' }],
      }),
    ).toEqual({
      ...responseCard,
      participants: [
        {
          id: 'profile-minseo',
          name: '민',
          displayName: '민서',
          comment: '조금 늦을 수 있어요',
          color: '#FFD6E7',
          choice: 'YES',
        },
      ],
      candidates: [
        {
          ...responseCard.candidates[0],
          summary: { yes: 1, maybe: 0, no: 0, unanswered: 0 },
        },
      ],
    });
  });

  it('builds a concise share message that points invitees to the response link', () => {
    expect(buildShareMessage(baseCard)).toBe(
      [
        '언제볼래? 약속 초대가 왔어요',
        '6월 14일 19:30 · 성수 카페',
        '한마디: 가볍게 한 시간만 보자',
        '가능 여부 알려줘',
        'whenbollae.app/c/card-test',
      ].join('\n'),
    );

    expect(
      buildShareMessage({
        ...baseCard,
        mode: 'POLL',
        title: '성수 카페에서 언제볼래?',
        candidates: [
          baseCard.candidates[0],
          {
            ...baseCard.candidates[0],
            id: 'slot-2',
            startsAt: june15At2000,
            endsAt: getCandidateEndsAt(june15At2000),
            label: '6월 15일 20:00',
            shortLabel: '6.15 20:00',
          },
        ],
      }),
    ).toBe(
      [
        '언제볼래? 약속 초대가 왔어요',
        '6월 14일 19:30 / 6월 15일 20:00 · 성수 카페',
        '한마디: 가볍게 한 시간만 보자',
        '가능 여부 알려줘',
        'whenbollae.app/c/card-test',
      ].join('\n'),
    );

    expect(buildShareMessage({ ...baseCard, message: '' })).toBe(
      [
        '언제볼래? 약속 초대가 왔어요',
        '6월 14일 19:30 · 성수 카페',
        '가능 여부 알려줘',
        'whenbollae.app/c/card-test',
      ].join('\n'),
    );
  });

  it('uses a shorter display URL in Kakao share messages', () => {
    expect(getShareUrlForMessage(baseCard)).toBe('whenbollae.app/c/card-test');
  });

  it('returns only the public URL for clipboard link sharing', () => {
    expect(getShareUrlForClipboard(baseCard)).toBe('https://whenbollae.app/c/card-test');
    expect(getShareUrlForClipboard(baseCard)).not.toContain('언제볼래?');
    expect(getShareUrlForClipboard(baseCard)).not.toContain('한마디');
  });

  it('maps selected app friends to unique recipient profile ids', () => {
    const friends = [
      { id: 'friend-jiu', profileId: 'profile-jiu' },
      { id: 'friend-harin', profileId: 'profile-harin' },
      { id: 'friend-seoa', profileId: 'profile-seoa' },
    ];

    expect(getRecipientProfileIds(friends, ['friend-harin', 'friend-harin', 'missing', 'friend-jiu'])).toEqual([
      'profile-harin',
      'profile-jiu',
    ]);
  });

  it('builds a confirmed card from the selected candidate', () => {
    const pollCard: PromiseCard = {
      ...baseCard,
      mode: 'POLL',
      status: 'VOTING',
      selectedSlotId: undefined,
      candidates: [
        baseCard.candidates[0],
        {
          ...baseCard.candidates[0],
          id: 'slot-2',
          startsAt: june15At2000,
          endsAt: getCandidateEndsAt(june15At2000),
          label: '6월 15일 20:00',
          shortLabel: '6/15 20:00',
        },
      ],
    };

    expect(buildConfirmedCard(pollCard, 'slot-2')).toEqual({
      ...pollCard,
      status: 'CONFIRMED',
      selectedSlotId: 'slot-2',
    });
    expect(buildConfirmedCard(pollCard, 'missing-slot')).toEqual(pollCard);
  });

  it('keeps direct responses as participant state until the creator confirms', () => {
    expect(
      applyReceivedCardResponse(baseCard, {
        respondentId: 'respondent-1',
        respondentName: '민지',
        respondentComment: '가능해요',
        responses: [{ candidateId: 'slot-1', choice: 'YES' }],
      }),
    ).toEqual({
      ...baseCard,
      participants: [
        {
          id: 'respondent-1',
          name: '민',
          displayName: '민지',
          comment: '가능해요',
          color: '#FFD6E7',
          choice: 'YES',
        },
      ],
      candidates: [
        {
          ...baseCard.candidates[0],
          summary: { yes: 1, maybe: 0, no: 0, unanswered: 1 },
        },
      ],
    });
  });
});
