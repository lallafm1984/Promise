import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRepositorySource() {
  return readFileSync(resolve(process.cwd(), 'data/supabasePromiseRepository.ts'), 'utf8');
}

describe('supabase promise repository card change reset', () => {
  it('deletes stale candidate responses before deleting respondents and candidates', () => {
    const source = readRepositorySource();
    const requestChangeStart = source.indexOf('async requestManagedCardChange(card)');
    const requestChangeEnd = source.indexOf('async deleteManagedCard', requestChangeStart);
    const requestChangeBlock = source.slice(requestChangeStart, requestChangeEnd);
    const responseDeleteStart = requestChangeBlock.indexOf(".from('appointment_candidate_responses')");
    const respondentDeleteStart = requestChangeBlock.indexOf('const { error: respondentDeleteError }');
    const candidateDeleteStart = requestChangeBlock.indexOf('const { error: candidateDeleteError }');

    expect(requestChangeStart).toBeGreaterThan(-1);
    expect(responseDeleteStart).toBeGreaterThan(-1);
    expect(respondentDeleteStart).toBeGreaterThan(-1);
    expect(candidateDeleteStart).toBeGreaterThan(-1);
    expect(responseDeleteStart).toBeLessThan(respondentDeleteStart);
    expect(responseDeleteStart).toBeLessThan(candidateDeleteStart);
    expect(requestChangeBlock).toContain(".in('respondent_id', respondentIds)");
  });
});

describe('supabase promise repository received replies', () => {
  it('saves the receiver one-line message with the respondent row', () => {
    const source = readRepositorySource();
    const responseStart = source.indexOf('async respondToReceivedCard(input)');
    const responseEnd = source.indexOf('const { error: responseError }', responseStart);
    const responseBlock = source.slice(responseStart, responseEnd);
    const cleanStart = source.indexOf('function cleanRespondToReceivedCardInput');
    const cleanEnd = source.indexOf('function mapCard', cleanStart);
    const cleanBlock = source.slice(cleanStart, cleanEnd);

    expect(cleanStart).toBeGreaterThan(-1);
    expect(responseStart).toBeGreaterThan(-1);
    expect(cleanBlock).toContain('respondentComment');
    expect(responseBlock).toContain('comment: cleanInput.respondentComment');
    expect(responseBlock).toContain('const respondentValues');
    expect(responseBlock).toContain('.update(respondentValues)');
    expect(responseBlock).toContain('.insert({');
    expect(responseBlock).toContain('comment: cleanInput.respondentComment ??');
  });

  it('rejects stale received-card replies before writing candidate responses', () => {
    const source = readRepositorySource();
    const responseStart = source.indexOf('async respondToReceivedCard(input)');
    const responseEnd = source.indexOf('const { error: responseError }', responseStart);
    const responseBlock = source.slice(responseStart, responseEnd);

    expect(responseStart).toBeGreaterThan(-1);
    expect(responseBlock).toContain('createReceivedCardResponseUnavailableError');
    expect(responseBlock).toContain(".from('appointment_cards')");
    expect(responseBlock).toContain(".from('appointment_candidates')");
    expect(responseBlock).toContain("!['PENDING', 'VOTING'].includes(cardStatusData.status)");
    expect(responseBlock).toContain('hasSameResponseCandidateSet');
  });
});

describe('supabase promise repository schedule items', () => {
  it('adds received confirmed cards to the schedule list without requiring recipient appointment rows', () => {
    const source = readRepositorySource();
    const scheduleStart = source.indexOf('async listScheduleItems()');
    const scheduleEnd = source.indexOf('async listReceivedCardAlerts()', scheduleStart);
    const scheduleBlock = source.slice(scheduleStart, scheduleEnd);

    expect(scheduleStart).toBeGreaterThan(-1);
    expect(scheduleEnd).toBeGreaterThan(scheduleStart);
    expect(scheduleBlock).toContain("listCardsByRecipient(['CONFIRMED'])");
    expect(scheduleBlock).toContain('buildScheduleItemFromConfirmedCard(card, currentProfile)');
    expect(scheduleBlock).toContain('return [...ownerScheduleItems, ...receivedScheduleItems]');
  });

  it('formats owner appointment rows with the same schedule label helper as received confirmed cards', () => {
    const source = readRepositorySource();
    const scheduleStart = source.indexOf('async listScheduleItems()');
    const scheduleEnd = source.indexOf('async listReceivedCardAlerts()', scheduleStart);
    const scheduleBlock = source.slice(scheduleStart, scheduleEnd);

    expect(source).toContain('buildScheduleLabels');
    expect(source).not.toContain('function formatScheduleDateLabel');
    expect(source).not.toContain('function formatScheduleTimeLabel');
    expect(scheduleBlock).toContain('const scheduleLabels = buildScheduleLabels(appointment.starts_at, appointment.ends_at)');
    expect(scheduleBlock).toContain('dateLabel: scheduleLabels.dateLabel');
    expect(scheduleBlock).toContain('timeLabel: scheduleLabels.timeLabel');
  });

  it('uses the shared card schedule title and hides the current viewer from schedule participants', () => {
    const source = readRepositorySource();
    const scheduleStart = source.indexOf('async listScheduleItems()');
    const scheduleEnd = source.indexOf('async listReceivedCardAlerts()', scheduleStart);
    const scheduleBlock = source.slice(scheduleStart, scheduleEnd);

    expect(source).toContain('buildCardScheduleTitle');
    expect(source).toContain('getScheduleParticipantsForViewer');
    expect(scheduleBlock).toContain('const currentProfile = { id: user.id, displayName:');
    expect(scheduleBlock).toContain('title: buildCardScheduleTitle(appointment.location)');
    expect(scheduleBlock).toContain('getScheduleParticipantsForViewer(card?.participants ?? [], currentProfile)');
    expect(scheduleBlock).toContain('buildScheduleItemFromConfirmedCard(card, currentProfile)');
  });

  it('hydrates schedule participants from invited recipients even before responses exist', () => {
    const source = readRepositorySource();
    const mapDetailsStart = source.indexOf('async function mapCardsWithDetails');
    const mapDetailsEnd = source.indexOf('async function listCardsByOwner', mapDetailsStart);
    const mapDetailsBlock = source.slice(mapDetailsStart, mapDetailsEnd);
    const mapCardStart = source.indexOf('function mapCard(');
    const mapCardEnd = source.indexOf('async function getProfilesById', mapCardStart);
    const mapCardBlock = source.slice(mapCardStart, mapCardEnd);

    expect(mapDetailsStart).toBeGreaterThan(-1);
    expect(mapDetailsEnd).toBeGreaterThan(mapDetailsStart);
    expect(mapCardStart).toBeGreaterThan(-1);
    expect(mapCardEnd).toBeGreaterThan(mapCardStart);
    expect(mapDetailsBlock).toContain(".from('card_recipients')");
    expect(mapDetailsBlock).toContain(".select('card_id, recipient_profile_id')");
    expect(mapDetailsBlock).toContain('recipientProfileIds');
    expect(mapDetailsBlock).toContain('getProfilesById(participantProfileIds)');
    expect(mapCardBlock).toContain('buildInvitedParticipant');
    expect(mapCardBlock).toContain('mergeParticipantResponse');
    expect(source).toContain("choice: 'UNANSWERED'");
  });
});
