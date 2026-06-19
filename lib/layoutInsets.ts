import { spacing } from '@/constants/theme';

export const MIN_NATIVE_BOTTOM_INSET = 16;
export const TAB_BAR_BASE_HEIGHT = 72;

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
  return bottomInset + spacing.xl + (reserveBottomTabs ? TAB_BAR_BASE_HEIGHT : 0);
}
