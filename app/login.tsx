import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react-native';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';

import { ActionButton, AppScreen } from '@/components/ui';
import { palette, radius, shadow, spacing } from '@/constants/theme';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getAuthRedirectAllowList,
  getSupabaseProviderCallbackUrl,
  shouldShowAuthSetupGuide,
  signInWithSocialProvider,
  type SocialProviderId,
} from '@/lib/supabaseAuth';

const loginBrandImage = require('../assets/images/login-app-icon.png');

const providerMeta: Record<
  SocialProviderId,
  { label: string; actionLabel: string; badge: string; backgroundColor: string; borderColor: string; textColor: string }
> = {
  google: {
    label: 'Google',
    actionLabel: 'Google로 시작하기',
    badge: 'G',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    textColor: palette.ink,
  },
  kakao: {
    label: '카카오',
    actionLabel: '카카오로 시작하기',
    badge: 'K',
    backgroundColor: palette.kakao,
    borderColor: '#B89E00',
    textColor: palette.ink,
  },
};

function getProviderErrorMessage(provider: SocialProviderId, error: unknown) {
  const label = providerMeta[provider].label;
  return error instanceof Error ? error.message : `${label} 로그인을 완료하지 못했어요.`;
}

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const [activeProvider, setActiveProvider] = useState<SocialProviderId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const redirectAllowList = getAuthRedirectAllowList();
  const providerCallbackUrl = getSupabaseProviderCallbackUrl();
  const showAuthSetupGuide = shouldShowAuthSetupGuide(isSupabaseConfigured);

  if (isAuthenticated) {
    return <Redirect href="/schedule" />;
  }

  async function handleProviderPress(provider: SocialProviderId) {
    const label = providerMeta[provider].label;

    if (!isSupabaseConfigured) {
      setNotice('로그인 설정이 아직 연결되지 않았어요.');
      return;
    }

    setActiveProvider(provider);

    try {
      const session = await signInWithSocialProvider(provider);

      if (session) {
        router.replace('/schedule');
        return;
      }

      setNotice(`${label} 로그인 창을 닫았어요. 다시 시도해 주세요.`);
    } catch (error) {
      setNotice(getProviderErrorMessage(provider, error));
    } finally {
      setActiveProvider(null);
    }
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppScreen contentStyle={styles.screenContent}>
        <View style={styles.brandPanel}>
          <View style={styles.brandAccent} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>언제 볼래</Text>
            <Text style={styles.title}>약속은 더 쉽게</Text>
            <Text style={styles.subtitle}>친구와 일정이 한 계정에 이어져요.</Text>
          </View>
          <View style={styles.brandImageFrame}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={loginBrandImage}
              style={styles.brandImage}
            />
          </View>
        </View>

        <View style={styles.loginPanel}>
          <View style={styles.loginHeader}>
            <Text style={styles.loginTitle}>{isSupabaseConfigured ? '시작하기' : '로그인 준비 중'}</Text>
            <Text style={styles.loginSubtitle}>원하는 방식으로 로그인하세요.</Text>
          </View>

          <View style={styles.providerStack}>
            <ProviderButton
              disabled={isLoading || activeProvider !== null}
              isWorking={activeProvider === 'kakao'}
              provider="kakao"
              onPress={() => void handleProviderPress('kakao')}
            />
            <ProviderButton
              disabled={isLoading || activeProvider !== null}
              isWorking={activeProvider === 'google'}
              provider="google"
              onPress={() => void handleProviderPress('google')}
            />
          </View>

          <Text style={styles.requiredNotice}>로그인하면 카드, 친구, 일정이 안전하게 저장돼요.</Text>
        </View>

        {showAuthSetupGuide ? (
          <View style={styles.setupStack}>
            <View style={styles.setupPanel}>
              <Text style={styles.noticeTitle}>Redirect URL</Text>
              {redirectAllowList.map((url) => (
                <ConfigValue key={url} label="Allowed" value={url} />
              ))}
            </View>

            <View style={styles.setupPanel}>
              <Text style={styles.noticeTitle}>Provider Callback</Text>
              <ConfigValue label="OAuth" value={providerCallbackUrl ?? '로그인 URL 설정 필요'} />
            </View>
          </View>
        ) : null}
      </AppScreen>

      <NoticeModal message={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.configValue}>
      <Text style={styles.configLabel}>{label}</Text>
      <Text style={styles.configText}>{value}</Text>
    </View>
  );
}

function ProviderButton({
  disabled,
  isWorking,
  provider,
  onPress,
}: {
  disabled: boolean;
  isWorking: boolean;
  provider: SocialProviderId;
  onPress: () => void;
}) {
  const meta = providerMeta[provider];

  return (
    <Pressable
      accessibilityLabel={`${meta.label} 로그인`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        { backgroundColor: meta.backgroundColor, borderColor: meta.borderColor },
        provider === 'kakao' && styles.kakaoButton,
        disabled && styles.disabledProviderButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.providerBadge, provider === 'kakao' && styles.kakaoBadge]}>
        <Text style={[styles.providerBadgeText, provider === 'kakao' && styles.kakaoBadgeText]}>{meta.badge}</Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={1} style={[styles.providerText, { color: meta.textColor }]}>
        {isWorking ? `${meta.label} 연결 중` : meta.actionLabel}
      </Text>
      <ChevronRight size={18} color={meta.textColor} />
    </Pressable>
  );
}

function NoticeModal({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={message !== null}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>로그인 안내</Text>
                <Text style={styles.modalTitle}>확인이 필요해요</Text>
              </View>
              <Pressable
                accessibilityLabel="로그인 안내 닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>{message}</Text>
            <ActionButton label="확인" fullWidth onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.md,
    justifyContent: 'flex-start',
    minHeight: '100%',
    paddingBottom: spacing.xl,
    paddingTop: spacing.xxl,
  },
  brandPanel: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.line,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 196,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  brandAccent: {
    backgroundColor: '#FF5C70',
    borderRadius: radius.pill,
    bottom: -72,
    height: 170,
    opacity: 0.22,
    position: 'absolute',
    right: -52,
    width: 170,
  },
  brandCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    zIndex: 1,
  },
  brandName: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 37,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  brandImageFrame: {
    backgroundColor: palette.surface,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 3,
    height: 118,
    overflow: 'hidden',
    width: 118,
    zIndex: 1,
  },
  brandImage: {
    height: '100%',
    width: '100%',
  },
  loginPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadow,
  },
  loginHeader: {
    gap: 3,
  },
  loginTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  loginSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  providerStack: {
    gap: spacing.sm,
  },
  providerButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  kakaoButton: {
    minHeight: 62,
  },
  disabledProviderButton: {
    opacity: 0.55,
  },
  providerBadge: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  kakaoBadge: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  providerBadgeText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  kakaoBadgeText: {
    color: palette.kakao,
  },
  providerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  requiredNotice: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
  },
  setupStack: {
    gap: spacing.sm,
  },
  setupPanel: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeTitle: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  configValue: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  configLabel: {
    color: palette.inkMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  configText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(75, 52, 40, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalPressGuard: {
    alignItems: 'center',
    width: '100%',
  },
  modalPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxWidth: 390,
    padding: spacing.md,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 27,
  },
  modalBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
