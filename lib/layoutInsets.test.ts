import { describe, expect, it } from 'vitest';

import {
  BOTTOM_BANNER_AD_HEIGHT,
  TAB_SCREEN_VISIBLE_GAP_RATIO_AFTER_REDUCTION,
  getAppScreenBottomPadding,
  getNativeBottomInset,
  getTabBarHeight,
} from './layoutInsets';

describe('layout insets', () => {
  it('keeps a minimum native bottom inset for devices without gesture safe area', () => {
    expect(getNativeBottomInset(0)).toBe(16);
    expect(getNativeBottomInset(24)).toBe(24);
  });

  it('keeps the banner clear while halving the visible gap above it', () => {
    expect(getTabBarHeight(16)).toBe(88);
    expect(getAppScreenBottomPadding({ bottomInset: 16, reserveBottomTabs: false })).toBeCloseTo(19.6);
    expect(getAppScreenBottomPadding({ bottomInset: 16, reserveBottomTabs: true })).toBeCloseTo(
      BOTTOM_BANNER_AD_HEIGHT +
        (getTabBarHeight(16) + 2.4) * TAB_SCREEN_VISIBLE_GAP_RATIO_AFTER_REDUCTION,
    );
  });
});
