import { describe, expect, it } from 'vitest';

import { getAccountScopedStorageKey } from './accountScopedStorage';

describe('account scoped storage keys', () => {
  it('separates local storage by account id', () => {
    const prefix = '@whenbollae/promise-data-cache/v1';

    expect(getAccountScopedStorageKey(prefix, 'user-a')).toBe('@whenbollae/promise-data-cache/v1:user-a');
    expect(getAccountScopedStorageKey(prefix, 'user-b')).toBe('@whenbollae/promise-data-cache/v1:user-b');
  });

  it('keeps logged-out local storage in an anonymous scope', () => {
    expect(getAccountScopedStorageKey('@whenbollae/schedule-planner-cache/v1', null)).toBe(
      '@whenbollae/schedule-planner-cache/v1:anonymous',
    );
  });

  it('escapes ids that would otherwise collide with key separators', () => {
    expect(getAccountScopedStorageKey('@whenbollae/cache/v1', 'provider:user/a')).toBe(
      '@whenbollae/cache/v1:provider%3Auser%2Fa',
    );
  });
});
