import {
  applyReceivedCardResponse,
  buildConfirmedCard,
  buildScheduleItemFromConfirmedCard,
} from '@/lib/cardMenu';
import { mergeRecipientProfileIds } from '@/lib/managedCards';
import type {
  ConfirmCardInput,
  HostProfile,
  PromiseCard,
  PromiseRepository,
  ReceivedCardAlert,
  RespondToReceivedCardInput,
  ScheduleItem,
} from '@/types/promise';

const profile: HostProfile = {
  id: 'host-minseo',
  displayName: '민서',
  handle: 'minseo',
  profileUrl: 'whenbollae.app/@minseo',
  timezone: 'Asia/Seoul',
  availabilitySummary: ['평일 저녁 19:00-22:00', '주말 오후', '약속 30분 전 알림'],
  reminderLead: '30_MIN',
};

let cards: PromiseCard[] = [
  {
    id: 'card-seongsu-cafe',
    mode: 'DIRECT',
    status: 'PENDING',
    title: '6월 14일 19:30에 성수 카페에서 볼래?',
    hostName: '민서',
    requesterName: '하린',
    location: '성수 카페',
    message: '가볍게 한 시간만 보자',
    sharedUrl: 'https://whenbollae.app/c/seongsu-cafe',
    createdAt: '2026-06-10T11:20:00+09:00',
    selectedSlotId: 'slot-seongsu-cafe-1930',
    candidates: [
      {
        id: 'slot-seongsu-cafe-1930',
        startsAt: '2026-06-14T19:30:00+09:00',
        endsAt: '2026-06-14T20:30:00+09:00',
        label: '6월 14일 19:30',
        shortLabel: '6/14 19:30',
        summary: { yes: 1, maybe: 0, no: 0, unanswered: 1 },
      },
    ],
    participants: [
      {
        id: 'p-minseo',
        name: '민',
        displayName: '민서',
        comment: '조금 늦을 수 있어요',
        color: '#FFD6E7',
        choice: 'YES',
      },
      { id: 'p-harin', name: '린', displayName: '하린', comment: '', color: '#FFE0B8', choice: 'UNANSWERED' },
    ],
  },
  {
    id: 'card-seongsu-dinner',
    mode: 'POLL',
    status: 'VOTING',
    title: '성수 밥집에서 언제볼래?',
    hostName: '민서',
    location: '성수 밥집',
    message: '가능한 시간만 골라줘',
    sharedUrl: 'https://whenbollae.app/c/seongsu-dinner',
    createdAt: '2026-06-10T18:05:00+09:00',
    candidates: [
      {
        id: 'slot-seongsu-dinner-0615',
        startsAt: '2026-06-15T18:00:00+09:00',
        endsAt: '2026-06-15T20:00:00+09:00',
        label: '6월 15일 18:00',
        shortLabel: '6/15 18:00',
        summary: { yes: 3, maybe: 1, no: 0, unanswered: 1 },
      },
      {
        id: 'slot-seongsu-dinner-0616',
        startsAt: '2026-06-16T19:00:00+09:00',
        endsAt: '2026-06-16T21:00:00+09:00',
        label: '6월 16일 19:00',
        shortLabel: '6/16 19:00',
        summary: { yes: 2, maybe: 2, no: 1, unanswered: 0 },
      },
    ],
    participants: [
      { id: 'p-minseo-poll', name: '민', color: '#FFD6E7', choice: 'YES' },
      { id: 'p-jiu', name: '지', color: '#CFF3E3', choice: 'YES' },
      { id: 'p-yuna', name: '윤', color: '#DDEBFF', choice: 'MAYBE' },
      { id: 'p-soo', name: '수', color: '#FFF0B8', choice: 'NO' },
      { id: 'p-dan', name: '단', color: '#E9DDFF', choice: 'UNANSWERED' },
    ],
  },
  {
    id: 'card-gangnam-movie',
    mode: 'DIRECT',
    status: 'CONFIRMED',
    title: '6월 20일 17:00에 강남 CGV에서 볼래?',
    hostName: '민서',
    requesterName: '지우',
    location: '강남 CGV',
    message: '예매는 내가 해둘게',
    sharedUrl: 'https://whenbollae.app/c/gangnam-movie',
    createdAt: '2026-06-11T09:40:00+09:00',
    selectedSlotId: 'slot-gangnam-movie-1700',
    candidates: [
      {
        id: 'slot-gangnam-movie-1700',
        startsAt: '2026-06-20T17:00:00+09:00',
        endsAt: '2026-06-20T19:20:00+09:00',
        label: '6월 20일 17:00',
        shortLabel: '6/20 17:00',
        summary: { yes: 2, maybe: 0, no: 0, unanswered: 0 },
      },
    ],
    participants: [
      {
        id: 'p-minseo-movie',
        name: '민',
        displayName: '민서',
        comment: '끝나고 커피도 좋아요',
        color: '#FFD6E7',
        choice: 'YES',
      },
      { id: 'p-jiwoo', name: '우', displayName: '지우', comment: '예매 시간 맞춰 갈게요', color: '#BFE8FF', choice: 'YES' },
    ],
  },
  {
    id: 'card-hangang-cafe',
    mode: 'DIRECT',
    status: 'CONFIRMED',
    title: '6월 6일 15:00에 한강 카페에서 볼래?',
    hostName: '민서',
    requesterName: '서아',
    location: '한강 카페',
    message: '',
    sharedUrl: 'https://whenbollae.app/c/hangang-cafe',
    createdAt: '2026-06-03T16:15:00+09:00',
    selectedSlotId: 'slot-hangang-cafe-1500',
    candidates: [
      {
        id: 'slot-hangang-cafe-1500',
        startsAt: '2026-06-06T15:00:00+09:00',
        endsAt: '2026-06-06T16:30:00+09:00',
        label: '6월 6일 15:00',
        shortLabel: '6/6 15:00',
        summary: { yes: 2, maybe: 0, no: 0, unanswered: 0 },
      },
    ],
    participants: [
      { id: 'p-minseo-past', name: '민', displayName: '민서', comment: '', color: '#FFD6E7', choice: 'YES' },
      { id: 'p-seoa', name: '아', displayName: '서아', comment: '조용한 자리면 좋아요', color: '#FFC9BA', choice: 'YES' },
    ],
  },
];

