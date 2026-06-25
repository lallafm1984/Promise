import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { palette } from '@/constants/theme';
import { BOTTOM_BANNER_AD_HEIGHT } from '@/lib/layoutInsets';

export function BottomBannerAd() {
  const { width } = useWindowDimensions();
  const configuredUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;
  const unitId = configuredUnitId?.trim() ? configuredUnitId : TestIds.BANNER;
  const bannerWidth = Math.min(width, 430);

  return (
    <View style={styles.container}>
      <View style={[styles.bannerShell, { width: bannerWidth }]}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  bannerShell: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    height: BOTTOM_BANNER_AD_HEIGHT,
    justifyContent: 'center',
  },
});
