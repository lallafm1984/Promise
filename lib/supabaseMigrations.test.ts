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
});
