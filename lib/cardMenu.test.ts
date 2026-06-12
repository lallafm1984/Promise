import { describe, expect, it } from 'vitest';

import type { PromiseCard } from '@/types/promise';
import {
  buildShareMessage,
  getGeneratedCardTitle,
  getManagedCardAction,
  getManagedStatusGroup,
  getModeLabel,
  validateCardDraft,
} from './cardMenu';

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
      startsAt: '2026-06-14T19:30:00+09:00',
      endsAt: '2026-06-14T20:30:00+09:00',
      label: '6월 14일 19:30',
      shortLabel: '6.14 19:30',
      summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
    },
  ],
  participants: [],
};

describe('card menu helpers', () => {
  it('labels the two creation modes with approved product names', () => {
    expect(getModeLabel('DIRECT')).toBe('이때볼래?');
    expect(getModeLabel('POLL')).toBe('언제볼래?');
  });

  it('validates direct cards with one time and one place', () => {
    expect(validateCardDraft({ mode: 'DIRECT', times: ['6월 14일 19:30'], location: '성수 카페', message: '' })).toEqual({
      valid: true,
    });

    expect(validateCardDraft({ mode: 'DIRECT', times: [''], location: '성수 카페', message: '' })).toEqual({
      valid: false,
      error: '만날 시간을 골라주세요.',
    });

    expect(validateCardDraft({ mode: 'DIRECT', times: ['6월 14일 19:30'], location: '', message: '' })).toEqual({
      valid: false,
      error: '만날 장소를 적어주세요.',
    });
  });

  it('requires two candidate times for poll cards', () => {
    expect(validateCardDraft({ mode: 'POLL', times: ['6월 14일 19:30'], location: '성수 카페', message: '' })).toEqual({
      valid: false,
      error: '언제볼래?는 후보 시간이 2개 이상 필요해요.',
    });

    expect(
      validateCardDraft({
        mode: 'POLL',
        times: ['6월 14일 19:30', '6월 15일 20:00'],
        location: '성수 카페',
        message: '',
      }),
    ).toEqual({ valid: true });
  });

  it('generates direct and poll titles from time and place only', () => {
    expect(getGeneratedCardTitle({ mode: 'DIRECT', times: ['6월 14일 19:30'], location: '성수 카페', message: '' })).toBe(
      '6월 14일 19:30에 성수 카페에서 볼래?',
    );

    expect(
      getGeneratedCardTitle({
        mode: 'POLL',
        times: ['6월 14일 19:30', '6월 15일 20:00'],
        location: '성수 카페',
        message: '',
      }),
    ).toBe('성수 카페에서 언제볼래?');
  });

  it('groups managed cards by status and moves old confirmed cards to past appointments', () => {
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
          candidates: [{ ...baseCard.candidates[0], startsAt: '2026-06-01T19:30:00+09:00' }],
        },
        new Date('2026-06-12T12:00:00+09:00'),
      ),
    ).toBe('PAST');
  });

  it('returns exactly one representative action per managed status group', () => {
    expect(getManagedCardAction({ ...baseCard, status: 'PENDING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'RESHARE',
      label: '공유 다시하기',
    });
    expect(getManagedCardAction({ ...baseCard, status: 'VOTING' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'RESULTS',
      label: '결과 보기',
    });
    expect(getManagedCardAction({ ...baseCard, status: 'CONFIRMED' }, new Date('2026-06-12T12:00:00+09:00'))).toEqual({
      kind: 'SCHEDULE',
      label: '일정 보기',
    });
  });

  it('builds a share message with title, time, place, optional message, and link', () => {
    expect(buildShareMessage(baseCard)).toBe(
      [
        '6월 14일 19:30에 성수 카페에서 볼래?',
        '언제: 6월 14일 19:30',
        '어디서: 성수 카페',
        '한마디: 가볍게 한 시간만 보자',
        'https://whenbollae.app/c/card-test',
      ].join('\n'),
    );
  });
});
