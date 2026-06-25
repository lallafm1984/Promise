import { spacing } from '@/constants/theme';

export const MIN_NATIVE_BOTTOM_INSET = 16;
export const TAB_BAR_BASE_HEIGHT = 72;
export const BOTTOM_BANNER_AD_HEIGHT = 58;
export const BOTTOM_EXTRA_GAP_RATIO_AFTER_REDUCTION = 0.15;
export const TAB_SCREEN_VISIBLE_GAP_RATIO_AFTER_REDUCTION = 0.47;
const PREVIOUS_BOTTOM_EXTRA_GAP_RATIO = 0.3;

export function getNativeBottomInset(bottomInset: number) {
  return Math.max(bottomInset, MIN_NATIVE_BOTTOM_INSET);
}

export function getTabBarHeight(bottomInset: number) {
  return TAB_BAR_BASE_HEIGHT + bottomInset;
}

export function getAppScreenBottomPadding({
  bottomInset,
  reserveBottomTabs = false,
}: {
  bottomInset: number;
  reserveBottomTabs?: boolean;
}) {
  if (reserveBottomTabs) {
    return (
      BOTTOM_BANNER_AD_HEIGHT +
      (getTabBarHeight(bottomInset) + spacing.xs * PREVIOUS_BOTTOM_EXTRA_GAP_RATIO) *
        TAB_SCREEN_VISIBLE_GAP_RATIO_AFTER_REDUCTION
    );
  }

  return bottomInset + spacing.xl * BOTTOM_EXTRA_GAP_RATIO_AFTER_REDUCTION;
}
