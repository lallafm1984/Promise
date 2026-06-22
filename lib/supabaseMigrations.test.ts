/// <reference types="node" />

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260616102000_revoke_notification_trigger_function_execute.sql',
);
const pushChannelMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260616114000_expo_push_channel_priority.sql',
);
const ownedCardPolicyMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260618123000_relax_owned_card_creation_policy.sql',
);
const ownerCardSelectPolicyMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260618130000_allow_owner_card_select_for_insert_returning.sql',
);
const responsePushMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260619173000_response_and_confirmation_push_notifications.sql',
);
const mobileDeltaSyncMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260620074000_mobile_delta_sync.sql',
);
const mobileSyncVersionsMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260620080000_mobile_sync_versions.sql',
);
const appointmentCardExpirationMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260620093000_appointment_card_expiration.sql',
);
const expiredAppointmentCardCleanupMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260620094500_cleanup_all_expired_appointment_cards.sql',
);
const shortProfileHandlesMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622123000_short_profile_handles.sql',
);
const friendPushCopyMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622133500_friend_push_notification_copy.sql',
);
const cardReceivedPushCopyMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622141000_card_received_push_notification_copy.sql',
);
const ownerResetCardResponsesMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622142000_allow_owner_reset_card_candidate_responses.sql',
);
const notificationTokenClaimMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622150000_claim_notification_tokens_and_card_recipient_realtime.sql',
);
const friendRequestRealtimeMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260622153000_friend_request_realtime_notifications.sql',
);

