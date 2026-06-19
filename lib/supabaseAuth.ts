import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Provider, Session } from '@supabase/supabase-js';

import { disableAppNotifications } from '@/lib/appNotifications';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type SocialProviderId = 'google' | 'kakao';

type AuthCallbackParams = {
  accessToken: string | null;
  code: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  refreshToken: string | null;
};

export function getAuthRedirectUrl() {
  return Linking.createURL('auth/callback');
}

export function getAuthRedirectAllowList() {
  const redirectUrl = getAuthRedirectUrl();

  try {
    const parsedUrl = new URL(redirectUrl);
    const wildcardUrl = `${parsedUrl.protocol}//**`;
    return Array.from(new Set([redirectUrl, wildcardUrl]));
  } catch {
    return [redirectUrl];
  }
}

export function getSupabaseProviderCallbackUrl(projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL) {
  if (!projectUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(projectUrl);
    return `${parsedUrl.origin}/auth/v1/callback`;
  } catch {
    return null;
  }
}

export function shouldShowAuthSetupGuide(
  configured: boolean,
  override = process.env.EXPO_PUBLIC_SHOW_AUTH_SETUP,
) {
  if (override === 'true') {
    return true;
  }

  if (override === 'false') {
    return false;
  }

  return !configured;
}

export function isAuthCallbackUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const routePath = `${parsedUrl.hostname}${parsedUrl.pathname}`.replace(/^\/+|\/+$/g, '');
    return routePath === 'auth/callback' || routePath.endsWith('/auth/callback');
  } catch {
    return url.includes('auth/callback');
  }
}

function readAuthParams(url: string): AuthCallbackParams | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const searchParams = parsedUrl.searchParams;

  return {
    accessToken: hashParams.get('access_token') ?? searchParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? searchParams.get('refresh_token'),
    code: searchParams.get('code') ?? hashParams.get('code'),
    errorCode: hashParams.get('error_code') ?? searchParams.get('error_code'),
    errorDescription: hashParams.get('error_description') ?? searchParams.get('error_description'),
  };
}

export async function createSessionFromUrl(url: string): Promise<Session | null> {
  if (!supabase) {
    throw new Error('Supabase 설정이 필요해요.');
  }

  const params = readAuthParams(url);

  if (!params) {
    return null;
  }

  const { accessToken, code, errorCode, errorDescription, refreshToken } = params;

  if (errorCode) {
    throw new Error(errorDescription || errorCode);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data.session;
  }

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithSocialProvider(provider: SocialProviderId) {
  if (!supabase) {
    throw new Error('Supabase 설정이 필요해요.');
  }

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('로그인 URL을 만들지 못했어요.');
  }

  if (Platform.OS === 'web') {
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    return null;
  }

  return createSessionFromUrl(result.url);
}

export async function signOutFromSupabase() {
  if (!supabase) {
    return;
  }

  try {
    await disableAppNotifications();
  } catch {
    // Notification cleanup should not trap a user inside an authenticated session.
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
