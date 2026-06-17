import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CheckCircle2, KeyRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, AppScreen, Card } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/supabaseAuth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const linkingUrl = Linking.useLinkingURL();
  const handledUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!handledUrlRef.current) {
        setError('로그인 콜백 정보를 찾지 못했어요. 다시 로그인해 주세요.');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!linkingUrl || handledUrlRef.current === linkingUrl) {
      return;
    }

    handledUrlRef.current = linkingUrl;

    if (!isAuthCallbackUrl(linkingUrl)) {
      setError('로그인 콜백 주소가 올바르지 않아요. 다시 로그인해 주세요.');
      return;
    }

    const authCallbackUrl = linkingUrl;
    let cancelled = false;

    async function finishLogin() {
      try {
        const session = await createSessionFromUrl(authCallbackUrl);

        if (cancelled) {
          return;
        }

        if (session) {
          router.replace('/profile');
          return;
        }

        setError('로그인 정보가 비어 있어요. 다시 로그인해 주세요.');
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '로그인을 완료하지 못했어요.');
        }
      }
    }

    void finishLogin();

    return () => {
      cancelled = true;
    };
  }, [linkingUrl, router]);

  return (
    <AppScreen contentStyle={styles.screenContent}>
      <Card style={styles.panel}>
        <View style={styles.iconFrame}>
          {error ? <KeyRound size={28} color={palette.primaryDeep} /> : <CheckCircle2 size={28} color={palette.primaryDeep} />}
        </View>
        <Text style={styles.title}>{error ? '로그인을 다시 확인해 주세요' : '로그인 처리 중'}</Text>
        <Text style={styles.body}>
          {error ?? 'Supabase 계정 연결을 마무리하고 있어요. 잠시만 기다려 주세요.'}
        </Text>
        {error ? (
          <ActionButton label="로그인으로 돌아가기" fullWidth onPress={() => router.replace('/login' as never)} />
        ) : (
          <ActivityIndicator color={palette.primaryDeep} size="large" />
        )}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: 'center',
    minHeight: '100%',
  },
  panel: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconFrame: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
});
