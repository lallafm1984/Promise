import { describe, expect, it } from 'vitest';

import { getAppScreenBottomPadding, getNativeBottomInset, getTabBarHeight } from './layoutInsets';

describe('layout insets', () => {
  it('keeps a minimum native bottom inset for devices without gesture safe area', () => {
    expect(getNativeBottomInset(0)).toBe(16);
    expect(getNativeBottomInset(24)).toBe(24);
  });

  it('reserves bottom-tab height for scrollable tab screens', () => {
    expect(getTabBarHeight(16)).toBe(88);
    expect(getAppScreenBottomPadding({ bottomInset: 16, reserveBottomTabs: false })).toBe(40);
    expect(getAppScreenBottomPadding({ bottomInset: 16, reserveBottomTabs: true })).toBe(112);
  });
});
