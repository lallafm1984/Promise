import type { AppointmentMode, CandidateSlot, PromiseCard } from '@/types/promise';

export interface CardDraft {
  mode: AppointmentMode;
  times: string[];
  location: string;
  message: string;
}

export type DraftValidationResult = { valid: true } | { valid: false; error: string };

export type ManagedStatusGroup = 'PENDING' | 'VOTING' | 'CONFIRMED' | 'PAST';

export type ManagedCardActionKind = 'RESHARE' | 'RESULTS' | 'SCHEDULE' | 'RECREATE';

export interface ManagedCardAction {
  kind: ManagedCardActionKind;
  label: string;
}

export function getModeLabel(mode: AppointmentMode): string {
  return mode === 'DIRECT' ? '이때볼래?' : '언제볼래?';
}

export function compactDraftTimes(times: string[]): string[] {
  return times.map((time) => time.trim()).filter(Boolean);
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

  return { valid: true };
}

export function getGeneratedCardTitle(draft: CardDraft): string {
  const location = draft.location.trim();

  if (draft.mode === 'DIRECT') {
    return `${compactDraftTimes(draft.times)[0]}에 ${location}에서 볼래?`;
  }

  return `${location}에서 언제볼래?`;
}

export function getPrimarySlot(card: PromiseCard): CandidateSlot | undefined {
  return card.candidates.find((candidate) => candidate.id === card.selectedSlotId) ?? card.candidates[0];
}

export function getManagedStatusGroup(card: PromiseCard, now = new Date()): ManagedStatusGroup {
  if (card.status === 'DECLINED') {
    return 'PAST';
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
  switch (getManagedStatusGroup(card, now)) {
    case 'PENDING':
      return { kind: 'RESHARE', label: '공유 다시하기' };
    case 'VOTING':
      return { kind: 'RESULTS', label: '결과 보기' };
    case 'CONFIRMED':
      return { kind: 'SCHEDULE', label: '일정 보기' };
    case 'PAST':
      return { kind: 'RECREATE', label: '다시 만들기' };
  }
}

export function buildShareMessage(card: PromiseCard): string {
  const lines = [
    card.title,
    `언제: ${card.candidates.map((candidate) => candidate.label).join(' / ')}`,
    `어디서: ${card.location}`,
  ];
  const message = card.message.trim();

  if (message.length > 0) {
    lines.push(`한마디: ${message}`);
  }

  lines.push(card.sharedUrl);

  return lines.join('\n');
}
