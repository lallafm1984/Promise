import { useState } from 'react';
import { ChevronRight, KeyRound, ShieldCheck, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { ActionButton, AppScreen, Card } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getAuthRedirectAllowList,
  getAuthRedirectUrl,
  getSupabaseProviderCallbackUrl,
  shouldShowAuthSetupGuide,
  signInWithSocialProvider,
  type SocialProviderId,
} from '@/lib/supabaseAuth';

const providerMeta: Record<
  SocialProviderId,
  { label: string; actionLabel: string; badge: string; backgroundColor: string; borderColor: string; textColor: string }
> = {
  google: {
    label: 'Google',
    actionLabel: 'Google로 계속하기',
    badge: 'G',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    textColor: palette.ink,
  },
  kakao: {
    label: '카카오톡',
    actionLabel: '카카오톡으로 계속하기',
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
    return <Redirect href="/profile" />;
  }

  async function handleProviderPress(provider: SocialProviderId) {
    const label = providerMeta[provider].label;

    if (!isSupabaseConfigured) {
      setNotice('Supabase 프로젝트 URL과 publishable key 설정이 필요해요.');
      return;
    }

    setActiveProvider(provider);

    try {
      const session = await signInWithSocialProvider(provider);

      if (session) {
        router.replace('/profile');
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
      <AppScreen contentStyle={styles.screenContent}>
        <View style={styles.hero}>
          <View style={styles.heroShapePrimary} />
          <View style={styles.heroShapeMint} />
          <View style={styles.heroShapeLime} />
          <View style={styles.heroIcon}>
            <KeyRound size={28} color={palette.onLight} />
          </View>
          <Text style={styles.kicker}>언제볼래</Text>
          <Text style={styles.title}>로그인</Text>
          <Text style={styles.subtitle}>친구, 약속 카드, 일정이 내 계정에 안전하게 저장됩니다.</Text>
        </View>

        <Card style={styles.loginCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <ShieldCheck size={21} color={palette.primaryDeep} />
            </View>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardKicker}>Supabase Auth</Text>
              <Text style={styles.cardTitle}>{isSupabaseConfigured ? '로그인 방식을 선택하세요' : '로그인 설정 대기'}</Text>
            </View>
          </View>

          <View style={styles.providerStack}>
            <ProviderButton
              disabled={isLoading || activeProvider !== null}
              isWorking={activeProvider === 'google'}
              provider="google"
              onPress={() => void handleProviderPress('google')}
            />
            <ProviderButton
              disabled={isLoading || activeProvider !== null}
              isWorking={activeProvider === 'kakao'}
              provider="kakao"
              onPress={() => void handleProviderPress('kakao')}
            />
          </View>

          <Text style={styles.requiredNotice}>로그인 후에만 약속 카드, 친구, 일정 화면을 사용할 수 있어요.</Text>
        </Card>

        {showAuthSetupGuide ? (
          <>
            <Card style={styles.setupCard}>
              <Text style={styles.noticeTitle}>Supabase URL Configuration</Text>
              <Text style={styles.noticeBody}>Redirect URLs에 아래 값을 추가해야 모바일 로그인이 앱으로 돌아옵니다.</Text>
              {redirectAllowList.map((url) => (
                <ConfigValue key={url} label="Allowed Redirect URL" value={url} />
              ))}
            </Card>

            <Card style={styles.setupCard}>
              <Text style={styles.noticeTitle}>Google / Kakao 개발자 콘솔</Text>
              <Text style={styles.noticeBody}>OAuth 앱의 redirect URI에는 Supabase provider callback을 넣습니다.</Text>
              <ConfigValue label="Provider Callback URL" value={providerCallbackUrl ?? 'Supabase URL 설정 필요'} />
            </Card>
          </>
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
        disabled && styles.disabledProviderButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.providerBadge, provider === 'kakao' && styles.kakaoBadge]}>
        <Text style={[styles.providerBadgeText, provider === 'kakao' && styles.kakaoBadgeText]}>{meta.badge}</Text>
      </View>
      <Text style={[styles.providerText, { color: meta.textColor }]}>
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
                <Text style={styles.cardKicker}>로그인 안내</Text>
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
    justifyContent: 'center',
    minHeight: '100%',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.xs,
    minHeight: 190,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  heroShapePrimary: {
    backgroundColor: palette.primary,
    height: 128,
    position: 'absolute',
    right: -36,
    top: -28,
    transform: [{ rotate: '14deg' }],
    width: 116,
  },
  heroShapeMint: {
    backgroundColor: palette.aquaSoft,
    bottom: -22,
    height: 86,
    left: -18,
    transform: [{ rotate: '-12deg' }],
    position: 'absolute',
    width: 138,
  },
  heroShapeLime: {
    backgroundColor: palette.glow,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 48,
    position: 'absolute',
    right: 86,
    top: 24,
    width: 48,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 58,
    zIndex: 1,
  },
  kicker: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
    zIndex: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 38,
    zIndex: 1,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    maxWidth: 250,
    zIndex: 1,
  },
  loginCard: {
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardTitleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cardKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  providerStack: {
    gap: spacing.sm,
  },
  providerButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
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
    height: 30,
    justifyContent: 'center',
    width: 30,
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
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  setupCard: {
    backgroundColor: palette.paper,
    gap: spacing.sm,
  },
  noticeTitle: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  noticeBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  configValue: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
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
