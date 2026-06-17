import type { PostgrestError, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { HostProfile } from '@/types/promise';

export const CARD_BASE_URL = (process.env.EXPO_PUBLIC_CARD_BASE_URL ?? 'https://whenbollae.app').replace(/\/+$/, '');

export interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  handle: string;
}

const profileColors = ['#BFE8FF', '#FFC9BA', '#FFE0B8', '#DDEBFF', '#FFF0B8', '#E9DDFF', '#DDF4F2'];

export function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase 설정이 필요해요.');
  }

  return supabase;
}

export async function getAuthenticatedUser(): Promise<User> {
  const client = assertSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('로그인이 필요해요.');
  }

  return data.user;
}

export function normalizeProfileHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 20);
}

export function cleanProfileUpdateInput(input: ProfileUpdateInput): ProfileUpdateInput {
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  const handle = normalizeProfileHandle(input.handle);

  if (!displayName) {
    throw new Error('이름을 입력해 주세요.');
  }

  if (displayName.length > 60) {
    throw new Error('이름은 60자 이하로 입력해 주세요.');
  }

  if (handle.length < 3) {
    throw new Error('아이디는 3자 이상 입력해 주세요.');
  }

  return {
    displayName,
    handle,
  };
}

function getPostgrestCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as PostgrestError).code : undefined;
}

export async function ensureProfile(user: User): Promise<ProfileRow> {
  const client = assertSupabase();
  const { data: existingProfile, error: existingError } = await client
    .from('profiles')
    .select('id, handle, display_name, avatar_url, timezone')
    .eq('id', user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingProfile) {
    return existingProfile as ProfileRow;
  }

  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split('@')[0] ?? 'user';
  const handle = `${normalizeProfileHandle(String(metadata.preferred_username ?? emailName)) || 'user'}_${user.id.slice(0, 8)}`;
  const displayName =
    String(metadata.name ?? metadata.full_name ?? emailName).trim().slice(0, 60) || '새 친구';

  const { data: insertedProfile, error: insertError } = await client
    .from('profiles')
    .insert({
      id: user.id,
      handle,
      display_name: displayName,
      avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
    })
    .select('id, handle, display_name, avatar_url, timezone')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile as ProfileRow;
}

export async function updateAuthenticatedProfile(input: ProfileUpdateInput): Promise<ProfileRow> {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  await ensureProfile(user);
  const cleanInput = cleanProfileUpdateInput(input);
  const { data: existingHandleOwner, error: existingHandleError } = await client
    .from('profiles')
    .select('id')
    .eq('handle', cleanInput.handle)
    .neq('id', user.id)
    .maybeSingle();

  if (existingHandleError) {
    throw existingHandleError;
  }

  if (existingHandleOwner) {
    throw new Error(`@${cleanInput.handle} 아이디는 이미 사용 중이에요.`);
  }

  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: cleanInput.displayName,
      handle: cleanInput.handle,
    })
    .eq('id', user.id)
    .select('id, handle, display_name, avatar_url, timezone')
    .single();

  if (error) {
    if (getPostgrestCode(error) === '23505') {
      throw new Error(`@${cleanInput.handle} 아이디는 이미 사용 중이에요.`);
    }

    throw error;
  }

  return data as ProfileRow;
}

export function mapProfileToHostProfile(row: ProfileRow): HostProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    handle: row.handle,
    profileUrl: `${CARD_BASE_URL}/@${row.handle}`.replace(/^https?:\/\//, ''),
    timezone: row.timezone,
    availabilitySummary: ['Supabase 계정 동기화 중', '카드와 일정이 계정에 저장됨'],
    reminderLead: '30_MIN',
  };
}

export function getProfileAvatarLabel(displayName: string) {
  return displayName.trim().slice(0, 1) || '?';
}

export function getProfileColor(handle: string) {
  const seed = handle.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return profileColors[seed % profileColors.length];
}