describe('Supabase notification migrations', () => {
  it('revokes direct client execution from notification trigger functions', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('revoke all on function public.notify_friend_request_created() from public;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_created() from anon;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_created() from authenticated;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_accepted() from public;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_accepted() from anon;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_accepted() from authenticated;');
    expect(sql).toContain('revoke all on function public.notify_card_recipient_created() from public;');
    expect(sql).toContain('revoke all on function public.notify_card_recipient_created() from anon;');
    expect(sql).toContain('revoke all on function public.notify_card_recipient_created() from authenticated;');
  });

  it('uses the app notification channel and high delivery priority for Expo push payloads', () => {
    expect(existsSync(pushChannelMigrationPath)).toBe(true);

    const sql = readFileSync(pushChannelMigrationPath, 'utf8');

    expect(sql).toContain(`'channelId', 'whenbollae-default'`);
    expect(sql).toContain(`'priority', 'high'`);
  });

  it('lets the current account claim its device push token and publishes card recipients for realtime refresh', () => {
    expect(existsSync(notificationTokenClaimMigrationPath)).toBe(true);

    const sql = readFileSync(notificationTokenClaimMigrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.register_notification_token');
    expect(sql).toContain('delete from public.notification_tokens');
    expect(sql).toContain('where provider = notification_provider');
    expect(sql).toContain('and token = notification_token');
    expect(sql).toContain('insert into public.notification_tokens');
    expect(sql).toContain('grant execute on function public.register_notification_token(text, text, text) to authenticated;');
    expect(sql).toContain('alter publication supabase_realtime add table public.card_recipients;');
  });

  it('publishes friend requests for realtime social notification refresh', () => {
    expect(existsSync(friendRequestRealtimeMigrationPath)).toBe(true);

    const sql = readFileSync(friendRequestRealtimeMigrationPath, 'utf8');

    expect(sql).toContain('alter publication supabase_realtime add table public.friend_requests;');
    expect(sql).toContain('when duplicate_object then null;');
  });

  it('uses request-arrived and friendship-complete copy for friend push notifications', () => {
    expect(existsSync(friendPushCopyMigrationPath)).toBe(true);

    const sql = readFileSync(friendPushCopyMigrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.notify_friend_request_created()');
    expect(sql).toContain("'친구 요청이 왔어요'");
    expect(sql).toContain("|| '님에게서 친구 요청이 왔어요.'");
    expect(sql).toContain('create or replace function public.notify_friend_request_accepted()');
    expect(sql).toContain("'친구가 되었어요'");
    expect(sql).toContain("|| '와 친구가 되었어요.'");
    expect(sql).toContain('revoke all on function public.notify_friend_request_created() from authenticated;');
    expect(sql).toContain('revoke all on function public.notify_friend_request_accepted() from authenticated;');
  });

  it('uses friend-sent-card copy for received card push notifications', () => {
    expect(existsSync(cardReceivedPushCopyMigrationPath)).toBe(true);

    const sql = readFileSync(cardReceivedPushCopyMigrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.notify_card_recipient_created()');
    expect(sql).toContain("'친구가 카드를 보냈어요'");
    expect(sql).toContain("|| '님이 ' || coalesce(card_location, '약속') || ' 약속 카드를 보냈어요.'");
    expect(sql).toContain(`'type', 'card_received'`);
    expect(sql).toContain('revoke all on function public.notify_card_recipient_created() from authenticated;');
  });

  it('allows card owners to delete stale candidate responses when editing a card schedule', () => {
    expect(existsSync(ownerResetCardResponsesMigrationPath)).toBe(true);

    const sql = readFileSync(ownerResetCardResponsesMigrationPath, 'utf8');

    expect(sql).toContain('create policy "Card owners can delete candidate responses on own cards"');
    expect(sql).toContain('on public.appointment_candidate_responses for delete');
    expect(sql).toContain('public.is_appointment_card_owner(r.card_id)');
    expect(sql).toContain('create policy "Card owners can delete respondents on own cards"');
    expect(sql).toContain('on public.appointment_respondents for delete');
  });

  it('allows authenticated users to create their own cards and candidates', () => {
    expect(existsSync(ownedCardPolicyMigrationPath)).toBe(true);

    const sql = readFileSync(ownedCardPolicyMigrationPath, 'utf8');

    expect(sql).toContain('drop policy if exists "Users can create own cards" on public.appointment_cards;');
    expect(sql).toContain('with check (owner_id = auth.uid());');
    expect(sql).toContain(
      'drop policy if exists "Users can create candidates for own cards" on public.appointment_candidates;',
    );
    expect(sql).toContain('with check (public.is_appointment_card_owner(card_id));');
  });

  it('lets card owners read newly inserted cards without a self-lookup policy', () => {
    expect(existsSync(ownerCardSelectPolicyMigrationPath)).toBe(true);

    const sql = readFileSync(ownerCardSelectPolicyMigrationPath, 'utf8');

    expect(sql).toContain('drop policy if exists "Users can read own or received cards" on public.appointment_cards;');
    expect(sql).toContain('owner_id = auth.uid()');
    expect(sql).toContain('or public.can_access_appointment_card(id)');
  });

  it('sends push notifications for card responses and confirmed schedules', () => {
    expect(existsSync(responsePushMigrationPath)).toBe(true);

    const sql = readFileSync(responsePushMigrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.notify_card_response_received()');
    expect(sql).toContain('after insert on public.appointment_respondents');
    expect(sql).toContain(`'url', '/manage?tab=SENT_HAS_RESPONSE'`);
    expect(sql).toContain('create or replace function public.notify_card_confirmed()');
    expect(sql).toContain('after update of status on public.appointment_cards');
    expect(sql).toContain(`'url', '/manage?tab=RECEIVED_CONFIRMED'`);
    expect(sql).toContain('revoke all on function public.notify_card_response_received() from authenticated;');
    expect(sql).toContain('revoke all on function public.notify_card_confirmed() from authenticated;');
  });

  it('adds mobile delta sync metadata without opening anonymous access', () => {
    expect(existsSync(mobileDeltaSyncMigrationPath)).toBe(true);

    const sql = readFileSync(mobileDeltaSyncMigrationPath, 'utf8');

    expect(sql).toContain('alter table public.appointments');
    expect(sql).toContain('add column if not exists deleted_at timestamptz;');
    expect(sql).toContain('alter table public.todos');
    expect(sql).toContain('create index if not exists appointments_owner_updated_idx');
    expect(sql).toContain('create index if not exists todos_owner_deleted_idx');
    expect(sql).toContain('create or replace function public.get_mobile_sync_snapshot(p_since timestamptz default null)');
    expect(sql).toContain('security definer');
    expect(sql).toContain('revoke all on function public.get_mobile_sync_snapshot(timestamptz) from anon;');
    expect(sql).toContain('grant execute on function public.get_mobile_sync_snapshot(timestamptz) to authenticated;');
  });

  it('tracks per-user mobile sync versions through database triggers', () => {
    expect(existsSync(mobileSyncVersionsMigrationPath)).toBe(true);

    const sql = readFileSync(mobileSyncVersionsMigrationPath, 'utf8');

    expect(sql).toContain('create table if not exists public.mobile_sync_versions');
    expect(sql).toContain('alter table public.mobile_sync_versions enable row level security;');
    expect(sql).toContain('create or replace function public.touch_mobile_sync_version(target_user_id uuid)');
    expect(sql).toContain('create trigger touch_appointment_card_mobile_sync_delete');
    expect(sql).toContain('before delete on public.appointment_cards');
    expect(sql).toContain('create trigger touch_card_recipient_mobile_sync_delete');
    expect(sql).toContain('before delete on public.card_recipients');
    expect(sql).toContain('insert into public.mobile_sync_versions (user_id, version, updated_at)');
    expect(sql).toContain('create or replace function public.get_mobile_sync_snapshot(p_since timestamptz default null)');
    expect(sql).toContain('from public.mobile_sync_versions');
    expect(sql).toContain('revoke all on function public.touch_mobile_sync_version(uuid) from authenticated;');
    expect(sql).toContain('grant execute on function public.get_mobile_sync_snapshot(timestamptz) to authenticated;');
  });

  it('expires temporary shared cards after the three-day response window', () => {
    expect(existsSync(appointmentCardExpirationMigrationPath)).toBe(true);

    const sql = readFileSync(appointmentCardExpirationMigrationPath, 'utf8');

    expect(sql).toContain('alter table public.appointment_cards');
    expect(sql).toContain('add column if not exists expires_at timestamptz;');
    expect(sql).toContain("interval '3 days'");
    expect(sql).toContain('create index if not exists appointment_cards_open_expires_idx');
    expect(sql).toContain('create or replace function public.cleanup_expired_appointment_cards()');
    expect(sql).toContain("status in ('PENDING'::public.appointment_status, 'VOTING'::public.appointment_status)");
    expect(sql).toContain('revoke all on function public.cleanup_expired_appointment_cards() from anon;');
    expect(sql).toContain('grant execute on function public.cleanup_expired_appointment_cards() to service_role;');
  });

  it('cleans up all expired shared cards and their server schedule rows', () => {
    expect(existsSync(expiredAppointmentCardCleanupMigrationPath)).toBe(true);

    const sql = readFileSync(expiredAppointmentCardCleanupMigrationPath, 'utf8');

    expect(sql).toContain('create index if not exists appointment_cards_expires_idx');
    expect(sql).toContain('create or replace function public.cleanup_expired_appointment_cards()');
    expect(sql).toContain('where expires_at <= now()');
    expect(sql).toContain('delete from public.appointments');
    expect(sql).toContain('where a.card_id = e.id');
    expect(sql).toContain('delete from public.appointment_cards');
    expect(sql).not.toContain('status in (');
    expect(sql).toContain('revoke all on function public.cleanup_expired_appointment_cards() from anon;');
    expect(sql).toContain('grant execute on function public.cleanup_expired_appointment_cards() to service_role;');
  });

  it('generates short public profile handles for friend sharing', () => {
    expect(existsSync(shortProfileHandlesMigrationPath)).toBe(true);

    const sql = readFileSync(shortProfileHandlesMigrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.generate_short_profile_handle()');
    expect(sql).toContain("substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6)");
    expect(sql).toContain('public.generate_short_profile_handle()');
    expect(sql).toContain("|| '_' || substr(u.id::text, 1, 8)");
    expect(sql).toContain('revoke all on function public.generate_short_profile_handle() from authenticated;');
  });
});
