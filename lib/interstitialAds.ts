import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  DEFAULT_INTERSTITIAL_AD_CONFIG,
  INTERSTITIAL_REMOTE_CONFIG_KEYS,
  type InterstitialAdConfig,
  type InterstitialAdPlacement,
  parseInterstitialAdState,
  recordInterstitialAdImpression,
  shouldShowInterstitialAd,
} from '@/lib/interstitialAdPolicy';

const INTERSTITIAL_AD_STATE_KEY = '@whenbollae/interstitial-ad-state/v1';
const REMOTE_CONFIG_FETCH_INTERVAL_MS = 60 * 60 * 1000;
const REMOTE_CONFIG_FETCH_TIMEOUT_MS = 10 * 1000;
const INTERSTITIAL_LOAD_TIMEOUT_MS = 8000;

let activeInterstitialRequest: Promise<boolean> | null = null;

async function readInterstitialAdState() {
  return parseInterstitialAdState(await AsyncStorage.getItem(INTERSTITIAL_AD_STATE_KEY));
}

async function writeInterstitialAdState(state: ReturnType<typeof recordInterstitialAdImpression>) {
  await AsyncStorage.setItem(INTERSTITIAL_AD_STATE_KEY, JSON.stringify(state));
}

async function loadInterstitialAdConfig(): Promise<InterstitialAdConfig> {
  if (Platform.OS === 'web') {
    return DEFAULT_INTERSTITIAL_AD_CONFIG;
  }

  try {
    const {
      fetchAndActivate,
      getBoolean,
      getNumber,
      getRemoteConfig,
    } = await import('@react-native-firebase/remote-config');
    const remoteConfig = getRemoteConfig();

    remoteConfig.defaultConfig = {
      [INTERSTITIAL_REMOTE_CONFIG_KEYS.enabled]: DEFAULT_INTERSTITIAL_AD_CONFIG.enabled,
      [INTERSTITIAL_REMOTE_CONFIG_KEYS.cooldownHours]: DEFAULT_INTERSTITIAL_AD_CONFIG.cooldownHours,
      [INTERSTITIAL_REMOTE_CONFIG_KEYS.maxImpressionsPerDay]: DEFAULT_INTERSTITIAL_AD_CONFIG.maxImpressionsPerDay,
    };
    remoteConfig.settings = {
      fetchTimeoutMillis: REMOTE_CONFIG_FETCH_TIMEOUT_MS,
      minimumFetchIntervalMillis: REMOTE_CONFIG_FETCH_INTERVAL_MS,
    };

    await fetchAndActivate(remoteConfig);

    return {
      enabled: getBoolean(remoteConfig, INTERSTITIAL_REMOTE_CONFIG_KEYS.enabled),
      cooldownHours: getNumber(remoteConfig, INTERSTITIAL_REMOTE_CONFIG_KEYS.cooldownHours),
      maxImpressionsPerDay: getNumber(remoteConfig, INTERSTITIAL_REMOTE_CONFIG_KEYS.maxImpressionsPerDay),
    };
  } catch {
    return DEFAULT_INTERSTITIAL_AD_CONFIG;
  }
}

async function showInterstitialAd() {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const { AdEventType, InterstitialAd, TestIds } = await import('react-native-google-mobile-ads');
    const configuredUnitId = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID;
    const unitId = configuredUnitId?.trim() ? configuredUnitId : TestIds.INTERSTITIAL;
    const interstitial = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let removeLoadedListener: (() => void) | null = null;
      let removeErrorListener: (() => void) | null = null;
      const settle = (shown: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        removeLoadedListener?.();
        removeErrorListener?.();
        resolve(shown);
      };
      const timeout = setTimeout(() => settle(false), INTERSTITIAL_LOAD_TIMEOUT_MS);

      removeLoadedListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        void interstitial.show()
          .then(() => settle(true))
          .catch(() => settle(false));
      });
      removeErrorListener = interstitial.addAdEventListener(AdEventType.ERROR, () => settle(false));

      interstitial.load();
    });
  } catch {
    return false;
  }
}

async function requestInterstitialAdInternal(_placement: InterstitialAdPlacement) {
  const nowMs = Date.now();
  const [config, state] = await Promise.all([
    loadInterstitialAdConfig(),
    readInterstitialAdState(),
  ]);
  const decision = shouldShowInterstitialAd({ config, nowMs, state });

  if (!decision.allowed) {
    return false;
  }

  const shown = await showInterstitialAd();

  if (shown) {
    await writeInterstitialAdState(recordInterstitialAdImpression({ nowMs, state }));
  }

  return shown;
}

export function requestInterstitialAd(placement: InterstitialAdPlacement) {
  if (activeInterstitialRequest) {
    return activeInterstitialRequest;
  }

  activeInterstitialRequest = requestInterstitialAdInternal(placement)
    .catch(() => false)
    .finally(() => {
      activeInterstitialRequest = null;
    });

  return activeInterstitialRequest;
}
