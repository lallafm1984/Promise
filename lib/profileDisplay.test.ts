import { describe, expect, it } from 'vitest';

import type { HostProfile } from '@/types/promise';
import { resolveDisplayProfile } from './profileDisplay';

function profile(id: string, displayName: string): HostProfile {
  return {
    id,
    displayName,
    handle: displayName.toLowerCase(),
    profileUrl: `whenbollae.app/@${displayName.toLowerCase()}`,
    timezone: 'Asia/Seoul',
    availabilitySummary: [],
    reminderLead: '30_MIN',
  };
}

describe('resolveDisplayProfile', () => {
  it('uses the saved profile as an optimistic profile for the same account', () => {
    const loadedProfile = profile('profile-minseo', '민서');
    const savedProfile = profile('profile-minseo', '민서 수정');

    expect(resolveDisplayProfile(loadedProfile, savedProfile)?.displayName).toBe('민서 수정');
  });

  it('drops the saved profile when the loaded account changes', () => {
    const loadedProfile = profile('profile-local', '내 프로필');
    const savedProfile = profile('profile-minseo', '민서 수정');

    expect(resolveDisplayProfile(loadedProfile, savedProfile)?.displayName).toBe('내 프로필');
  });
});
