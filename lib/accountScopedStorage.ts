const ANONYMOUS_ACCOUNT_SCOPE = 'anonymous';

export function getAccountScopedStorageKey(prefix: string, accountId?: string | null) {
  const scope = accountId?.trim() || ANONYMOUS_ACCOUNT_SCOPE;

  return `${prefix}:${encodeURIComponent(scope)}`;
}
