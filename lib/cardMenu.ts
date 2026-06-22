import type {
  AppointmentMode,
  CandidateSlot,
  HostProfile,
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

export type ManagedCardScope = 'SENT' | 'RECEIVED';

export type ManagedCardInboxTab =
  | 'SENT_NO_RESPONSE'
  | 'SENT_HAS_RESPONSE'
  | 'SENT_CONFIRMED'
  | 'SENT_PAST'
  | 'RECEIVED_NEEDS_REPLY'
  | 'RECEIVED_REPLIED'
  | 'RECEIVED_CONFIRMED'
  | 'RECEIVED_PAST';

export type ManagedCardCurrentProfile = Pick<HostProfile, 'id' | 'displayName'>;

export interface ManagedCardResponseStats {
  total: number;
  yes: number;
  maybe: number;
  no: number;
  unanswered: number;
}

export type ManagedCardResponseStatTone = 'total' | 'yes' | 'no';

export interface ManagedCardResponseStatItem {
  key: ManagedCardResponseStatTone;
  label: string;
  value: number;
}

export interface ManagedCardAction {
  kind: ManagedCardActionKind;
  label: string;
}

export interface ReceivedCardResponseBadge {
  key: string;
  label: string;
  choice: ReceivedCardResponseChoice;
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
export const MAX_CARD_CANDIDATE_TIMES = 5;
export const CARD_RESPONSE_WINDOW_DAYS = 3;
export const CARD_RESPONSE_WINDOW_NOTICE = '카드는 3일 동안 응답을 받을 수 있어요.';
export const DUPLICATE_DRAFT_TIME_ERROR = '후보 시간을 서로 다르게 입력해 주세요.';
export const PAST_DRAFT_TIME_ERROR = '지난 시간으로는 카드를 만들 수 없어요. 지금 이후의 날짜와 시간을 선택해 주세요.';

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

export function getCardExpiresAt(createdAt: string, responseWindowDays = CARD_RESPONSE_WINDOW_DAYS): string {
  const createdDate = new Date(createdAt);
  const baseDate = Number.isNaN(createdDate.getTime()) ? new Date() : createdDate;

  return new Date(baseDate.getTime() + responseWindowDays * 24 * 60 * 60 * 1000).toISOString();
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

export function limitDraftTimeCount(times: string[], maxCount = MAX_CARD_CANDIDATE_TIMES): string[] {
  return times.slice(0, maxCount);
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

function hasPastDraftTimes(times: string[], now: Date): boolean {
  return times.some((time) => {
    const date = parseDraftDateTime(time);

    return date !== null && date.getTime() <= now.getTime();
  });
}

export function validateCardDraft(draft: CardDraft, now = new Date()): DraftValidationResult {
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
    return { valid: false, error: DUPLICATE_DRAFT_TIME_ERROR };
  }

  if (hasPastDraftTimes(times, now)) {
    return { valid: false, error: PAST_DRAFT_TIME_ERROR };
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

export function getPrimarySlot(card: Pick<PromiseCard, 'candidates' | 'selectedSlotId'>): CandidateSlot | undefined {
  return card.candidates.find((candidate) => candidate.id === card.selectedSlotId) ?? card.candidates[0];
}

function getCandidateShortDisplayLabel(candidate?: Pick<CandidateSlot, 'label' | 'shortLabel'>): string {
  return candidate?.shortLabel.trim() || candidate?.label.trim() || '';
}

function getCandidateFullDisplayLabel(candidate?: Pick<CandidateSlot, 'label' | 'shortLabel'>): string {
  return candidate?.label.trim() || candidate?.shortLabel.trim() || '';
}

export function getManagedCardTimeLabel(card: Pick<PromiseCard, 'mode' | 'candidates' | 'selectedSlotId'>): string {
  if (card.mode === 'POLL') {
    const labels = card.candidates.map(getCandidateShortDisplayLabel).filter(Boolean);

    if (labels.length > 0) {
      return labels.join('\n');
    }
  }

  return getCandidateShortDisplayLabel(getPrimarySlot(card));
}

export function formatCandidateResponseSummary(summary: CandidateSlot['summary']): string {
  return `가능 ${summary.yes} · 어려움 ${summary.no}`;
}

export function canConfirmCandidateSlot(candidate: Pick<CandidateSlot, 'summary'>): boolean {
  return candidate.summary.yes > 0;
}

export function getRecommendedConfirmationCandidate(
  card: Pick<PromiseCard, 'candidates' | 'selectedSlotId'>,
): CandidateSlot | undefined {
  const candidatesWithYes = card.candidates.filter(canConfirmCandidateSlot);

  if (candidatesWithYes.length === 0) {
    return undefined;
  }

  const selectedCandidate = card.selectedSlotId
    ? candidatesWithYes.find((candidate) => candidate.id === card.selectedSlotId)
    : undefined;

  if (selectedCandidate) {
    return selectedCandidate;
  }

  return candidatesWithYes.reduce((bestCandidate, candidate) =>
    candidate.summary.yes > bestCandidate.summary.yes ? candidate : bestCandidate,
  );
}

export function getManagedCardScope(card: PromiseCard): ManagedCardScope {
  return card.requesterName?.trim() ? 'RECEIVED' : 'SENT';
}

export function getManagedCardResponseStats(card: PromiseCard): ManagedCardResponseStats {
  return card.participants.reduce<ManagedCardResponseStats>(
    (stats, participant) => {
      const choice = participant.choice ?? 'UNANSWERED';

      if (choice === 'YES') {
        stats.yes += 1;
        stats.total += 1;
      } else if (choice === 'MAYBE') {
        stats.maybe += 1;
        stats.total += 1;
      } else if (choice === 'NO') {
        stats.no += 1;
        stats.total += 1;
      } else {
        stats.unanswered += 1;
      }

      return stats;
    },
    { total: 0, yes: 0, maybe: 0, no: 0, unanswered: 0 },
  );
}

export function getManagedCardResponseStatItems(card: PromiseCard): ManagedCardResponseStatItem[] {
  const stats = getManagedCardResponseStats(card);

  if (stats.total === 0) {
    return [];
  }

  return [
    { key: 'total', label: '응답', value: stats.total },
    { key: 'yes', label: '가능', value: stats.yes },
    { key: 'no', label: '어려움', value: stats.no },
  ];
}

export function getSentResponseArrivalCards(
  cards: PromiseCard[],
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): PromiseCard[] {
  return cards.filter((card) => getManagedCardInboxTab(card, now, currentProfile) === 'SENT_HAS_RESPONSE');
}

export function getManagedCardResponseNoticeSignature(
  cards: Array<Pick<PromiseCard, 'id' | 'status' | 'candidates' | 'participants'>>,
): string {
  return cards
    .map((card) => {
      const candidateSignature = card.candidates
        .map(
          (candidate) =>
            `${candidate.id}:${candidate.summary.yes}:${candidate.summary.maybe}:${candidate.summary.no}:${candidate.summary.unanswered}`,
        )
        .join(',');
      const participantSignature = card.participants
        .map((participant) => {
          const responseSignature = participant.responses
            ?.map((response) => `${response.candidateId}:${response.choice}`)
            .sort()
            .join(',');

          return [
            participant.id,
            participant.choice ?? '',
            participant.displayName ?? '',
            participant.comment ?? '',
            responseSignature ?? '',
          ].join(':');
        })
        .sort()
        .join(',');

      return `${card.id}:${card.status}:${candidateSignature}:${participantSignature}`;
    })
    .sort()
    .join('|');
}

export function getManagedCardResponseNoticeFingerprints(
  cards: Array<Pick<PromiseCard, 'id' | 'candidates' | 'participants'>>,
): string[] {
  return cards
    .flatMap((card) => {
      const participantFingerprints = card.participants
        .filter((participant) => {
          const choice = participant.choice ?? 'UNANSWERED';
          return choice !== 'UNANSWERED' || (participant.responses?.length ?? 0) > 0;
        })
        .map((participant) => {
          const responseSignature = participant.responses
            ?.map((response) => `${response.candidateId}:${response.choice}`)
            .sort()
            .join(',');

          return [
            card.id,
            participant.id,
            participant.choice ?? '',
            participant.displayName ?? '',
            participant.comment ?? '',
            responseSignature ?? '',
          ].join(':');
        });

      if (participantFingerprints.length > 0) {
        return participantFingerprints;
      }

      return card.candidates
        .filter((candidate) => candidate.summary.yes > 0 || candidate.summary.maybe > 0 || candidate.summary.no > 0)
        .map(
          (candidate) =>
            `${card.id}:${candidate.id}:${candidate.summary.yes}:${candidate.summary.maybe}:${candidate.summary.no}`,
        );
    })
    .sort();
}

export function getResponseChoiceLabel(choice: ResponseChoice | undefined): string {
  switch (choice ?? 'UNANSWERED') {
    case 'YES':
      return '\uAC00\uB2A5';
    case 'MAYBE':
      return '\uC560\uB9E4';
    case 'NO':
      return '\uC5B4\uB824\uC6C0';
    case 'UNANSWERED':
      return '\uBBF8\uC751\uB2F5';
  }
}

export function getParticipantChoiceForSelectedSlot(
  card: Pick<PromiseCard, 'candidates' | 'selectedSlotId'>,
  participant: Pick<Participant, 'choice' | 'responses'>,
): ResponseChoice {
  const selectedSlotId = card.selectedSlotId ?? card.candidates[0]?.id;
  const selectedResponse = selectedSlotId
    ? participant.responses?.find((response) => response.candidateId === selectedSlotId)
    : undefined;

  return selectedResponse?.choice ?? participant.choice ?? 'UNANSWERED';
}

function normalizeProfileText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function getCurrentProfileParticipant(card: PromiseCard, currentProfile?: ManagedCardCurrentProfile): Participant | null {
  if (!currentProfile) {
    return null;
  }

  const profileName = normalizeProfileText(currentProfile.displayName);

  return (
    card.participants.find(
      (participant) => participant.id === currentProfile.id || normalizeProfileText(participant.displayName) === profileName,
    ) ?? null
  );
}

function hasCurrentProfileResponse(card: PromiseCard, currentProfile?: ManagedCardCurrentProfile): boolean {
  const participant = getCurrentProfileParticipant(card, currentProfile);

  if (!participant) {
    return false;
  }

  return (
    (participant.choice !== undefined && participant.choice !== 'UNANSWERED') ||
    (participant.responses?.some((response) => response.choice !== 'UNANSWERED') ?? false)
  );
}

export function getReceivedCardResponseSummary(
  card: PromiseCard,
  currentProfile?: ManagedCardCurrentProfile,
): string | null {
  const badges = getReceivedCardResponseBadges(card, currentProfile);

  if (badges.length === 0) {
    return null;
  }

  return `내 답장: ${badges.map((badge) => badge.label).join(' · ')}`;
}

export function getReceivedCardResponseBadges(
  card: PromiseCard,
  currentProfile?: ManagedCardCurrentProfile,
): ReceivedCardResponseBadge[] {
  if (getManagedCardScope(card) !== 'RECEIVED') {
    return [];
  }

  const participant = getCurrentProfileParticipant(card, currentProfile);

  if (!participant || !hasCurrentProfileResponse(card, currentProfile)) {
    return [];
  }

  const responseByCandidateId = new Map(participant.responses?.map((response) => [response.candidateId, response.choice]));

  if (card.candidates.length <= 1) {
    const candidate = card.candidates[0];
    const choice = candidate ? responseByCandidateId.get(candidate.id) : undefined;
    const displayChoice = choice ?? participant.choice ?? 'UNANSWERED';

    if (displayChoice === 'UNANSWERED') {
      return [];
    }

    return [
      {
        key: candidate?.id ?? 'direct',
        label: getResponseChoiceLabel(displayChoice),
        choice: displayChoice,
      },
    ];
  }

  return card.candidates
    .map((candidate) => {
      const choice = responseByCandidateId.get(candidate.id);

      if (!choice || choice === 'UNANSWERED') {
        return null;
      }

      return {
        key: candidate.id,
        label: `${candidate.shortLabel || candidate.label} ${getResponseChoiceLabel(choice)}`,
        choice,
      };
    })
    .filter((badge): badge is ReceivedCardResponseBadge => Boolean(badge));
}

export function shouldShowManagedCardRowMeta(card: PromiseCard): boolean {
  return getManagedCardScope(card) === 'SENT' && getManagedCardResponseStats(card).total > 0;
}

export function getManagedCardInboxTab(
  card: PromiseCard,
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): ManagedCardInboxTab {
  const group = getManagedStatusGroup(card, now);

  if (getManagedCardScope(card) === 'RECEIVED') {
    if (group === 'PAST') {
      return 'RECEIVED_PAST';
    }

    if (group === 'CONFIRMED') {
      return 'RECEIVED_CONFIRMED';
    }

    return hasCurrentProfileResponse(card, currentProfile) ? 'RECEIVED_REPLIED' : 'RECEIVED_NEEDS_REPLY';
  }

  if (group === 'PAST') {
    return 'SENT_PAST';
  }

  if (group === 'CONFIRMED') {
    return 'SENT_CONFIRMED';
  }

  if (group === 'DECLINED' || hasManagedCardResponses(card)) {
    return 'SENT_HAS_RESPONSE';
  }

  return 'SENT_NO_RESPONSE';
}

export function getManagedCardTabLabel(tab: ManagedCardInboxTab): string {
  switch (tab) {
    case 'SENT_NO_RESPONSE':
      return '응답 없음';
    case 'SENT_HAS_RESPONSE':
      return '응답 도착';
    case 'SENT_CONFIRMED':
    case 'RECEIVED_CONFIRMED':
      return '확정됨';
    case 'SENT_PAST':
    case 'RECEIVED_PAST':
      return '지난 약속';
    case 'RECEIVED_NEEDS_REPLY':
      return '답장할 카드';
    case 'RECEIVED_REPLIED':
      return '답장 완료';
  }
}

export function getManagedCardRowMetaLabel(card: PromiseCard, currentProfile?: ManagedCardCurrentProfile): string {
  if (getManagedCardScope(card) === 'RECEIVED') {
    return hasCurrentProfileResponse(card, currentProfile) ? '내 답장 완료' : '답장 필요';
  }

  const stats = getManagedCardResponseStats(card);

  if (stats.total === 0) {
    return '';
  }

  const parts = [`응답 ${stats.total}명`];

  if (stats.yes > 0) {
    parts.push(`가능 ${stats.yes}`);
  }

  if (stats.no > 0) {
    parts.push(`어려움 ${stats.no}`);
  }

  return parts.join(' · ');
}

function hasManagedCardResponses(card: PromiseCard): boolean {
  return (
    getManagedCardResponseStats(card).total > 0 ||
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

export function getManagedCardAction(
  card: PromiseCard,
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): ManagedCardAction | null {
  if (card.requesterName) {
    const group = getManagedStatusGroup(card, now);

    if (group === 'CONFIRMED') {
      return { kind: 'SCHEDULE', label: '일정 보기' };
    }

    if (hasCurrentProfileResponse(card, currentProfile)) {
      return null;
    }

    return { kind: 'OPEN_RECEIVED', label: '카드 열기' };
  }

  switch (getManagedStatusGroup(card, now)) {
    case 'PENDING':
      return hasManagedCardResponses(card)
        ? { kind: 'RESULTS', label: '상세보기' }
        : { kind: 'RESHARE', label: '공유 다시하기' };
    case 'VOTING':
      return hasManagedCardResponses(card)
        ? { kind: 'RESULTS', label: '상세보기' }
        : { kind: 'RESHARE', label: '공유 다시하기' };
    case 'DECLINED':
      return hasManagedCardResponses(card)
        ? { kind: 'RESULTS', label: '상세보기' }
        : { kind: 'RECREATE', label: '다시 만들기' };
    case 'CONFIRMED':
      return { kind: 'SCHEDULE', label: '일정 보기' };
    case 'PAST':
      return { kind: 'RECREATE', label: '다시 만들기' };
  }
}

export function buildShareMessage(card: PromiseCard): string {
  const lines = [
    `${getModeLabel(card.mode)} 약속 초대가 왔어요`,
    ...getShareScheduleLines(card),
  ];
  const message = card.message.trim();

  if (message.length > 0) {
    lines.push(`한마디: ${message}`);
  }

  lines.push('가능 여부 알려줘');
  lines.push(CARD_RESPONSE_WINDOW_NOTICE);
  lines.push(getShareUrlForMessage(card));

  return lines.join('\n');
}

function getShareScheduleLines(card: Pick<PromiseCard, 'mode' | 'candidates' | 'location'>): string[] {
  const candidateLabels = card.candidates.map(getCandidateFullDisplayLabel).filter(Boolean);

  if (card.mode === 'POLL' && candidateLabels.length > 1) {
    return ['시간', ...candidateLabels.map((label) => `- ${label}`), `어디서: ${card.location}`];
  }

  return [`${candidateLabels[0] ?? '시간 미정'} · ${card.location}`];
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
  return getManagedCardScope(card) === 'SENT' && ['PENDING', 'VOTING', 'CONFIRMED'].includes(getManagedStatusGroup(card, now));
}

export function canDeleteResponseActionCard(
  card: PromiseCard,
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): boolean {
  return getManagedCardInboxTab(card, now, currentProfile) === 'SENT_HAS_RESPONSE';
}

export function canDeleteReceivedRepliedCard(
  card: PromiseCard,
  now = new Date(),
  currentProfile?: ManagedCardCurrentProfile,
): boolean {
  return getManagedCardInboxTab(card, now, currentProfile) === 'RECEIVED_REPLIED';
}

export function canHideReceivedManagedCard(card: PromiseCard): boolean {
  return getManagedCardScope(card) === 'RECEIVED';
}

export function canHideManagedPastCard(card: PromiseCard, now = new Date()): boolean {
  return getManagedStatusGroup(card, now) === 'PAST';
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
    selectedSlotId: selectedSlot.id,
    candidates: card.candidates.map((candidate) => ({ ...candidate })),
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
  const responses = card.candidates.map((candidate) => {
    const response = responseByCandidateId.get(candidate.id);
    const previousResponse = previousParticipant?.responses?.find(
      (currentResponse) => currentResponse.candidateId === candidate.id,
    );

    return {
      candidateId: candidate.id,
      choice: response?.choice ?? previousResponse?.choice ?? 'UNANSWERED',
    };
  });
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
    responses,
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
      const previousResponse = previousParticipant?.responses?.find(
        (currentResponse) => currentResponse.candidateId === candidate.id,
      );
      const previousChoice =
        previousResponse?.choice ?? (card.candidates.length === 1 ? previousParticipant?.choice : undefined);

      if (!response) {
        return candidate;
      }

      return {
        ...candidate,
        summary: shiftCandidateSummary(candidate.summary, previousChoice, response.choice),
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
