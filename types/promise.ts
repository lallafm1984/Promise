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
}

export type ScheduleSource = 'CARD' | 'MANUAL';

export type ScheduleColorKey = 'coral' | 'mint' | 'lime' | 'sky' | 'amber';

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

export interface ConfirmCardInput {
  cardId: string;
  candidateId: string;
}

export interface RespondToReceivedCardInput {
  cardId: string;
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

export interface SchedulePlannerRepository {
  listManualScheduleItems(): Promise<DisplayScheduleItem[]>;
  createManualScheduleItem(input: CreateManualScheduleInput): Promise<DisplayScheduleItem>;
  listTodos(): Promise<TodoItem[]>;
  createTodo(input: CreateTodoInput): Promise<TodoItem>;
  toggleTodo(todoId: string): Promise<TodoItem>;
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
  createManagedCard(card: PromiseCard): Promise<PromiseCard>;
  sendManagedCardToRecipients(cardId: string, recipientProfileIds: string[]): Promise<PromiseCard>;
  deleteManagedCard(cardId: string): Promise<void>;
  confirmManagedCard(input: ConfirmCardInput): Promise<PromiseCard>;
  respondToReceivedCard(input: RespondToReceivedCardInput): Promise<PromiseCard>;
}
