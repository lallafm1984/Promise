import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, shadow, spacing } from '@/constants/theme';
import { getAppScreenBottomPadding, getNativeBottomInset } from '@/lib/layoutInsets';
import { getStorageModeCopy, type StorageModeSurface } from '@/lib/storageMode';
import type { AppointmentStatus, Participant, ResponseChoice } from '@/types/promise';

type ButtonVariant = 'primary' | 'secondary' | 'kakao' | 'danger' | 'ghost';

interface AppScreenProps {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  keyboardAware?: boolean;
  resetScrollOnFocus?: boolean;
  reserveBottomTabs?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  scrollToTopKey?: string | number | boolean | null;
}

interface ButtonProps {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  singleLineLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  onPress?: () => void;
}

interface ChipProps {
  label: string;
  tone?: 'primary' | 'mint' | 'amber' | 'coral' | 'neutral' | 'sky' | 'lime' | 'aqua';
  selected?: boolean;
}

interface StorageModeNoticeProps {
  persisted: boolean;
  surface: StorageModeSurface;
}

export function AppScreen({
  children,
  contentStyle,
  footer,
  keyboardAware,
  resetScrollOnFocus = true,
  reserveBottomTabs = false,
  scrollRef,
  scrollToTopKey,
}: AppScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const internalScrollRef = useRef<ScrollView>(null);
  const activeScrollRef = scrollRef ?? internalScrollRef;
  const contentWidth = Platform.OS === 'web' ? Math.min(width, 350) : Math.min(width, 430);
  const bottomInset = Platform.OS === 'web' ? 0 : getNativeBottomInset(insets.bottom);
  const bottomPadding = getAppScreenBottomPadding({
    bottomInset,
    reserveBottomTabs: Platform.OS !== 'web' && reserveBottomTabs,
  });
  const hasFooter = Boolean(footer);

  const scrollToTop = useCallback(
    (animated = false) => {
      requestAnimationFrame(() => {
        activeScrollRef.current?.scrollTo({ y: 0, animated });
      });
    },
    [activeScrollRef],
  );

  useFocusEffect(
    useCallback(() => {
      if (resetScrollOnFocus) {
        scrollToTop(false);
      }
    }, [resetScrollOnFocus, scrollToTop]),
  );

  useEffect(() => {
    if (scrollToTopKey === undefined) {
      return;
    }

    scrollToTop(false);
  }, [scrollToTop, scrollToTopKey]);

  const scrollView = (
    <ScrollView
      ref={activeScrollRef}
      style={styles.scrollView}
      automaticallyAdjustKeyboardInsets={Boolean(keyboardAware)}
      keyboardShouldPersistTaps={keyboardAware ? 'handled' : undefined}
      showsVerticalScrollIndicator={false}
      scrollIndicatorInsets={{ bottom: bottomPadding }}
      contentContainerStyle={[
        styles.screenContent,
        hasFooter && styles.screenContentWithFooter,
        {
          alignSelf: Platform.OS === 'web' ? 'flex-start' : 'center',
          paddingBottom: hasFooter ? 0 : bottomPadding,
          width: contentWidth,
        },
        contentStyle,
      ]}>
      {hasFooter ? (
        <>
          <View style={styles.screenBody}>{children}</View>
          <View style={styles.screenFooter}>{footer}</View>
        </>
      ) : (
        children
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {keyboardAware && Platform.OS !== 'web' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
          {scrollView}
        </KeyboardAvoidingView>
      ) : (
        scrollView
      )}
    </SafeAreaView>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <View style={styles.sectionActionPill}>
          <Text style={styles.sectionAction}>{action}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ActionButton({
  label,
  icon,
  variant = 'primary',
  fullWidth,
  singleLineLabel,
  style,
  labelStyle,
  disabled,
  onPress,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${variant}Button`],
        fullWidth && styles.fullWidth,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon}
      <Text
        adjustsFontSizeToFit={singleLineLabel}
        minimumFontScale={0.84}
        numberOfLines={singleLineLabel ? 1 : undefined}
        style={[styles.buttonLabel, styles[`${variant}ButtonLabel`], labelStyle, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral', selected }: ChipProps) {
  return (
    <View style={[styles.chip, styles[`${tone}Chip`], selected && styles.selectedChip]}>
      <Text style={[styles.chipLabel, styles[`${tone}ChipLabel`], selected && styles.selectedChipLabel]}>{label}</Text>
    </View>
  );
}

export function StorageModeNotice({ persisted, surface }: StorageModeNoticeProps) {
  const copy = getStorageModeCopy(persisted, surface);

  return (
    <View style={[styles.storageModeNotice, copy.tone === 'persisted' ? styles.persistedStorageModeNotice : styles.localStorageModeNotice]}>
      <Text style={styles.storageModeTitle}>{copy.title}</Text>
      <Text style={styles.storageModeBody}>{copy.body}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const statusMap: Record<AppointmentStatus, { label: string; tone: ChipProps['tone'] }> = {
    DRAFT: { label: '작성 중', tone: 'neutral' },
    PENDING: { label: '응답 대기', tone: 'amber' },
    VOTING: { label: '투표 진행 중', tone: 'primary' },
    CONFIRMED: { label: '확정', tone: 'mint' },
    DECLINED: { label: '응답 거절', tone: 'coral' },
  };

  return <Chip label={statusMap[status].label} tone={statusMap[status].tone} />;
}

export function ChoiceBadge({ choice, count }: { choice: ResponseChoice; count: number }) {
  const choiceMap: Record<ResponseChoice, { label: string; tone: ChipProps['tone'] }> = {
    YES: { label: '가능', tone: 'mint' },
    MAYBE: { label: '애매', tone: 'amber' },
    NO: { label: '어려움', tone: 'coral' },
    UNANSWERED: { label: '미응답', tone: 'neutral' },
  };

  return <Chip label={`${choiceMap[choice].label} ${count}`} tone={choiceMap[choice].tone} />;
}

export function AvatarStack({ participants, limit = 4 }: { participants: Participant[]; limit?: number }) {
  const visible = participants.slice(0, limit);
  const remaining = participants.length - visible.length;

  return (
    <View style={styles.avatarStack}>
      {visible.map((participant, index) => (
        <View
          key={participant.id}
          style={[
            styles.avatar,
            { backgroundColor: participant.color, marginLeft: index === 0 ? 0 : -8 },
          ]}>
          <Text style={styles.avatarText}>{participant.name}</Text>
        </View>
      ))}
      {remaining > 0 ? (
        <View style={[styles.avatar, styles.avatarMore, { marginLeft: -8 }]}>
          <Text style={styles.avatarText}>+{remaining}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function MetricTile({ label, value, tone = 'primary' }: { label: string; value: string; tone?: ChipProps['tone'] }) {
  return (
    <View style={[styles.metricTile, styles[`${tone}Metric`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    overflow: 'hidden',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  screenContent: {
    padding: spacing.md,
    gap: spacing.lg,
    width: '100%',
  },
  screenContentWithFooter: {
    flexGrow: 1,
    gap: 0,
  },
  screenBody: {
    flexGrow: 1,
    gap: spacing.lg,
    width: '100%',
  },
  screenFooter: {
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionActionPill: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexShrink: 1,
    maxWidth: '48%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  sectionAction: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.md,
    ...shadow,
  },
  button: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  fullWidth: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  primaryButton: {
    backgroundColor: palette.primary,
  },
  secondaryButton: {
    backgroundColor: palette.surface,
  },
  kakaoButton: {
    backgroundColor: palette.kakao,
  },
  dangerButton: {
    backgroundColor: palette.coral,
  },
  ghostButton: {
    backgroundColor: palette.lime,
  },
  disabledButton: {
    backgroundColor: '#E9E5F0',
    borderColor: '#E9E5F0',
  },
  buttonLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryButtonLabel: {
    color: palette.onLight,
  },
  secondaryButtonLabel: {
    color: palette.ink,
  },
  kakaoButtonLabel: {
    color: palette.onLight,
  },
  dangerButtonLabel: {
    color: palette.onLight,
  },
  ghostButtonLabel: {
    color: palette.onLight,
  },
  disabledLabel: {
    color: palette.inkDisabled,
  },
  chip: {
    alignSelf: 'flex-start',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  selectedChip: {
    backgroundColor: palette.ink,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  selectedChipLabel: {
    color: palette.surface,
  },
  primaryChip: {
    backgroundColor: palette.primary,
  },
  primaryChipLabel: {
    color: palette.onLight,
  },
  mintChip: {
    backgroundColor: palette.mint,
  },
  mintChipLabel: {
    color: palette.onLight,
  },
  amberChip: {
    backgroundColor: palette.amber,
  },
  amberChipLabel: {
    color: palette.onLight,
  },
  coralChip: {
    backgroundColor: palette.coral,
  },
  coralChipLabel: {
    color: palette.onLight,
  },
  skyChip: {
    backgroundColor: palette.sky,
  },
  skyChipLabel: {
    color: palette.onLight,
  },
  limeChip: {
    backgroundColor: palette.lime,
  },
  limeChipLabel: {
    color: palette.onLight,
  },
  aquaChip: {
    backgroundColor: palette.aqua,
  },
  aquaChipLabel: {
    color: palette.onLight,
  },
  neutralChip: {
    backgroundColor: palette.paper,
  },
  neutralChipLabel: {
    color: palette.ink,
  },
  storageModeNotice: {
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  persistedStorageModeNotice: {
    backgroundColor: palette.mintSoft,
  },
  localStorageModeNotice: {
    backgroundColor: palette.amberSoft,
  },
  storageModeTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  storageModeBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  avatarStack: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarMore: {
    backgroundColor: palette.primarySoft,
  },
  avatarText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  metricTile: {
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.md,
    flex: 1,
    minHeight: 76,
    padding: spacing.md,
  },
  primaryMetric: {
    backgroundColor: palette.primary,
  },
  mintMetric: {
    backgroundColor: palette.mint,
  },
  amberMetric: {
    backgroundColor: palette.amber,
  },
  coralMetric: {
    backgroundColor: palette.coral,
  },
  skyMetric: {
    backgroundColor: palette.sky,
  },
  limeMetric: {
    backgroundColor: palette.lime,
  },
  aquaMetric: {
    backgroundColor: palette.aqua,
  },
  neutralMetric: {
    backgroundColor: palette.paper,
  },
  metricLabel: {
    color: palette.onLight,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: palette.onLight,
    fontSize: 24,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
});
