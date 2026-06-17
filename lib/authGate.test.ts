import { describe, expect, it } from 'vitest';

import { getMandatoryAuthGateState } from './authGate';

describe('mandatory auth gate', () => {
  it('keeps the splash screen up while the initial session is loading', () => {
    expect(getMandatoryAuthGateState({ isAuthenticated: false, isLoading: true })).toEqual({
      canHideSplash: false,
      canUseAppRoutes: false,
      canUseAuthCallback: true,
      canUseLoginRoute: true,
    });
  });

  it('allows only the login route before a user signs in', () => {
    expect(getMandatoryAuthGateState({ isAuthenticated: false, isLoading: false })).toEqual({
      canHideSplash: true,
      canUseAppRoutes: false,
      canUseAuthCallback: true,
      canUseLoginRoute: true,
    });
  });

  it('allows only authenticated app routes after a user signs in', () => {
    expect(getMandatoryAuthGateState({ isAuthenticated: true, isLoading: false })).toEqual({
      canHideSplash: true,
      canUseAppRoutes: true,
      canUseAuthCallback: true,
      canUseLoginRoute: false,
    });
  });
});
