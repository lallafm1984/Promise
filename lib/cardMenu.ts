import type {
  AppointmentMode,
  CandidateSlot,
  Participant,
  PromiseCard,
  ReceivedCardResponseChoice,
  ResponseChoice,
  ScheduleItem,
} from '@/types/promise';

export interface CardDraft {
  mode: AppointmentMode;
  times: string[];
  location: string;
  message: string;
}

export type DraftValidationResult = { valid: true } | { valid: false; error: string };

export type ManagedStatusGroup = 'PENDING' | 'VOTING' | 'DECLINED' | 'CONFIRMED' | 'PAST';

export type ManagedCardActionKind = 'RESHARE' | 'RESULTS' | 'SCHEDULE' | 'RECREATE' | 'OPEN_RECEIVED';

export interface ManagedCardAction {
  kind: ManagedCardActionKind;
  label: string;
}

export interface ApplyReceivedCardResponseInput {
  respondentId: string;
  respondentName: string;
  respondentComment?: string;
  responses: Array<{
    candidateId: string;
    choice: ReceivedCardResponseChoice;
  }>;
}

export function getModeLabel(mode: AppointmentMode): string {
  return mode === 'DIRECT' ? '이때볼래?' : '언제볼래?';
}

const DEFAULT_MEETING_HOUR = 19;
const DEFAULT_MEETING_MINUTE = 0;
const MEETING_DURATION_MINUTES = 60;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDraftDateTime(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createDefaultDraftTime(slotIndex = 0, baseDate = new Date()): string {
  const date = new Date(baseDate);
  const candidateHour = DEFAULT_MEETING_HOUR + slotIndex;
  date.setDate(date.getDate() + 1 + Math.floor(candidateHour / 24));
  date.setHours(candidateHour % 24, DEFAULT_MEETING_MINUTE, 0, 0);
  return date.toISOString();
}

export function createDefaultDraftTimes(count = 2, baseDate = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => createDefaultDraftTime(index, baseDate));
}

export function createDefaultCardDraft(baseDate = new Date()): CardDraft {
  return {
    mode: 'DIRECT',
    times: createDefaultDraftTimes(2, baseDate),
    location: '',
    message: '',
  };
}

export function isDraftTimeValid(value: string): boolean {
  return value.trim().length > 0 && parseDraftDateTime(value) !== null;
}

export function ensureDraftTimeCount(times: string[], count: number, baseDate = new Date()): string[] {
  const nextTimes = times.filter(isDraftTimeValid);

  while (nextTimes.length < count) {
    nextTimes.push(createDefaultDraftTime(nextTimes.length, baseDate));
  }

  return nextTimes;
}

export function removeDraftTimeAtIndex(
  mode: AppointmentMode,
  times: string[],
  indexToRemove: number,
): { mode: AppointmentMode; times: string[] } {
  const nextTimes = times.filter((_, index) => index !== indexToRemove);

  if (mode === 'POLL' && nextTimes.length < 2) {
    return {
      mode: 'DIRECT',
      times: nextTimes.length > 0 ? nextTimes : [createDefaultDraftTime(0)],
    };
  }

  return {
    mode,
    times: mode === 'POLL' ? ensureDraftTimeCount(nextTimes, 2) : nextTimes,
  };
}

