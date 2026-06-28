export type AppointmentMode = 'DIRECT' | 'POLL';

export type AppointmentStatus = 'DRAFT' | 'PENDING' | 'VOTING' | 'CONFIRMED' | 'DECLINED';

export type ResponseChoice = 'YES' | 'MAYBE' | 'NO' | 'UNANSWERED';

export type ReceivedCardResponseChoice = Exclude<ResponseChoice, 'UNANSWERED'>;

export type ReminderLead = '10_MIN' | '30_MIN' | '1_HOUR';

export interface Participant {
  id: string;
  name: string;
  displayName?: string;
  comment?: string;
  color: string;
  choice?: ResponseChoice;
  responses?: Array<{
    candidateId: string;
    choice: ResponseChoice;
  }>;
}

export interface CandidateSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  label: string;
  shortLabel: string;
  summary: {
    yes: number;
    maybe: number;
    no: number;
    unanswered: number;
  };
}

export interface PromiseCard {
  id: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  title: string;
  hostName: string;
  requesterName?: string;
  location: string;
  message: string;
  sharedUrl: string;
  createdAt: string;
  expiresAt?: string;
  selectedSlotId?: string;
  recipientProfileIds?: string[];
  candidates: CandidateSlot[];
  participants: Participant[];
}

export interface ScheduleItem {
  id: string;
  cardId: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  status: 'READY' | 'WAITING' | 'REMINDER_ON';
  selectedSlotId?: string;
  candidates?: CandidateSlot[];
  participants?: Participant[];
}

export type ScheduleSource = 'CARD' | 'MANUAL';

export type ScheduleColorKey = 'coral' | 'mint' | 'lime' | 'sky' | 'amber';
export type TodoSource = 'SINGLE' | 'RECURRING';
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DisplayScheduleItem extends ScheduleItem {
  source: ScheduleSource;
  colorKey?: ScheduleColorKey;
}

export interface TodoItem {
  id: string;
  dateKey: string;
  title: string;
  detail: string;
  done: boolean;
  colorKey: ScheduleColorKey;
  source?: TodoSource;
  recurringTodoId?: string;
}

export interface CreateManualScheduleInput {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  colorKey: ScheduleColorKey;
}

export interface CreateTodoInput {
  dateKey: string;
  title: string;
  detail: string;
  colorKey: ScheduleColorKey;
}

export type UpdateTodoInput = CreateTodoInput;

export interface RecurringTodoItem {
  id: string;
  title: string;
  detail: string;
  weekdays: WeekdayIndex[];
  colorKey: ScheduleColorKey;
}

export interface RecurringTodoCompletion {
  recurringTodoId: string;
  dateKey: string;
  done: boolean;
}

export interface CreateRecurringTodoInput {
  title: string;
  detail: string;
  weekdays: number[];
  colorKey: ScheduleColorKey;
}

export interface ConfirmCardInput {
  cardId: string;
  candidateId: string;
}

export interface RespondToReceivedCardInput {
  cardId: string;
  respondentComment?: string;
  responses: Array<{
    candidateId: string;
    choice: ReceivedCardResponseChoice;
  }>;
}

export interface ReceivedCardAlert {
  id: string;
  title: string;
  location: string;
  requesterName: string;
  createdAt: string;
}

export interface MobileSyncSnapshot {
  serverTime: string;
  syncVersion: string;
  hasChanges: boolean;
}

export interface HostProfile {
  id: string;
  displayName: string;
  handle: string;
  profileUrl: string;
  timezone: string;
  availabilitySummary: string[];
  reminderLead: ReminderLead;
}

export interface PromiseRepository {
  getHostProfile(): Promise<HostProfile>;
  listRecentCards(): Promise<PromiseCard[]>;
  listScheduleItems(): Promise<ScheduleItem[]>;
  listReceivedCardAlerts(): Promise<ReceivedCardAlert[]>;
  getMobileSyncSnapshot(since?: string | null): Promise<MobileSyncSnapshot>;
  createManagedCard(card: PromiseCard): Promise<PromiseCard>;
  sendManagedCardToRecipients(cardId: string, recipientProfileIds: string[]): Promise<PromiseCard>;
  requestManagedCardChange(card: PromiseCard): Promise<PromiseCard>;
  deleteManagedCard(cardId: string): Promise<void>;
  confirmManagedCard(input: ConfirmCardInput): Promise<PromiseCard>;
  respondToReceivedCard(input: RespondToReceivedCardInput): Promise<PromiseCard>;
}
