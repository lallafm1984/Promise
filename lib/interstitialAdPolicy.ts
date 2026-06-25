export const INTERSTITIAL_REMOTE_CONFIG_KEYS = {
  enabled: 'promise_interstitial_enabled',
  cooldownHours: 'promise_interstitial_cooldown_hours',
  maxImpressionsPerDay: 'promise_interstitial_max_impressions_per_day',
} as const;

export type InterstitialAdPlacement =
  | 'card_create_pressed'
  | 'manual_schedule_saved'
  | 'todo_saved';

export interface InterstitialAdConfig {
  enabled: boolean;
  cooldownHours: number;
  maxImpressionsPerDay: number;
}

export interface InterstitialAdState {
  dailyImpressionCount: number;
  dailyImpressionDateKey: string | null;
  lastShownAtMs: number | null;
}

export type InterstitialAdSkipReason =
  | 'disabled'
  | 'cooldown'
  | 'daily_limit'
  | 'allowed';

export interface InterstitialAdDecision {
  allowed: boolean;
  reason: InterstitialAdSkipReason;
}

export const DEFAULT_INTERSTITIAL_AD_CONFIG: InterstitialAdConfig = {
  enabled: false,
  cooldownHours: 8,
  maxImpressionsPerDay: 2,
};

export const EMPTY_INTERSTITIAL_AD_STATE: InterstitialAdState = {
  dailyImpressionCount: 0,
  dailyImpressionDateKey: null,
  lastShownAtMs: null,
};

export function normalizeInterstitialAdConfig(input: Partial<InterstitialAdConfig>): InterstitialAdConfig {
  const cooldownHours = Number.isFinite(input.cooldownHours) ? Number(input.cooldownHours) : DEFAULT_INTERSTITIAL_AD_CONFIG.cooldownHours;
  const maxImpressionsPerDay = Number.isFinite(input.maxImpressionsPerDay)
    ? Number(input.maxImpressionsPerDay)
    : DEFAULT_INTERSTITIAL_AD_CONFIG.maxImpressionsPerDay;

  return {
    enabled: Boolean(input.enabled),
    cooldownHours: Math.max(0, cooldownHours),
    maxImpressionsPerDay: Math.max(0, Math.floor(maxImpressionsPerDay)),
  };
}

export function getInterstitialAdDateKey(timestampMs: number) {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function normalizeInterstitialAdState(
  state: Partial<InterstitialAdState> | null | undefined,
): InterstitialAdState {
  return {
    dailyImpressionCount: Math.max(0, Math.floor(Number(state?.dailyImpressionCount) || 0)),
    dailyImpressionDateKey: typeof state?.dailyImpressionDateKey === 'string' ? state.dailyImpressionDateKey : null,
    lastShownAtMs: typeof state?.lastShownAtMs === 'number' && Number.isFinite(state.lastShownAtMs)
      ? state.lastShownAtMs
      : null,
  };
}

export function parseInterstitialAdState(rawState: string | null): InterstitialAdState {
  if (!rawState) {
    return EMPTY_INTERSTITIAL_AD_STATE;
  }

  try {
    return normalizeInterstitialAdState(JSON.parse(rawState) as Partial<InterstitialAdState>);
  } catch {
    return EMPTY_INTERSTITIAL_AD_STATE;
  }
}

export function shouldShowInterstitialAd({
  config,
  nowMs,
  state,
}: {
  config: InterstitialAdConfig;
  nowMs: number;
  state: InterstitialAdState;
}): InterstitialAdDecision {
  if (!config.enabled || config.maxImpressionsPerDay <= 0) {
    return { allowed: false, reason: 'disabled' };
  }

  const nowDateKey = getInterstitialAdDateKey(nowMs);
  const todaysImpressionCount = state.dailyImpressionDateKey === nowDateKey ? state.dailyImpressionCount : 0;

  if (todaysImpressionCount >= config.maxImpressionsPerDay) {
    return { allowed: false, reason: 'daily_limit' };
  }

  if (state.lastShownAtMs !== null && config.cooldownHours > 0) {
    const cooldownMs = config.cooldownHours * 60 * 60 * 1000;

    if (nowMs - state.lastShownAtMs < cooldownMs) {
      return { allowed: false, reason: 'cooldown' };
    }
  }

  return { allowed: true, reason: 'allowed' };
}

export function recordInterstitialAdImpression({
  nowMs,
  state,
}: {
  nowMs: number;
  state: InterstitialAdState;
}): InterstitialAdState {
  const nowDateKey = getInterstitialAdDateKey(nowMs);
  const currentCount = state.dailyImpressionDateKey === nowDateKey ? state.dailyImpressionCount : 0;

  return {
    dailyImpressionCount: currentCount + 1,
    dailyImpressionDateKey: nowDateKey,
    lastShownAtMs: nowMs,
  };
}
