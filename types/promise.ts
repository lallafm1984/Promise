export type AppointmentMode = 'DIRECT' | 'POLL';

export type AppointmentStatus = 'DRAFT' | 'PENDING' | 'VOTING' | 'CONFIRMED' | 'DECLINED';

export type ResponseChoice = 'YES' | 'MAYBE' | 'NO' | 'UNANSWERED';

export type ReminderLead = '10_MIN' | '30_MIN' | '1_HOUR';

export interface Participant {
  id: string;
  name: string;
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
  candidates: CandidateSlot[];
  participants: Participant[];
}

export interface ScheduleItem {
  id: string;
  cardId: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  status: 'READY' | 'WAITING' | 'REMINDER_ON';
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
  listInboxCards(): Promise<PromiseCard[]>;
  listRecentCards(): Promise<PromiseCard[]>;
  listScheduleItems(): Promise<ScheduleItem[]>;
}

