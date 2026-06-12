import { Bell, CalendarCheck2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ScheduleCard } from '@/components/promise-card';
import { ActionButton, AppScreen, Card, Chip, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { usePromiseData } from '@/hooks/usePromiseData';

export default function ScheduleScreen() {
  const { scheduleItems } = usePromiseData();

  return (
    <AppScreen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>이번 주</Text>
          <Text style={styles.title}>확정되면 일정 카드로 정리돼요</Text>
        </View>
        <View style={styles.calendarMark}>
          <Text style={styles.calendarDay}>FRI</Text>
          <Text style={styles.calendarNumber}>14</Text>
        </View>
      </View>

      <View style={styles.weekTabs}>
        <Chip label="오늘" tone="primary" />
        <Chip label="내일" tone="neutral" />
        <Chip label="이번 주" selected />
        <Chip label="이번 달" tone="neutral" />
      </View>

      <SectionHeader title="일정 카드" action={`${scheduleItems.length}개`} />
      <View style={styles.list}>
        {scheduleItems.map((item) => (
          <ScheduleCard key={item.id} item={item} />
        ))}
      </View>

      <Card style={styles.alarmCard}>
        <View style={styles.alarmIcon}>
          <Bell size={24} color={palette.primaryDeep} />
        </View>
        <View style={styles.alarmCopy}>
          <Text style={styles.alarmTitle}>약속 전 30분 알림</Text>
          <Text style={styles.alarmBody}>MVP에서는 로컬 알림 UI를 먼저 잡고, 이후 Supabase Cron/Push로 확장합니다.</Text>
        </View>
      </Card>

      <Card style={styles.emptyState}>
        <View style={styles.emptyMark}>
          <Text style={styles.emptyMarkText}>OK</Text>
        </View>
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>수락하면 바로 주간에 들어와요</Text>
          <Text style={styles.emptyBody}>요청 인박스에서 수락한 카드는 이 화면에서 시간순으로 확인합니다.</Text>
        </View>
        <ActionButton label="인박스로 가기" variant="ghost" icon={<CalendarCheck2 size={17} color={palette.primaryDeep} />} />
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 142,
    padding: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 32,
  },
  weekTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  calendarMark: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    height: 88,
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
    width: 88,
  },
  calendarDay: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  calendarNumber: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  list: {
    gap: spacing.sm,
  },
  alarmCard: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  alarmIcon: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderColor: palette.lineStrong,
    borderWidth: 2,
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  alarmCopy: {
    flex: 1,
    gap: 4,
  },
  alarmTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  alarmBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyMark: {
    alignItems: 'center',
    backgroundColor: palette.mintSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  emptyMarkText: {
    color: palette.primaryDeep,
    fontSize: 24,
    fontWeight: '900',
  },
  emptyCopy: {
    gap: 4,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
});