export function formatDraftDateTimeLabel(value: string): string {
  const date = parseDraftDateTime(value);

  if (!date) {
    return '';
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function formatDraftDateTimeShortLabel(value: string): string {
  const date = parseDraftDateTime(value);

  if (!date) {
    return '';
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function formatDraftDateInputValue(value: string): string {
  const date = parseDraftDateTime(value);

  if (!date) {
    return '';
  }

  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function formatDraftTimeInputValue(value: string): string {
  const date = parseDraftDateTime(value);

  if (!date) {
    return '';
  }

  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function mergeDraftDatePart(currentValue: string, dateValue: string): string {
  const currentDate = parseDraftDateTime(currentValue) ?? new Date(createDefaultDraftTime());
  const [year, month, day] = dateValue.split('-').map(Number);

  if (!year || !month || !day) {
    return currentDate.toISOString();
  }

  return new Date(year, month - 1, day, currentDate.getHours(), currentDate.getMinutes(), 0, 0).toISOString();
}

export function mergeDraftTimePart(currentValue: string, timeValue: string): string {
  const currentDate = parseDraftDateTime(currentValue) ?? new Date(createDefaultDraftTime());
  const [hours, minutes] = timeValue.split(':').map(Number);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return currentDate.toISOString();
  }

  return new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    hours,
    minutes,
    0,
    0,
  ).toISOString();
}

export function mergeDraftDateTime(currentValue: string, selectedDate: Date, mode: 'date' | 'time'): string {
  const currentDate = parseDraftDateTime(currentValue) ?? new Date(createDefaultDraftTime());

  if (mode === 'date') {
    return new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      currentDate.getHours(),
      currentDate.getMinutes(),
      0,
      0,
    ).toISOString();
  }

  return new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    selectedDate.getHours(),
    selectedDate.getMinutes(),
    0,
    0,
  ).toISOString();
}

export function getCandidateEndsAt(startsAt: string, durationMinutes = MEETING_DURATION_MINUTES): string {
  const startDate = parseDraftDateTime(startsAt) ?? new Date(createDefaultDraftTime());
  return new Date(startDate.getTime() + durationMinutes * 60 * 1000).toISOString();
}

export function compactDraftTimes(times: string[]): string[] {
  return times.map((time) => time.trim()).filter(isDraftTimeValid);
}

function getDraftTimeKey(value: string): string {
  const date = parseDraftDateTime(value) ?? new Date(createDefaultDraftTime());
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
}

function hasDuplicateDraftTimes(times: string[]): boolean {
  const timeKeys = times.map(getDraftTimeKey);
  return new Set(timeKeys).size !== timeKeys.length;
}

export function validateCardDraft(draft: CardDraft): DraftValidationResult {
  const times = compactDraftTimes(draft.times);

  if (times.length === 0) {
    return { valid: false, error: '만날 시간을 골라주세요.' };
  }

  if (draft.location.trim().length === 0) {
    return { valid: false, error: '만날 장소를 적어주세요.' };
  }

  if (draft.mode === 'POLL' && times.length < 2) {
    return { valid: false, error: '언제볼래?는 후보 시간이 2개 이상 필요해요.' };
  }

  if (draft.mode === 'POLL' && hasDuplicateDraftTimes(times)) {
    return { valid: false, error: '후보 시간을 서로 다르게 입력해 주세요.' };
  }

  return { valid: true };
}

export function getGeneratedCardTitle(draft: CardDraft): string {
  const location = draft.location.trim();

  if (draft.mode === 'DIRECT') {
    return `${formatDraftDateTimeLabel(compactDraftTimes(draft.times)[0] ?? '')}에 ${location}에서 볼래?`;
  }

  return `${location}에서 언제볼래?`;
}

export function getPrimarySlot(card: PromiseCard): CandidateSlot | undefined {
  return card.candidates.find((candidate) => candidate.id === card.selectedSlotId) ?? card.candidates[0];
}

export function formatCandidateResponseSummary(summary: CandidateSlot['summary']): string {
  return `가능 ${summary.yes} · 어려움 ${summary.no}`;
}

function hasManagedCardResponses(card: PromiseCard): boolean {
  return (
    card.participants.length > 0 ||
    card.candidates.some((candidate) => candidate.summary.yes > 0 || candidate.summary.maybe > 0 || candidate.summary.no > 0)
  );
}

export function getManagedStatusGroup(card: PromiseCard, now = new Date()): ManagedStatusGroup {
  if (card.status === 'DECLINED') {
    return 'DECLINED';
  }

  if (card.status === 'CONFIRMED') {
    const primarySlot = getPrimarySlot(card);

    if (primarySlot && new Date(primarySlot.startsAt) < now) {
      return 'PAST';
    }

    return 'CONFIRMED';
  }

  if (card.status === 'PENDING' || card.status === 'VOTING') {
    return card.status;
  }

  return 'PAST';
}

export function getManagedCardAction(card: PromiseCard, now = new Date()): ManagedCardAction {
  if (card.requesterName) {
    const group = getManagedStatusGroup(card, now);

    if (group === 'CONFIRMED') {
      return { kind: 'SCHEDULE', label: '일정 보기' };
    }

    return { kind: 'OPEN_RECEIVED', label: '카드 열기' };
  }

  switch (getManagedStatusGroup(card, now)) {
    case 'PENDING':
      return hasManagedCardResponses(card)
        ? { kind: 'RESULTS', label: '결과 보기' }
        : { kind: 'RESHARE', label: '공유 다시하기' };
    case 'VOTING':
      return { kind: 'RESULTS', label: '결과 보기' };
    case 'DECLINED':
      return hasManagedCardResponses(card)
        ? { kind: 'RESULTS', label: '결과 보기' }
        : { kind: 'RECREATE', label: '다시 만들기' };
    case 'CONFIRMED':
      return { kind: 'SCHEDULE', label: '일정 보기' };
    case 'PAST':
      return { kind: 'RECREATE', label: '다시 만들기' };
  }
}

export function buildShareMessage(card: PromiseCard): string {
  const lines = [
    '언제볼래? 약속 초대가 왔어요',
    `${card.candidates.map((candidate) => candidate.label).join(' / ')} · ${card.location}`,
  ];
  const message = card.message.trim();

  if (message.length > 0) {
    lines.push(`한마디: ${message}`);
  }

  lines.push('가능 여부 알려줘');
  lines.push(getShareUrlForMessage(card));

  return lines.join('\n');
}

export function getShareUrlForMessage(card: Pick<PromiseCard, 'sharedUrl'>): string {
  return card.sharedUrl.trim().replace(/^https?:\/\//i, '');
}

export function getShareUrlForClipboard(card: Pick<PromiseCard, 'sharedUrl'>): string {
  return card.sharedUrl;
}

export function getRecipientProfileIds(
  friends: Array<{ id: string; profileId: string }>,
  selectedFriendIds: string[],
): string[] {
  const recipientProfileIds: string[] = [];
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  selectedFriendIds.forEach((friendId) => {
    const friend = friendById.get(friendId);

    if (!friend || recipientProfileIds.includes(friend.profileId)) {
      return;
    }

    recipientProfileIds.push(friend.profileId);
  });

  return recipientProfileIds;
}

export function mergeManagedCards(ownedCards: PromiseCard[], receivedCards: PromiseCard[]): PromiseCard[] {
  const ownedCardIds = new Set(ownedCards.map((card) => card.id));
  return [...ownedCards, ...receivedCards.filter((card) => !ownedCardIds.has(card.id))];
}

export function canDeleteManagedCard(card: PromiseCard, now = new Date()): boolean {
  return ['PENDING', 'VOTING'].includes(getManagedStatusGroup(card, now));
}

export function buildScheduleItemFromConfirmedCard(card: PromiseCard): ScheduleItem | null {
  if (card.status !== 'CONFIRMED') {
    return null;
  }

  const selectedSlot = card.selectedSlotId
    ? card.candidates.find((candidate) => candidate.id === card.selectedSlotId)
    : card.candidates[0];

  if (!selectedSlot || !selectedSlot.startsAt || !selectedSlot.endsAt) {
    return null;
  }

  const startDate = parseDraftDateTime(selectedSlot.startsAt);

  if (!startDate) {
    return null;
  }

  const endDate = parseDraftDateTime(selectedSlot.endsAt);
  const titleName = card.requesterName ?? card.hostName;

  return {
    id: `schedule-${card.id}`,
    cardId: card.id,
    title: `${titleName} · ${card.location}`,
    startsAt: selectedSlot.startsAt,
    endsAt: selectedSlot.endsAt,
    dateLabel: `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`,
    timeLabel: endDate
      ? `${padTwo(startDate.getHours())}:${padTwo(startDate.getMinutes())} - ${padTwo(endDate.getHours())}:${padTwo(
          endDate.getMinutes(),
        )}`
      : `${padTwo(startDate.getHours())}:${padTwo(startDate.getMinutes())}`,
    location: card.location,
    status: 'REMINDER_ON',
    participants: card.participants.map((participant) => ({ ...participant })),
  };
}

function getRepresentativeChoice(responses: ApplyReceivedCardResponseInput['responses']): ResponseChoice {
  if (responses.some((response) => response.choice === 'YES')) {
    return 'YES';
  }

  if (responses.some((response) => response.choice === 'MAYBE')) {
    return 'MAYBE';
  }

  if (responses.some((response) => response.choice === 'NO')) {
    return 'NO';
  }

  return 'UNANSWERED';
}

function shiftCandidateSummary(
  summary: CandidateSlot['summary'],
  previousChoice: ResponseChoice | undefined,
  nextChoice: ReceivedCardResponseChoice,
): CandidateSlot['summary'] {
  const nextSummary = { ...summary };
  const previousKey = previousChoice?.toLowerCase() as keyof CandidateSlot['summary'] | undefined;
  const nextKey = nextChoice.toLowerCase() as keyof CandidateSlot['summary'];

  if (previousKey && nextSummary[previousKey] > 0) {
    nextSummary[previousKey] -= 1;
  }

  nextSummary[nextKey] += 1;

  return nextSummary;
}

function getParticipantLabel(name: string) {
  return name.trim().slice(0, 1) || '나';
}

export function applyReceivedCardResponse(card: PromiseCard, input: ApplyReceivedCardResponseInput): PromiseCard {
  const previousParticipant = card.participants.find((participant) => participant.id === input.respondentId);
  const responseByCandidateId = new Map(input.responses.map((response) => [response.candidateId, response]));
  const representativeChoice = getRepresentativeChoice(input.responses);
  const displayName =
    input.respondentName.trim() ||
    previousParticipant?.displayName ||
    previousParticipant?.name ||
    getParticipantLabel(input.respondentName);
  const comment =
    input.respondentComment === undefined ? previousParticipant?.comment ?? '' : input.respondentComment.trim();
  const participant: Participant = {
    id: input.respondentId,
    name: previousParticipant?.name ?? getParticipantLabel(input.respondentName),
    displayName,
    comment,
    color: previousParticipant?.color ?? '#FFD6E7',
    choice: representativeChoice,
  };

  return {
    ...card,
    participants: previousParticipant
      ? card.participants.map((currentParticipant) =>
          currentParticipant.id === input.respondentId ? participant : currentParticipant,
        )
      : [...card.participants, participant],
    candidates: card.candidates.map((candidate) => {
      const response = responseByCandidateId.get(candidate.id);

      if (!response) {
        return candidate;
      }

      return {
        ...candidate,
        summary: shiftCandidateSummary(candidate.summary, previousParticipant?.choice, response.choice),
      };
    }),
  };
}

export function buildConfirmedCard(card: PromiseCard, candidateId: string): PromiseCard {
  if (!card.candidates.some((candidate) => candidate.id === candidateId)) {
    return card;
  }

  return {
    ...card,
    status: 'CONFIRMED',
    selectedSlotId: candidateId,
  };
}
