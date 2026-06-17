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
});
