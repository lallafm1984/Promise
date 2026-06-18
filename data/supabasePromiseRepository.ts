import {
  assertSupabase,
  CARD_BASE_URL,
  ensureProfile,
  getAuthenticatedUser,
  mapProfileToHostProfile,
  type ProfileRow,
} from '@/data/supabaseProfile';
import {
  buildScheduleItemFromConfirmedCard,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
  mergeManagedCards,
} from '@/lib/cardMenu';
import { supabase } from '@/lib/supabase';
import type {
  AppointmentMode,
  AppointmentStatus,
  CandidateSlot,
  ConfirmCardInput,
  HostProfile,
  Participant,
  PromiseCard,
  PromiseRepository,
  ReceivedCardAlert,
  RespondToReceivedCardInput,
  ResponseChoice,
  ScheduleItem,
} from '@/types/promise';

interface AppointmentCardRow {
  id: string;
  owner_id: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  title: string;
  location: string;
  message: string;
  public_token: string;
  selected_candidate_id: string | null;
  created_at: string;
}

interface AppointmentCandidateRow {
  id: string;
  card_id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  short_label: string;
  sort_order: number;
}

interface AppointmentRespondentRow {
  id: string;
  card_id: string;
  profile_id: string | null;
  display_name: string;
  comment: string;
}

interface CandidateResponseRow {
  respondent_id: string;
  candidate_id: string;
  choice: ResponseChoice;
}

interface AppointmentRow {
  id: string;
  card_id: string | null;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string;
}

interface AppointmentIdRow {
  id: string;
}

interface CardRecipientRow {
  card_id: string;
}

