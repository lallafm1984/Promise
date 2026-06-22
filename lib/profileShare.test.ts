import { describe, expect, it } from 'vitest';

import {
  buildProfileShareMessage,
  getProfileHandleForClipboard,
  getProfileShareUrlForClipboard,
  getProfileShareUrlForMessage,
} from './profileShare';

const profile = {
  displayName: '민서',
  handle: 'a1b2c3',
  profileUrl: 'whenbollae.app/@a1b2c3',
};

describe('profile share helpers', () => {
  it('builds a friend-add share message with the short id only', () => {
    expect(buildProfileShareMessage(profile)).toBe(
      ['민서님의 언제볼래 친구 아이디', '@a1b2c3', '언제볼래에서 친구 추가해 주세요.'].join('\n'),
    );
  });

  it('uses a full https link for clipboard and a compact link for share messages', () => {
    expect(getProfileShareUrlForClipboard(profile)).toBe('https://whenbollae.app/@a1b2c3');
    expect(getProfileShareUrlForMessage(profile)).toBe('whenbollae.app/@a1b2c3');
  });

  it('copies the friend id in the same format shown on the profile screen', () => {
    expect(getProfileHandleForClipboard(profile)).toBe('@a1b2c3');
  });
});