let schedule: ScheduleItem[] = [
  {
    id: 'schedule-seongsu-cafe',
    cardId: 'card-seongsu-cafe',
    title: '하린 · 성수 카페',
    startsAt: '2026-06-14T19:30:00+09:00',
    endsAt: '2026-06-14T20:30:00+09:00',
    dateLabel: '6월 14일',
    timeLabel: '19:30 - 20:30',
    location: '성수 카페',
    status: 'WAITING',
    participants: [
      {
        id: 'p-minseo',
        name: '민',
        displayName: '민서',
        comment: '조금 늦을 수 있어요',
        color: '#FFD6E7',
        choice: 'YES',
      },
    ],
  },
  {
    id: 'schedule-gangnam-movie',
    cardId: 'card-gangnam-movie',
    title: '지우 · 강남 CGV',
    startsAt: '2026-06-20T17:00:00+09:00',
    endsAt: '2026-06-20T19:20:00+09:00',
    dateLabel: '6월 20일',
    timeLabel: '17:00 - 19:20',
    location: '강남 CGV',
    status: 'REMINDER_ON',
    participants: [
      {
        id: 'p-jiwoo',
        name: '우',
        displayName: '지우',
        comment: '예매 시간 맞춰 갈게요',
        color: '#BFE8FF',
        choice: 'YES',
      },
    ],
  },
];

function applyConfirmation(card: PromiseCard, input: ConfirmCardInput): PromiseCard {
  if (card.id !== input.cardId) {
    return card;
  }

  return buildConfirmedCard(card, input.candidateId);
}