export async function isSupabasePromiseRepositoryAvailable() {
  if (!supabase) {
    return false;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

function countResponses(candidateId: string, responses: CandidateResponseRow[]) {
  return responses
    .filter((response) => response.candidate_id === candidateId)
    .reduce(
      (summary, response) => ({
        ...summary,
        [response.choice.toLowerCase()]: summary[response.choice.toLowerCase() as Lowercase<ResponseChoice>] + 1,
      }),
      { yes: 0, maybe: 0, no: 0, unanswered: 0 },
    );
}

function chooseParticipantChoice(responses: CandidateResponseRow[]): ResponseChoice | undefined {
  if (responses.some((response) => response.choice === 'YES')) {
    return 'YES';
  }

  if (responses.some((response) => response.choice === 'MAYBE')) {
    return 'MAYBE';
  }

  if (responses.some((response) => response.choice === 'NO')) {
    return 'NO';
  }

  return responses[0]?.choice;
}

function getParticipantColor(index: number) {
  const colors = ['#FFD6E7', '#CFF3E3', '#DDEBFF', '#FFF0B8', '#E9DDFF', '#FFC9BA'];
  return colors[index % colors.length];
}

function getUniqueRecipientProfileIds(card: PromiseCard, ownerId: string) {
  return Array.from(new Set(card.recipientProfileIds ?? [])).filter((profileId) => profileId !== ownerId);
}

function cleanConfirmCardInput(input: ConfirmCardInput) {
  const cardId = input.cardId.trim();
  const candidateId = input.candidateId.trim();

  if (!cardId || !candidateId) {
    throw new Error('확정할 후보 시간을 찾지 못했어요.');
  }

  return { cardId, candidateId };
}

function cleanRespondToReceivedCardInput(input: RespondToReceivedCardInput): RespondToReceivedCardInput {
  const cardId = input.cardId.trim();
  const responses = input.responses
    .map((response) => ({ candidateId: response.candidateId.trim(), choice: response.choice }))
    .filter((response) => response.candidateId.length > 0);

  if (!cardId || responses.length === 0) {
    throw new Error('응답할 시간을 선택해 주세요.');
  }

  return { cardId, responses };
}

function mapCard(
  card: AppointmentCardRow,
  profile: ProfileRow,
  candidates: AppointmentCandidateRow[],
  respondents: AppointmentRespondentRow[],
  responses: CandidateResponseRow[],
): PromiseCard {
  const cardCandidates = candidates
    .filter((candidate) => candidate.card_id === card.id)
    .sort((left, right) => left.sort_order - right.sort_order);
  const cardRespondents = respondents.filter((respondent) => respondent.card_id === card.id);
  const participants: Participant[] = cardRespondents.map((respondent, index) => {
    const respondentResponses = responses.filter((response) => response.respondent_id === respondent.id);
    const displayName = respondent.display_name.trim() || '친구';
    const comment = respondent.comment.trim();

    return {
      id: respondent.profile_id ?? respondent.id,
      name: displayName.slice(0, 1),
      displayName,
      comment,
      color: getParticipantColor(index),
      choice: chooseParticipantChoice(respondentResponses),
    };
  });

  return {
    id: card.id,
    mode: card.mode,
    status: card.status,
    title: card.title,
    hostName: profile.display_name,
    location: card.location,
    message: card.message,
    sharedUrl: `${CARD_BASE_URL}/c/${card.public_token}`,
    createdAt: card.created_at,
    selectedSlotId: card.selected_candidate_id ?? cardCandidates[0]?.id,
    candidates: cardCandidates.map<CandidateSlot>((candidate) => ({
      id: candidate.id,
      startsAt: candidate.starts_at,
      endsAt: candidate.ends_at,
      label: candidate.label || formatDraftDateTimeLabel(candidate.starts_at),
      shortLabel: candidate.short_label || formatDraftDateTimeShortLabel(candidate.starts_at),
      summary: countResponses(candidate.id, responses),
    })),
    participants,
  };
}

async function getProfilesById(profileIds: string[], fallbackProfile?: ProfileRow) {
  const client = assertSupabase();
  const profilesById = new Map<string, ProfileRow>();

  if (fallbackProfile) {
    profilesById.set(fallbackProfile.id, fallbackProfile);
  }

  const missingProfileIds = Array.from(new Set(profileIds)).filter((profileId) => !profilesById.has(profileId));

  if (missingProfileIds.length === 0) {
    return profilesById;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, handle, display_name, avatar_url, timezone')
    .in('id', missingProfileIds);

  if (error) {
    throw error;
  }

  ((data ?? []) as ProfileRow[]).forEach((profile) => {
    profilesById.set(profile.id, profile);
  });

  return profilesById;
}

async function mapCardsWithDetails(cards: AppointmentCardRow[], profilesById: Map<string, ProfileRow>) {
  const client = assertSupabase();
  const cardIds = cards.map((card) => card.id);

  if (cardIds.length === 0) {
    return [];
  }

  const [{ data: candidatesData, error: candidatesError }, { data: respondentsData, error: respondentsError }] =
    await Promise.all([
      client
        .from('appointment_candidates')
        .select('id, card_id, starts_at, ends_at, label, short_label, sort_order')
        .in('card_id', cardIds),
      client
        .from('appointment_respondents')
        .select('id, card_id, profile_id, display_name, comment')
        .in('card_id', cardIds),
    ]);

  if (candidatesError) {
    throw candidatesError;
  }

  if (respondentsError) {
    throw respondentsError;
  }

  const candidates = (candidatesData ?? []) as AppointmentCandidateRow[];
  const respondents = (respondentsData ?? []) as AppointmentRespondentRow[];
  const respondentIds = respondents.map((respondent) => respondent.id);
  const responses =
    respondentIds.length === 0
      ? []
      : ((await client
          .from('appointment_candidate_responses')
          .select('respondent_id, candidate_id, choice')
          .in('respondent_id', respondentIds)).data ?? []) as CandidateResponseRow[];

  return cards.map((card) => {
    const profile = profilesById.get(card.owner_id) ?? {
      id: card.owner_id,
      handle: 'unknown',
      display_name: '친구',
      avatar_url: null,
      timezone: 'Asia/Seoul',
    };

    return mapCard(card, profile, candidates, respondents, responses);
  });
}

async function listCardsByOwner(statuses?: AppointmentStatus[]) {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  const profile = await ensureProfile(user);
  let query = client
    .from('appointment_cards')
    .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (statuses) {
    query = query.in('status', statuses);
  }

  const { data: cardsData, error: cardsError } = await query;

  if (cardsError) {
    throw cardsError;
  }

  const cards = (cardsData ?? []) as AppointmentCardRow[];

  return mapCardsWithDetails(cards, await getProfilesById([profile.id], profile));
}

async function listReceivedCardAlertRows(statuses?: AppointmentStatus[]): Promise<ReceivedCardAlert[]> {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  const { data: recipientData, error: recipientError } = await client
    .from('card_recipients')
    .select('card_id')
    .eq('recipient_profile_id', user.id)
    .order('created_at', { ascending: false });

  if (recipientError) {
    throw recipientError;
  }

  const cardIds = Array.from(new Set(((recipientData ?? []) as CardRecipientRow[]).map((row) => row.card_id)));

  if (cardIds.length === 0) {
    return [];
  }

  let query = client
    .from('appointment_cards')
    .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
    .in('id', cardIds)
    .order('created_at', { ascending: false });

  if (statuses) {
    query = query.in('status', statuses);
  }

  const { data: cardsData, error: cardsError } = await query;

  if (cardsError) {
    throw cardsError;
  }

  const cards = (cardsData ?? []) as AppointmentCardRow[];
  const profilesById = await getProfilesById(cards.map((card) => card.owner_id));

  return cards.map((card) => ({
    id: card.id,
    title: card.title,
    location: card.location,
    requesterName: profilesById.get(card.owner_id)?.display_name ?? '친구',
    createdAt: card.created_at,
  }));
}

async function listCardsByRecipient(statuses?: AppointmentStatus[]) {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  const { data: recipientData, error: recipientError } = await client
    .from('card_recipients')
    .select('card_id')
    .eq('recipient_profile_id', user.id)
    .order('created_at', { ascending: false });

  if (recipientError) {
    throw recipientError;
  }

  const cardIds = Array.from(new Set(((recipientData ?? []) as CardRecipientRow[]).map((row) => row.card_id)));

  if (cardIds.length === 0) {
    return [];
  }

  let query = client
    .from('appointment_cards')
    .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
    .in('id', cardIds)
    .order('created_at', { ascending: false });

  if (statuses) {
    query = query.in('status', statuses);
  }

  const { data: cardsData, error: cardsError } = await query;

  if (cardsError) {
    throw cardsError;
  }

  const cards = (cardsData ?? []) as AppointmentCardRow[];
  const profilesById = await getProfilesById(cards.map((card) => card.owner_id));
  const mappedCards = await mapCardsWithDetails(cards, profilesById);

  return mappedCards.map((card) => ({
    ...card,
    requesterName: profilesById.get(cards.find((row) => row.id === card.id)?.owner_id ?? '')?.display_name ?? card.hostName,
  }));
}

function formatScheduleDateLabel(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatScheduleTimeLabel(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export const supabasePromiseRepository: PromiseRepository = {
  async getHostProfile() {
    const user = await getAuthenticatedUser();
    return mapProfileToHostProfile(await ensureProfile(user));
  },

  async listRecentCards() {
    const [ownedCards, receivedCards] = await Promise.all([
      listCardsByOwner(),
      listCardsByRecipient(['PENDING', 'VOTING', 'CONFIRMED']),
    ]);
    return mergeManagedCards(ownedCards, receivedCards);
  },

  async listScheduleItems() {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const [{ data, error }, receivedConfirmedCards, ownedConfirmedCards] = await Promise.all([
      client
        .from('appointments')
        .select('id, card_id, title, location, starts_at, ends_at')
        .eq('owner_id', user.id)
        .not('card_id', 'is', null)
        .order('starts_at', { ascending: true }),
      listCardsByRecipient(['CONFIRMED']),
      listCardsByOwner(['CONFIRMED']),
    ]);

    if (error) {
      throw error;
    }

    const ownedConfirmedCardById = new Map(ownedConfirmedCards.map((card) => [card.id, card]));
    const ownerScheduleItems = ((data ?? []) as AppointmentRow[]).map<ScheduleItem>((appointment) => {
      const cardId = appointment.card_id ?? appointment.id;
      const card = ownedConfirmedCardById.get(cardId);

      return {
        id: appointment.id,
        cardId,
        title: appointment.title,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        dateLabel: formatScheduleDateLabel(appointment.starts_at),
        timeLabel: formatScheduleTimeLabel(appointment.starts_at, appointment.ends_at),
        location: appointment.location,
        status: 'REMINDER_ON',
        participants: card?.participants.map((participant) => ({ ...participant })) ?? [],
      };
    });
    const ownerCardIds = new Set(ownerScheduleItems.map((item) => item.cardId));
    const receivedScheduleItems = receivedConfirmedCards
      .map((card) => buildScheduleItemFromConfirmedCard(card))
      .filter((item): item is ScheduleItem => Boolean(item))
      .filter((item) => !ownerCardIds.has(item.cardId));

    return [...ownerScheduleItems, ...receivedScheduleItems].sort((left, right) => {
      const leftTime = left.startsAt ? new Date(left.startsAt).getTime() : 0;
      const rightTime = right.startsAt ? new Date(right.startsAt).getTime() : 0;
      return leftTime - rightTime;
    });
  },

  async listReceivedCardAlerts() {
    return listReceivedCardAlertRows(['PENDING', 'VOTING']);
  },

  async createManagedCard(card) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const profile = await ensureProfile(user);
    const status: AppointmentStatus = card.mode === 'DIRECT' ? 'PENDING' : 'VOTING';

    const { data: cardData, error: cardError } = await client
      .from('appointment_cards')
      .insert({
        owner_id: user.id,
        mode: card.mode,
        status,
        title: card.title,
        location: card.location,
        message: card.message,
      })
      .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
      .single();

    if (cardError) {
      throw cardError;
    }

    const insertedCard = cardData as AppointmentCardRow;
    const { data: candidatesData, error: candidatesError } = await client
      .from('appointment_candidates')
      .insert(
        card.candidates.map((candidate, index) => ({
          card_id: insertedCard.id,
          starts_at: candidate.startsAt,
          ends_at: candidate.endsAt || getCandidateEndsAt(candidate.startsAt),
          label: candidate.label,
          short_label: candidate.shortLabel,
          sort_order: index,
        })),
      )
      .select('id, card_id, starts_at, ends_at, label, short_label, sort_order');

    if (candidatesError) {
      throw candidatesError;
    }

    const candidates = (candidatesData ?? []) as AppointmentCandidateRow[];
    const selectedCandidate = candidates[0];
    const cardWithSelection =
      selectedCandidate && card.mode === 'DIRECT'
        ? await client
            .from('appointment_cards')
            .update({ selected_candidate_id: selectedCandidate.id })
            .eq('id', insertedCard.id)
            .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
            .single()
        : { data: insertedCard, error: null };

    if (cardWithSelection.error) {
      throw cardWithSelection.error;
    }

    const recipientProfileIds = getUniqueRecipientProfileIds(card, user.id);

    if (recipientProfileIds.length > 0) {
      const { error: recipientsError } = await client.from('card_recipients').insert(
        recipientProfileIds.map((recipientProfileId) => ({
          card_id: insertedCard.id,
          recipient_profile_id: recipientProfileId,
        })),
      );

      if (recipientsError) {
        throw recipientsError;
      }
    }

    return mapCard(cardWithSelection.data as AppointmentCardRow, profile, candidates, [], []);
  },

  async sendManagedCardToRecipients(cardId, recipientProfileIds) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const profile = await ensureProfile(user);
    const cleanCardId = cardId.trim();
    const uniqueRecipientProfileIds = Array.from(new Set(recipientProfileIds)).filter(
      (recipientProfileId) => recipientProfileId && recipientProfileId !== user.id,
    );

    if (!cleanCardId) {
      throw new Error('카드를 찾지 못했어요.');
    }

    const { data: cardData, error: cardError } = await client
      .from('appointment_cards')
      .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
      .eq('id', cleanCardId)
      .eq('owner_id', user.id)
      .single();

    if (cardError) {
      throw cardError;
    }

    if (uniqueRecipientProfileIds.length > 0) {
      const { error: recipientsError } = await client.from('card_recipients').upsert(
        uniqueRecipientProfileIds.map((recipientProfileId) => ({
          card_id: cleanCardId,
          recipient_profile_id: recipientProfileId,
        })),
        { ignoreDuplicates: true, onConflict: 'card_id,recipient_profile_id' },
      );

      if (recipientsError) {
        throw recipientsError;
      }
    }

    const cards = await mapCardsWithDetails([cardData as AppointmentCardRow], await getProfilesById([profile.id], profile));

    return cards[0] ?? mapCard(cardData as AppointmentCardRow, profile, [], [], []);
  },

  async deleteManagedCard(cardId) {
    const client = assertSupabase();
    await getAuthenticatedUser();
    const { error } = await client.from('appointment_cards').delete().eq('id', cardId);

    if (error) {
      throw error;
    }
  },

  async confirmManagedCard(input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const profile = await ensureProfile(user);
    const cleanInput = cleanConfirmCardInput(input);

    const { data: cardData, error: cardError } = await client
      .from('appointment_cards')
      .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
      .eq('id', cleanInput.cardId)
      .eq('owner_id', user.id)
      .single();

    if (cardError) {
      throw cardError;
    }

    const { data: candidateData, error: candidateError } = await client
      .from('appointment_candidates')
      .select('id, card_id, starts_at, ends_at, label, short_label, sort_order')
      .eq('id', cleanInput.candidateId)
      .eq('card_id', cleanInput.cardId)
      .single();

    if (candidateError) {
      throw candidateError;
    }

    const card = cardData as AppointmentCardRow;
    const candidate = candidateData as AppointmentCandidateRow;
    const { data: updatedCardData, error: updateCardError } = await client
      .from('appointment_cards')
      .update({
        status: 'CONFIRMED',
        selected_candidate_id: candidate.id,
      })
      .eq('id', card.id)
      .eq('owner_id', user.id)
      .select('id, owner_id, mode, status, title, location, message, public_token, selected_candidate_id, created_at')
      .single();

    if (updateCardError) {
      throw updateCardError;
    }

    const appointmentValues = {
      owner_id: user.id,
      card_id: card.id,
      candidate_id: candidate.id,
      title: card.title,
      location: card.location,
      starts_at: candidate.starts_at,
      ends_at: candidate.ends_at,
      color_key: 'mint',
    };
    const { data: existingAppointment, error: existingAppointmentError } = await client
      .from('appointments')
      .select('id')
      .eq('owner_id', user.id)
      .eq('card_id', card.id)
      .limit(1)
      .maybeSingle();

    if (existingAppointmentError) {
      throw existingAppointmentError;
    }

    const existingAppointmentId = (existingAppointment as AppointmentIdRow | null)?.id;

    if (existingAppointmentId) {
      const { error: updateAppointmentError } = await client
        .from('appointments')
        .update(appointmentValues)
        .eq('id', existingAppointmentId)
        .eq('owner_id', user.id);

      if (updateAppointmentError) {
        throw updateAppointmentError;
      }
    } else {
      const { error: insertAppointmentError } = await client.from('appointments').insert(appointmentValues);

      if (insertAppointmentError) {
        throw insertAppointmentError;
      }
    }

    const confirmedCards = await mapCardsWithDetails([updatedCardData as AppointmentCardRow], await getProfilesById([profile.id], profile));

    return confirmedCards[0] ?? mapCard(updatedCardData as AppointmentCardRow, profile, [candidate], [], []);
  },

  async respondToReceivedCard(input) {
    const client = assertSupabase();
    const user = await getAuthenticatedUser();
    const profile = await ensureProfile(user);
    const cleanInput = cleanRespondToReceivedCardInput(input);
    const { data: recipientData, error: recipientError } = await client
      .from('card_recipients')
      .select('card_id')
      .eq('card_id', cleanInput.cardId)
      .eq('recipient_profile_id', user.id)
      .maybeSingle();

    if (recipientError) {
      throw recipientError;
    }

    if (!recipientData) {
      throw new Error('응답할 카드를 찾지 못했어요.');
    }

    const { data: existingRespondent, error: existingRespondentError } = await client
      .from('appointment_respondents')
      .select('id')
      .eq('card_id', cleanInput.cardId)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existingRespondentError) {
      throw existingRespondentError;
    }

    let respondentId = (existingRespondent as { id: string } | null)?.id;

    if (respondentId) {
      const { error: updateRespondentError } = await client
        .from('appointment_respondents')
        .update({
          display_name: profile.display_name,
        })
        .eq('id', respondentId)
        .eq('profile_id', user.id);

      if (updateRespondentError) {
        throw updateRespondentError;
      }
    } else {
      const { data: insertedRespondent, error: insertRespondentError } = await client
        .from('appointment_respondents')
        .insert({
          card_id: cleanInput.cardId,
          profile_id: user.id,
          display_name: profile.display_name,
        })
        .select('id')
        .single();

      if (insertRespondentError) {
        throw insertRespondentError;
      }

      respondentId = (insertedRespondent as { id: string }).id;
    }

    const { error: responseError } = await client.from('appointment_candidate_responses').upsert(
      cleanInput.responses.map((response) => ({
        respondent_id: respondentId,
        candidate_id: response.candidateId,
        choice: response.choice,
      })),
      { onConflict: 'respondent_id,candidate_id' },
    );

    if (responseError) {
      throw responseError;
    }

    const { error: deliveryError } = await client
      .from('card_recipients')
      .update({ delivery_status: 'RESPONDED' })
      .eq('card_id', cleanInput.cardId)
      .eq('recipient_profile_id', user.id);

    if (deliveryError) {
      throw deliveryError;
    }

    const receivedCards = await listCardsByRecipient(['PENDING', 'VOTING', 'CONFIRMED']);
    const respondedCard = receivedCards.find((card) => card.id === cleanInput.cardId);

    if (!respondedCard) {
      throw new Error('응답한 카드를 다시 불러오지 못했어요.');
    }

    return respondedCard;
  },
};
