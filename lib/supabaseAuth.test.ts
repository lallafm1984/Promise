import { beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.fn();
const setSession = vi.fn();
const signInWithOAuth = vi.fn();
const signOut = vi.fn();
const disableAppNotifications = vi.fn();
const openAuthSessionAsync = vi.fn();

vi.mock('expo-linking', () => ({
  createURL: vi.fn((path: string) => `whenbollae://${path}`),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync,
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession,
      setSession,
      signInWithOAuth,
      signOut,
    },
  },
}));

vi.mock('@/lib/appNotifications', () => ({
  disableAppNotifications,
}));

describe('supabase auth callbacks', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'profile-minseo' } } }, error: null });
    setSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'profile-minseo' } } }, error: null });
    signInWithOAuth.mockReset();
    signOut.mockReset().mockResolvedValue({ error: null });
    disableAppNotifications.mockReset().mockResolvedValue(undefined);
    openAuthSessionAsync.mockReset();
  });

  it('ignores malformed auth callback URLs without touching the auth session', async () => {
    const { createSessionFromUrl } = await import('./supabaseAuth');

    await expect(createSessionFromUrl('not a url')).resolves.toBeNull();

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('exchanges an OAuth code from a valid auth callback URL', async () => {
    const { createSessionFromUrl } = await import('./supabaseAuth');

    await expect(createSessionFromUrl('whenbollae://auth/callback?code=auth-code')).resolves.toEqual({
      user: { id: 'profile-minseo' },
    });

    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
  });

  it('builds the mobile redirect allow-list values for Supabase URL Configuration', async () => {
    const { getAuthRedirectAllowList } = await import('./supabaseAuth');

    expect(getAuthRedirectAllowList()).toEqual(['whenbollae://auth/callback', 'whenbollae://**']);
  });

  it('builds the provider callback URL for Google and Kakao developer consoles', async () => {
    const { getSupabaseProviderCallbackUrl } = await import('./supabaseAuth');

    expect(getSupabaseProviderCallbackUrl('https://uhbbhhlzfjnlqguzvlzw.supabase.co')).toBe(
      'https://uhbbhhlzfjnlqguzvlzw.supabase.co/auth/v1/callback',
    );
    expect(getSupabaseProviderCallbackUrl('bad url')).toBeNull();
  });

  it('recognizes native, web, and Expo auth callback URLs', async () => {
    const { isAuthCallbackUrl } = await import('./supabaseAuth');

    expect(isAuthCallbackUrl('whenbollae://auth/callback?code=auth-code')).toBe(true);
    expect(isAuthCallbackUrl('https://example.com/auth/callback?code=auth-code')).toBe(true);
    expect(isAuthCallbackUrl('exp://127.0.0.1:8081/--/auth/callback?code=auth-code')).toBe(true);
    expect(isAuthCallbackUrl('whenbollae://friends')).toBe(false);
    expect(isAuthCallbackUrl(null)).toBe(false);
  });

  it('opens the provider OAuth session and exchanges the returned code', async () => {
    signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://uhbbhhlzfjnlqguzvlzw.supabase.co/auth/v1/authorize?provider=google' },
      error: null,
    });
    openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: 'whenbollae://auth/callback?code=auth-code',
    });

    const { signInWithSocialProvider } = await import('./supabaseAuth');

    await expect(signInWithSocialProvider('google')).resolves.toEqual({
      user: { id: 'profile-minseo' },
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'whenbollae://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(openAuthSessionAsync).toHaveBeenCalledWith(
      'https://uhbbhhlzfjnlqguzvlzw.supabase.co/auth/v1/authorize?provider=google',
      'whenbollae://auth/callback',
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
  });

  it('leaves the auth session unchanged when the provider window is dismissed', async () => {
    signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://uhbbhhlzfjnlqguzvlzw.supabase.co/auth/v1/authorize?provider=kakao' },
      error: null,
    });
    openAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });

    const { signInWithSocialProvider } = await import('./supabaseAuth');

    await expect(signInWithSocialProvider('kakao')).resolves.toBeNull();

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('cleans up notification registration before signing out', async () => {
    const { signOutFromSupabase } = await import('./supabaseAuth');

    await signOutFromSupabase();

    expect(disableAppNotifications).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(disableAppNotifications.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
  });

  it('still signs out when notification cleanup fails', async () => {
    disableAppNotifications.mockRejectedValueOnce(new Error('토큰 정리 실패'));
    const { signOutFromSupabase } = await import('./supabaseAuth');

    await signOutFromSupabase();

    expect(disableAppNotifications).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
