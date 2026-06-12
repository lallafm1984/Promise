import type { ReactNode } from 'react';
import { BellRing, Copy, Link2, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, AppScreen, Card, Chip, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { usePromiseData } from '@/hooks/usePromiseData';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile } = usePromiseData();

  return (
    <AppScreen>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.displayName.slice(0, 1) ?? '볼'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{profile?.displayName ?? '내 프로필'}</Text>
          <Text style={styles.handle}>{profile?.profileUrl ?? 'whenbollae.app/@handle'}</Text>
        </View>
        <View style={styles.profileStamp}>
          <Text style={styles.profileStampText}>LIVE</Text>
        </View>
      </View>

      <Card style={styles.linkCard}>
        <View style={styles.cardTitleRow}>
          <Link2 size={20} color={palette.primaryDeep} />
          <Text style={styles.cardTitle}>내 약속 요청 링크</Text>
        </View>
        <Text style={styles.linkText}>{profile?.profileUrl ?? 'whenbollae.app/@handle'}</Text>
        <View style={styles.actions}>
          <ActionButton label="복사" icon={<Copy size={17} color="#FFFFFF" />} fullWidth />
          <ActionButton label="공유" variant="secondary" fullWidth />
        </View>
      </Card>

      <SectionHeader title="가능한 시간" action="수정" />
      <Card style={styles.availabilityCard}>
        {(profile?.availabilitySummary ?? ['평일 저녁', '주말 오후']).map((item) => (
          <Chip key={item} label={item} tone="sky" />
        ))}
      </Card>

      <SectionHeader title="연동 상태" />
      <Card style={styles.statusCard}>
        <StatusRow
          icon={<ShieldCheck size={20} color={isSupabaseConfigured ? palette.mint : palette.amber} />}
          title="Supabase"
          body={isSupabaseConfigured ? '환경변수가 설정되어 실제 client가 준비됐어요.' : '아직 mock repository로 실행 중이에요.'}
          tone={isSupabaseConfigured ? 'mint' : 'amber'}
        />
        <StatusRow
          icon={<BellRing size={20} color={palette.primaryDeep} />}
          title="알림"
          body="첫 골격에서는 UI 상태만 표시하고, 푸시는 다음 단계에서 연결합니다."
          tone="primary"
        />
      </Card>
    </AppScreen>
  );
}

function StatusRow({
  icon,
  title,
  body,
  tone,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone: 'primary' | 'mint' | 'amber';
}) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusIcon, styles[`${tone}Icon`]]}>{icon}</View>
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    backgroundColor: palette.surfaceWarm,
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 3,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 5,
  },
  profileStamp: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    transform: [{ rotate: '5deg' }],
    width: 68,
  },
  profileStampText: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  name: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  handle: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  linkCard: {
    gap: spacing.md,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  linkText: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.mint,
    fontSize: 17,
    fontWeight: '900',
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  availabilityCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusCard: {
    gap: spacing.md,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  primaryIcon: {
    backgroundColor: palette.primarySoft,
  },
  mintIcon: {
    backgroundColor: palette.mintSoft,
  },
  amberIcon: {
    backgroundColor: palette.amberSoft,
  },
  statusCopy: {
    flex: 1,
    gap: 3,
  },
  statusTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  statusBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
