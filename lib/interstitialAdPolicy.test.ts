import { describe, expect, it } from 'vitest';

import {
  EMPTY_INTERSTITIAL_AD_STATE,
  getInterstitialAdDateKey,
  normalizeInterstitialAdConfig,
  parseInterstitialAdState,
  recordInterstitialAdImpression,
  shouldShowInterstitialAd,
} from './interstitialAdPolicy';

describe('interstitial ad policy', () => {
  const nowMs = new Date(2026, 5, 24, 12, 0, 0).getTime();

  it('keeps interstitial ads disabled by default', () => {
    const config = normalizeInterstitialAdConfig({});

    expect(config).toEqual({
      enabled: false,
      cooldownHours: 8,
      maxImpressionsPerDay: 2,
    });
    expect(shouldShowInterstitialAd({ config, nowMs, state: EMPTY_INTERSTITIAL_AD_STATE })).toEqual({
      allowed: false,
      reason: 'disabled',
    });
  });

  it('allows an enabled ad when cooldown and daily limit allow it', () => {
    const config = normalizeInterstitialAdConfig({
      enabled: true,
      cooldownHours: 1,
      maxImpressionsPerDay: 2,
    });

    expect(shouldShowInterstitialAd({ config, nowMs, state: EMPTY_INTERSTITIAL_AD_STATE })).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  it('blocks impressions during cooldown', () => {
    const config = normalizeInterstitialAdConfig({
      enabled: true,
      cooldownHours: 2,
      maxImpressionsPerDay: 3,
    });
    const state = recordInterstitialAdImpression({ nowMs, state: EMPTY_INTERSTITIAL_AD_STATE });

    expect(shouldShowInterstitialAd({ config, nowMs: nowMs + 60 * 60 * 1000, state })).toEqual({
      allowed: false,
      reason: 'cooldown',
    });
  });

  it('blocks impressions after the daily limit is reached', () => {
    const config = normalizeInterstitialAdConfig({
      enabled: true,
      cooldownHours: 0,
      maxImpressionsPerDay: 1,
    });
    const state = recordInterstitialAdImpression({ nowMs, state: EMPTY_INTERSTITIAL_AD_STATE });

    expect(shouldShowInterstitialAd({ config, nowMs: nowMs + 60 * 60 * 1000, state })).toEqual({
      allowed: false,
      reason: 'daily_limit',
    });
  });

  it('resets the daily count on the next local date', () => {
    const config = normalizeInterstitialAdConfig({
      enabled: true,
      cooldownHours: 0,
      maxImpressionsPerDay: 1,
    });
    const state = recordInterstitialAdImpression({ nowMs, state: EMPTY_INTERSTITIAL_AD_STATE });
    const tomorrowMs = new Date(2026, 5, 25, 9, 0, 0).getTime();

    expect(getInterstitialAdDateKey(tomorrowMs)).toBe('2026-06-25');
    expect(shouldShowInterstitialAd({ config, nowMs: tomorrowMs, state })).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  it('parses invalid stored state as an empty state', () => {
    expect(parseInterstitialAdState('not-json')).toEqual(EMPTY_INTERSTITIAL_AD_STATE);
  });
});
