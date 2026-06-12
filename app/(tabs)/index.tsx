import { Bell, Plus, Share2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { InboxPromiseCard, RecentCardRow, VoteSummaryCard } from '@/components/promise-card';
import { ActionButton, AppScreen, Card, MetricTile, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { usePromiseData } from '@/hooks/usePromiseData';

export default function InboxScreen() {
  const { profile, inboxCards, recentCards, scheduleItems, isLoading } = usePromiseData();
  const primaryCard = inboxCards[0];
  const voteCard = inboxCards.find((card) => card.mode === 'POLL');

  return (
    <AppScreen>
      <View style={styles.topBar}>
        <View style={styles.topIdentity}>
          <Text style={styles.topEyebrow}>FRIEND PROMISE</Text>
          <Text style={styles.topGreeting}>민서의 약속 홈</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>카톡 ON</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroBlobPrimary} />
        <View style={styles.heroBlobMint} />
        <View style={styles.heroSticker}>
          <Text style={styles.heroStickerText}>NEW 3</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.brand}>언제볼래</Text>
          <Text style={styles.heroTitle}>톡방 약속, 카드로 끝내자</Text>
          <Text style={styles.heroBody}>
            질문은 짧게, 응답은 예쁘게. 친구는 설치 없이 바로 고르고 나는 한 번에 확정해요.
          </Text>
        </View>
        <View style={styles.heroMark}>
          <Text style={styles.heroMarkText}>볼?</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <MetricTile label="새 요청" value={isLoading ? '-' : String(inboxCards.length)} tone="lime" />
        <MetricTile label="이번 주" value={isLoading ? '-' : String(scheduleItems.length)} tone="mint" />
        <MetricTile label="리마인드" value="ON" tone="amber" />
      </View>

      <View style={styles.moodRail}>
        <Text style={styles.moodTitle}>오늘 바로 쓸 템플릿</Text>
        <View style={styles.moodChips}>
          <Text style={[styles.moodChip, styles.moodChipLime]}>카페 ☕</Text>
          <Text style={[styles.moodChip, styles.moodChipCoral]}>치맥 🍗</Text>
          <Text style={[styles.moodChip, styles.moodChipAqua]}>스터디 📚</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <ActionButton label="카드 만들기" icon={<Plus size={18} color="#FFFFFF" />} fullWidth />
        <ActionButton
          label="링크 공유"
          variant="secondary"
          icon={<Share2 size={18} color={palette.primary} />}
          fullWidth
        />
      </View>

      <SectionHeader title="새 요청" action={profile ? '내 링크 ON' : '링크 준비'} />
      {primaryCard ? (
        <InboxPromiseCard card={primaryCard} />
      ) : (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>?</Text>
          </View>
          <Text style={styles.emptyTitle}>아직 도착한 요청이 없어요</Text>
          <Text style={styles.emptyBody}>내 링크를 보내면 친구가 앱 설치 없이 요청할 수 있어요.</Text>
        </Card>
      )}

      {voteCard ? (
        <>
          <SectionHeader title="투표 카드" action="실시간 응답" />
          <VoteSummaryCard card={voteCard} />
        </>
      ) : null}

      <SectionHeader title="최근 카드" action="전체 보기" />
      <View style={styles.recentList}>
        {recentCards.map((card) => (
          <RecentCardRow key={card.id} card={card} />
        ))}
      </View>

      <Card style={styles.reminderCard}>
        <Bell size={22} color={palette.primaryDeep} />
        <View style={styles.reminderCopy}>
          <Text style={styles.reminderTitle}>알림은 가볍게, 놓치지 않게</Text>
          <Text style={styles.reminderBody}>확정된 약속은 30분 전에 한 번 더 알려주는 흐름으로 설계했어요.</Text>
        </View>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topIdentity: {
    flex: 1,
    minWidth: 0,
  },
  topEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  topGreeting: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 3,
  },
  liveBadge: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexShrink: 0,
  },
  liveDot: {
    color: palette.mint,
    fontSize: 11,
    fontWeight: '900',
  },
  liveText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: palette.surfaceWarm,
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 164,
    overflow: 'hidden',
    padding: spacing.lg,
    ...({
      boxShadow: '5px 7px 0px rgba(255, 90, 134, 0.22)',
      elevation: 3,
    } as object),
  },
  heroBlobPrimary: {
    backgroundColor: palette.primarySoft,
    borderRadius: radius.pill,
    height: 154,
    opacity: 0.88,
    position: 'absolute',
    right: -42,
    top: -36,
    width: 154,
  },
  heroBlobMint: {
    backgroundColor: palette.mintSoft,
    borderRadius: radius.pill,
    bottom: -30,
    height: 116,
    left: -32,
    opacity: 0.9,
    position: 'absolute',
    width: 116,
  },
  heroSticker: {
    backgroundColor: palette.coral,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    position: 'absolute',
    right: 16,
    top: 14,
    transform: [{ rotate: '4deg' }],
  },
  heroStickerText: {
    color: palette.onLight,
    fontSize: 11,
    fontWeight: '900',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  brand: {
    color: palette.primaryDeep,
    fontSize: 18,
    fontWeight: '900',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  heroBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    maxWidth: 230,
  },
  heroMark: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    height: 84,
    justifyContent: 'center',
    transform: [{ rotate: '5deg' }],
    width: 84,
  },
  heroMarkText: {
    color: palette.primaryDeep,
    fontSize: 24,
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodRail: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.md,
  },
  moodTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  moodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  moodChip: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.onLight,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  moodChipLime: {
    backgroundColor: palette.lime,
  },
  moodChipCoral: {
    backgroundColor: palette.primary,
  },
  moodChipAqua: {
    backgroundColor: palette.aqua,
  },
  recentList: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    height: 82,
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    width: 112,
  },
  emptyIconText: {
    color: palette.primaryDeep,
    fontSize: 34,
    fontWeight: '900',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  reminderCard: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  reminderCopy: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  reminderBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
