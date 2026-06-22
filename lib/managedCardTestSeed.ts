import {
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
} from '@/lib/cardMenu';
import type { ManagedCardArchiveState } from '@/lib/managedCardArchive';
import type { CandidateSlot, Participant, PromiseCard } from '@/types/promise';

const injectedPastSeedEnabled = process.env.EXPO_PUBLIC_PROMISE_SEED_PAST_APPOINTMENTS;
const injectedPastSeedBatch = process.env.EXPO_PUBLIC_PROMISE_PAST_SEED_BATCH;

function cleanSeedIdPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || 'local';
}

function padTwo(value: number) {
  return String(value).padStart(2, '0');
}

function toSeedDateKey(date: Date) {
  return `${date.getFullYear()}${padTwo(date.getMonth() + 1)}${padTwo(date.getDate())}`;
}

function createPastDate(baseDate: Date, daysAgo: number, hours: number, minutes = 0) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function buildParticipant(
  id: string,
  displayName: string,
  color: string,
  candidateId: string,
  choice: Participant['choice'] = 'YES',
  comment = '',
): Participant {
  return {
    id,
    name: displayName.slice(0, 1) || '나',
    displayName,
    comment,
    color,
    choice,
    responses: [{ candidateId, choice: choice ?? 'UNANSWERED' }],
  };
}

function buildCandidate(id: string, startsAt: string): CandidateSlot {
  return {
    id,
    startsAt,
    endsAt: getCandidateEndsAt(startsAt),
    label: formatDraftDateTimeLabel(startsAt),
    shortLabel: formatDraftDateTimeShortLabel(startsAt),
    summary: { yes: 2, maybe: 0, no: 0, unanswered: 0 },
  };
}

function buildPastCard({
  id,
  startsAt,
  location,
  hostName,
  requesterName,
  message,
}: {
  id: string;
  startsAt: string;
  location: string;
  hostName: string;
  requesterName?: string;
  message: string;
}): PromiseCard {
  const candidateId = `${id}-slot`;
  const candidate = buildCandidate(candidateId, startsAt);
  const title = `${candidate.label}에 ${location}에서 볼래?`;

  return {
    id,
    mode: 'DIRECT',
    status: 'CONFIRMED',
    title,
    hostName,
    requesterName,
    location,
    message,
    sharedUrl: `https://whenbollae.app/c/${id}`,
    createdAt: new Date(new Date(startsAt).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    selectedSlotId: candidateId,
    candidates: [candidate],
    participants: [
      buildParticipant(`${id}-me`, hostName, '#FFD6E7', candidateId, 'YES', '테스트 가능'),
      buildParticipant(`${id}-friend`, requesterName ?? '친구', '#CFF3E3', candidateId, 'YES', ''),
    ],
  };
}

export function isPastAppointmentLocalSeedEnabled(env?: Record<string, string | undefined>) {
  return (env?.EXPO_PUBLIC_PROMISE_SEED_PAST_APPOINTMENTS ?? injectedPastSeedEnabled) === '1';
}

export function getPastAppointmentLocalSeedBatch(env?: Record<string, string | undefined>) {
  return cleanSeedIdPart(env?.EXPO_PUBLIC_PROMISE_PAST_SEED_BATCH ?? injectedPastSeedBatch ?? 'local');
}

export function buildPastAppointmentLocalSeedCards({
  batchId = 'local',
  now = new Date(),
}: {
  batchId?: string;
  now?: Date;
} = {}): PromiseCard[] {
  const cleanBatchId = cleanSeedIdPart(batchId);
  const firstDate = createPastDate(now, 1, 19);
  const secondDate = createPastDate(now, 2, 15);
  const thirdDate = createPastDate(now, 3, 20);

  return [
    buildPastCard({
      id: `local-test-past-sent-${cleanBatchId}-${toSeedDateKey(firstDate)}-1900`,
      startsAt: firstDate.toISOString(),
      location: '테스트 카페',
      hostName: '나',
      message: '관리함 지난약속 삭제 테스트',
    }),
    buildPastCard({
      id: `local-test-past-sent-${cleanBatchId}-${toSeedDateKey(secondDate)}-1500`,
      startsAt: secondDate.toISOString(),
      location: '테스트 식당',
      hostName: '나',
      message: '일정 지난 약속 삭제 팝업 테스트',
    }),
    buildPastCard({
      id: `local-test-past-received-${cleanBatchId}-${toSeedDateKey(thirdDate)}-2000`,
      startsAt: thirdDate.toISOString(),
      location: '테스트 공원',
      hostName: '수진',
      requesterName: '수진',
      message: '받은 지난약속 숨김 테스트',
    }),
  ];
}

export function mergePastAppointmentLocalSeedArchive(
  archive: ManagedCardArchiveState,
  {
    batchId = getPastAppointmentLocalSeedBatch(),
    now = new Date(),
  }: {
    batchId?: string;
    now?: Date;
  } = {},
): ManagedCardArchiveState {
  const removedCardIds = new Set(archive.removedCardIds);
  const existingCardIds = new Set(archive.localCards.map((card) => card.id));
  const seedCards = buildPastAppointmentLocalSeedCards({ batchId, now }).filter(
    (card) => !removedCardIds.has(card.id) && !existingCardIds.has(card.id),
  );

  if (seedCards.length === 0) {
    return archive;
  }

  return {
    ...archive,
    localCards: [...seedCards, ...archive.localCards],
    updatedAt: now.toISOString(),
  };
}
