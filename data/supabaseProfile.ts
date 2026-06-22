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
}

export const PROFILE_HANDLE_LENGTH = 6;
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
    .slice(0, PROFILE_HANDLE_LENGTH);
}

export function getGeneratedProfileHandle(userId: string, attempt = 0) {
  const source = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const fallback = `user${attempt.toString(36).padStart(2, '0')}`.slice(0, PROFILE_HANDLE_LENGTH);
  const start = attempt * PROFILE_HANDLE_LENGTH;
  const chunk = source.slice(start, start + PROFILE_HANDLE_LENGTH);

  if (chunk.length === PROFILE_HANDLE_LENGTH) {
    return chunk;
  }

  return `${chunk}${fallback}`.slice(0, PROFILE_HANDLE_LENGTH);
}

export function isLegacyGeneratedProfileHandle(handle: string) {
  return /^[a-z0-9._-]{1,20}_[a-f0-9]{8}$/.test(handle);
}

function normalizeLegacyProfileHandleBase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 20);
}

export function getLegacyGeneratedProfileHandle(user: Pick<User, 'id' | 'email' | 'user_metadata'>) {
  const metadata = user.user_metadata ?? {};
  const preferredUsername = typeof metadata.preferred_username === 'string' ? metadata.preferred_username : '';
  const emailName = user.email?.split('@')[0] ?? '';
  const baseHandle = normalizeLegacyProfileHandleBase(preferredUsername || emailName || 'user') || 'user';

  return `${baseHandle}_${user.id.slice(0, 8)}`;
}

export function cleanProfileUpdateInput(input: ProfileUpdateInput): ProfileUpdateInput {
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');

  if (!displayName) {
    throw new Error('이름을 입력해 주세요.');
  }

  if (displayName.length > 60) {
    throw new Error('이름은 60자 이하로 입력해 주세요.');
  }

  return {
    displayName,
  };
}

function getPostgrestCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as PostgrestError).code : undefined;
}

async function compactLegacyProfileHandle(profile: ProfileRow, user: User): Promise<ProfileRow> {
  if (!isLegacyGeneratedProfileHandle(profile.handle) || profile.handle !== getLegacyGeneratedProfileHandle(user)) {
    return profile;
  }

  const client = assertSupabase();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextHandle = getGeneratedProfileHandle(profile.id, attempt);

    if (nextHandle === profile.handle) {
      return profile;
    }

    const { data, error } = await client
      .from('profiles')
      .update({ handle: nextHandle })
      .eq('id', profile.id)
      .select('id, handle, display_name, avatar_url, timezone')
      .single();

    if (!error) {
      return data as ProfileRow;
    }

    if (getPostgrestCode(error) !== '23505') {
      throw error;
    }
  }

  return profile;
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
    return compactLegacyProfileHandle(existingProfile as ProfileRow, user);
  }

  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split('@')[0] ?? 'user';
  const displayName =
    String(metadata.name ?? metadata.full_name ?? emailName).trim().slice(0, 60) || '새 친구';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: insertedProfile, error: insertError } = await client
      .from('profiles')
      .insert({
        id: user.id,
        handle: getGeneratedProfileHandle(user.id, attempt),
        display_name: displayName,
        avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
      })
      .select('id, handle, display_name, avatar_url, timezone')
      .single();

    if (!insertError) {
      return insertedProfile as ProfileRow;
    }

    if (getPostgrestCode(insertError) !== '23505') {
      throw insertError;
    }
  }

  throw new Error('사용 가능한 6자리 아이디를 만들지 못했어요.');
}

export async function updateAuthenticatedProfile(input: ProfileUpdateInput): Promise<ProfileRow> {
  const client = assertSupabase();
  const user = await getAuthenticatedUser();
  await ensureProfile(user);
  const cleanInput = cleanProfileUpdateInput(input);

  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: cleanInput.displayName,
    })
    .eq('id', user.id)
    .select('id, handle, display_name, avatar_url, timezone')
    .single();

  if (error) {
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