function applyReceivedResponse(card: PromiseCard, input: RespondToReceivedCardInput): PromiseCard {
  if (card.id !== input.cardId || !card.requesterName) {
    return card;
  }

  const respondedCard = applyReceivedCardResponse(card, {
    respondentId: profile.id,
    respondentName: profile.displayName,
    respondentComment: input.respondentComment,
    responses: input.responses,
  });

  return respondedCard;
}

export const mockPromiseRepository: PromiseRepository = {
  async getHostProfile() {
    return profile;
  },
  async listRecentCards() {
    return cards;
  },
  async listScheduleItems() {
    return schedule;
  },
  async listReceivedCardAlerts() {
    return cards
      .filter((card) => Boolean(card.requesterName))
      .map<ReceivedCardAlert>((card) => ({
        id: card.id,
        title: card.title,
        location: card.location,
        requesterName: card.requesterName ?? card.hostName,
        createdAt: card.createdAt,
      }));
  },
  async getMobileSyncSnapshot() {
    const now = new Date().toISOString();

    return {
      serverTime: now,
      syncVersion: now,
      hasChanges: true,
    };
  },
  async createManagedCard(card) {
    cards = [card, ...cards.filter((currentCard) => currentCard.id !== card.id)];
    return card;
  },
  async sendManagedCardToRecipients(cardId, recipientProfileIds) {
    const currentCard = cards.find((card) => card.id === cardId);

    if (!currentCard) {
      throw new Error('카드를 찾지 못했어요.');
    }

    const updatedCard = mergeRecipientProfileIds(currentCard, recipientProfileIds);
    cards = cards.map((card) => (card.id === cardId ? updatedCard : card));

    return updatedCard;
  },
  async requestManagedCardChange(card) {
    const updatedCard: PromiseCard = {
      ...card,
      status: card.mode === 'DIRECT' ? 'PENDING' : 'VOTING',
      selectedSlotId: card.mode === 'DIRECT' ? card.candidates[0]?.id : undefined,
      participants: [],
      candidates: card.candidates.map((candidate) => ({
        ...candidate,
        summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
      })),
    };

    cards = [updatedCard, ...cards.filter((currentCard) => currentCard.id !== card.id)];
    schedule = schedule.filter((item) => item.cardId !== card.id);

    return updatedCard;
  },
  async deleteManagedCard(cardId) {
    cards = cards.filter((card) => card.id !== cardId);
    schedule = schedule.filter((item) => item.cardId !== cardId);
  },
  async confirmManagedCard(input) {
    const currentCard = cards.find((card) => card.id === input.cardId);
    const confirmedCard = currentCard ? applyConfirmation(currentCard, input) : undefined;

    if (!confirmedCard || confirmedCard.status !== 'CONFIRMED') {
      throw new Error('확정할 후보 시간을 찾지 못했어요.');
    }

    cards = cards.map((card) => (card.id === input.cardId ? confirmedCard : card));
    const scheduleItem = buildScheduleItemFromConfirmedCard(confirmedCard);

    if (scheduleItem) {
      schedule = [scheduleItem, ...schedule.filter((item) => item.cardId !== confirmedCard.id)];
    }

    return confirmedCard;
  },
  async respondToReceivedCard(input) {
    const currentCard = cards.find((card) => card.id === input.cardId);
    const respondedCard = currentCard ? applyReceivedResponse(currentCard, input) : undefined;

    if (!respondedCard || respondedCard === currentCard) {
      throw new Error('응답할 카드를 찾지 못했어요.');
    }

    cards = cards.map((card) => (card.id === input.cardId ? respondedCard : card));
    const scheduleItem = buildScheduleItemFromConfirmedCard(respondedCard);

    if (scheduleItem) {
      schedule = [scheduleItem, ...schedule.filter((item) => item.cardId !== respondedCard.id)];
    } else if (respondedCard.status === 'DECLINED') {
      schedule = schedule.filter((item) => item.cardId !== respondedCard.id);
    }

    return respondedCard;
  },
};
