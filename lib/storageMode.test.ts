import { describe, expect, it } from 'vitest';

import { getStorageModeCopy } from './storageMode';

describe('storage mode copy', () => {
  it('explains card data is local before account sync is available', () => {
    const copy = getStorageModeCopy(false, 'cards');

    expect(copy.tone).toBe('local');
    expect(copy.title).toBe('로그인 전 로컬 저장');
    expect(copy.body).toContain('카드');
    expect(copy.body).toContain('이 기기');
  });

  it('explains schedule data is saved to the account when persisted', () => {
    const copy = getStorageModeCopy(true, 'schedule');

    expect(copy.tone).toBe('persisted');
    expect(copy.title).toBe('계정에 저장 중');
    expect(copy.body).toContain('일정');
    expect(copy.body).toContain('계정');
  });

  it('uses friend-specific wording for local friend data', () => {
    const copy = getStorageModeCopy(false, 'friends');

    expect(copy.body).toContain('친구');
    expect(copy.body).toContain('로그인');
  });
});
