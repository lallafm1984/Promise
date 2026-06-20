import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, shadow, spacing } from '@/constants/theme';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  getManagedCardResponseNoticeFingerprints,
  getSentResponseArrivalCards,
} from '@/lib/cardMenu';

const RESPONSE_NOTICE_STORAGE_KEY = '@whenbollae/manage/response-notice-dismissed-fingerprints';

export function GlobalResponseNotice() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, managedCards } = useManagedCards();
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[] | null>();
  const now = useMemo(() => new Date(), [managedCards]);
  const noticeCards = useMemo(
    () => getSentResponseArrivalCards(managedCards, now, profile ?? undefined),
    [managedCards, now, profile],
  );
  const noticeFingerprints = useMemo(
    () => getManagedCardResponseNoticeFingerprints(noticeCards),
    [noticeCards],
  );
  const dismissedFingerprintSet = useMemo(
    () => new Set(dismissedFingerprints ?? []),
    [dismissedFingerprints],
  );
  const shouldShow =
    noticeCards.length > 0 &&
    noticeFingerprints.length > 0 &&
    dismissedFingerprints !== undefined &&
    noticeFingerprints.some((fingerprint) => !dismissedFingerprintSet.has(fingerprint));
  const noticeWidth = Math.min(Math.max(width - spacing.lg * 2, 296), 390);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(RESPONSE_NOTICE_STORAGE_KEY)
      .then((storedFingerprints) => {
        if (isMounted) {
          setDismissedFingerprints(parseDismissedFingerprints(storedFingerprints));
        }
      })
      .catch(() => {
        if (isMounted) {
          setDismissedFingerprints(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!shouldShow) {
    return null;
  }

  function moveToResponses() {
    void dismissNotice();
    router.push(`/manage?tab=SENT_HAS_RESPONSE&scroll=response-notice-${Date.now()}` as never);
  }

  async function dismissNotice() {
    const nextDismissedFingerprints = Array.from(
      new Set([...(dismissedFingerprints ?? []), ...noticeFingerprints]),
    ).sort();

    setDismissedFingerprints(nextDismissedFingerprints);

    try {
      await AsyncStorage.setItem(RESPONSE_NOTICE_STORAGE_KEY, JSON.stringify(nextDismissedFingerprints));
    } catch {
      // The current session still stays dismissed even if storage is unavailable.
    }
  }

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + spacing.xs }]}>
      <View style={[styles.noticeCard, { width: noticeWidth }]}>
        <View style={styles.noticeTop}>
          <View style={styles.noticeIcon}>
            <BellRing size={18} color={palette.primaryDeep} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>처리할 응답 {noticeCards.length}개</Text>
            <Text style={styles.noticeBody} numberOfLines={1}>
              새 응답이 도착했어요. 바로 확인해요.
            </Text>
          </View>
        </View>
        <View style={styles.noticeActions}>
          <NoticeButton label="이동" primary onPress={moveToResponses} />
          <NoticeButton label="닫기" onPress={() => void dismissNotice()} />
        </View>
      </View>
    </View>
  );
}

function parseDismissedFingerprints(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (Array.isArray(parsedValue) && parsedValue.every((item) => typeof item === 'string')) {
      return parsedValue;
    }
  } catch {
    return null;
  }

  return null;
}

function NoticeButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.noticeButton,
        primary ? styles.primaryNoticeButton : styles.secondaryNoticeButton,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.noticeButtonText, primary && styles.primaryNoticeButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50,
  },
  noticeCard: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadow,
    elevation: Platform.OS === 'android' ? 10 : shadow.elevation,
  },
  noticeTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  noticeTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  noticeBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  noticeActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  noticeButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  primaryNoticeButton: {
    backgroundColor: palette.primary,
  },
  secondaryNoticeButton: {
    backgroundColor: palette.surface,
  },
  noticeButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryNoticeButtonText: {
    color: palette.onLight,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
