import type { HostProfile, PromiseCard, PromiseRepository, ScheduleItem } from '@/types/promise';

const profile: HostProfile = {
  id: 'host-minseo',
  displayName: '민서',
  handle: 'minseo',
  profileUrl: 'whenbollae.app/@minseo',
  timezone: 'Asia/Seoul',
  availabilitySummary: ['평일 저녁 19:00-22:00', '주말 오후', '약속 30분 전 알림'],
  reminderLead: '30_MIN',
};

const cards: PromiseCard[] = [
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
      { id: 'p-minseo', name: '민', color: '#FFD6E7', choice: 'YES' },
      { id: 'p-harin', name: '린', color: '#FFE0B8', choice: 'UNANSWERED' },
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
      { id: 'p-minseo-movie', name: '민', color: '#FFD6E7', choice: 'YES' },
      { id: 'p-jiwoo', name: '우', color: '#BFE8FF', choice: 'YES' },
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
      { id: 'p-minseo-past', name: '민', color: '#FFD6E7', choice: 'YES' },
      { id: 'p-seoa', name: '아', color: '#FFC9BA', choice: 'YES' },
    ],
  },
];

const schedule: ScheduleItem[] = [
  {
    id: 'schedule-seongsu-cafe',
    cardId: 'card-seongsu-cafe',
    title: '하린 · 성수 카페',
    dateLabel: '6월 14일',
    timeLabel: '19:30 - 20:30',
    location: '성수 카페',
    status: 'WAITING',
  },
  {
    id: 'schedule-gangnam-movie',
    cardId: 'card-gangnam-movie',
    title: '지우 · 강남 CGV',
    dateLabel: '6월 20일',
    timeLabel: '17:00 - 19:20',
    location: '강남 CGV',
    status: 'REMINDER_ON',
  },
];

export const mockPromiseRepository: PromiseRepository = {
  async getHostProfile() {
    return profile;
  },
  async listInboxCards() {
    return cards.filter((card) => card.status === 'PENDING' || card.status === 'VOTING');
  },
  async listRecentCards() {
    return cards;
  },
  async listScheduleItems() {
    return schedule;
  },
};
