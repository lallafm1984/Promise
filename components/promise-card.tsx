import type { ReactNode } from 'react';
import { CalendarDays, Clock3, MapPin, MessageCircle, Share2, UsersRound } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/constants/theme';
import type { CandidateSlot, PromiseCard, ScheduleItem } from '@/types/promise';
import { ActionButton, AvatarStack, Card, ChoiceBadge, Chip, StatusBadge } from '@/components/ui';

function getResponseTotal(slot: CandidateSlot) {
  return slot.summary.yes + slot.summary.maybe + slot.summary.no + slot.summary.unanswered;
}

export function InboxPromiseCard({ card }: { card: PromiseCard }) {
  const primarySlot = card.candidates[0];

  return (
    <Card style={styles.requestCard}>
      <View style={styles.cardRibbon}>
        <MessageCircle size={14} color={palette.ink} />
        <Text style={styles.cardRibbonText}>카톡 링크로 방금 도착</Text>
      </View>
      <View style={styles.cardTopRow}>
        <View style={styles.senderRow}>
          <View style={styles.senderBadge}>
            <Text style={styles.senderBadgeText}>{card.requesterName?.slice(0, 1) ?? '볼'}</Text>
          </View>
          <View>
            <Text style={styles.senderText}>
              {card.requesterName ? `${card.requesterName}가 보낸 요청` : '약속 카드 투표'}
            </Text>
            <Text style={styles.subtleText}>카톡 링크에서 1분 전</Text>
          </View>
        </View>
        <StatusBadge status={card.status} />
      </View>

      <Text style={styles.cardTitle}>{card.title}</Text>

      <View style={styles.infoList}>
        <InfoRow icon={<Clock3 size={16} color={palette.primaryDeep} />} text={primarySlot.label} />
        <InfoRow icon={<MapPin size={16} color={palette.primaryDeep} />} text={card.location} />
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.messageText}>"{card.message}"</Text>
      </View>

      <View style={styles.cardBottomRow}>
        <AvatarStack participants={card.participants} />
        <Text style={styles.subtleText}>
          {card.participants.length}명 참여 · {getResponseTotal(primarySlot)}응답
        </Text>
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="가능해" variant="primary" fullWidth />
        <ActionButton label="다른 날" variant="secondary" fullWidth />
      </View>
    </Card>
  );
}

export function VoteSummaryCard({ card }: { card: PromiseCard }) {
  const topSlot = card.candidates[0];
  const total = Math.max(getResponseTotal(topSlot), 1);

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.summaryTitle}>투표 열기</Text>
          <Text style={styles.subtleText}>가장 많이 되는 시간이 먼저 보여요</Text>
        </View>
        <Text style={styles.subtleText}>{topSlot.summary.yes}/{total}명 가능</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${(topSlot.summary.yes / total) * 100}%` }]} />
      </View>
      <View style={styles.choiceRow}>
        <ChoiceBadge choice="YES" count={topSlot.summary.yes} />
        <ChoiceBadge choice="MAYBE" count={topSlot.summary.maybe} />
        <ChoiceBadge choice="NO" count={topSlot.summary.no} />
      </View>
      <View style={styles.cardBottomRow}>
        <AvatarStack participants={card.participants} />
        <ActionButton label="응답자 보기" variant="ghost" />
      </View>
    </Card>
  );
}

export function SharePreviewCard({ card }: { card: PromiseCard }) {
  const primarySlot = card.candidates[0];

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewBlobLarge} />
      <View style={styles.previewBlobSmall} />
      <Chip label="카톡 미리보기" tone="lime" />
      <View style={styles.previewMiniCard}>
        <Text style={styles.previewMiniText}>볼</Text>
      </View>
      <Text style={styles.previewTitle}>{card.title}</Text>
      <View style={styles.previewInfo}>
        <InfoRow icon={<CalendarDays size={15} color={palette.inkMuted} />} text={primarySlot.shortLabel} />
        <InfoRow icon={<MapPin size={15} color={palette.inkMuted} />} text={card.location} />
      </View>
      <Text style={styles.previewMessage}>{card.message}</Text>
      <ActionButton label="카카오톡으로 공유" variant="kakao" icon={<Share2 size={17} color={palette.ink} />} />
    </View>
  );
}

export function RecentCardRow({ card }: { card: PromiseCard }) {
  const primarySlot = card.candidates[0];

  return (
    <View style={styles.recentRow}>
      <View style={styles.recentIcon}>
        <CalendarDays size={18} color={palette.primaryDeep} />
      </View>
      <View style={styles.recentBody}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={styles.subtleText} numberOfLines={1}>
          {primarySlot.shortLabel} · {card.location}
        </Text>
      </View>
      <StatusBadge status={card.status} />
    </View>
  );
}

export function ScheduleCard({ item }: { item: ScheduleItem }) {
  return (
    <Card style={styles.scheduleCard}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{item.dateLabel.split(' ')[0]}</Text>
        <Text style={styles.dateNumber}>{item.dateLabel.split(' ')[1]}</Text>
      </View>
      <View style={styles.scheduleBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
          <Chip label={item.status === 'REMINDER_ON' ? '알림 ON' : '준비됨'} tone="sky" />
        </View>
        <InfoRow icon={<Clock3 size={15} color={palette.inkMuted} />} text={item.timeLabel} />
        <InfoRow icon={<MapPin size={15} color={palette.inkMuted} />} text={item.location} />
      </View>
    </Card>
  );
}

export function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export function PeopleHint({ count }: { count: number }) {
  return (
    <View style={styles.peopleHint}>
      <UsersRound size={15} color={palette.primaryDeep} />
      <Text style={styles.peopleText}>응답자 {count}명</Text>
      <MessageCircle size={15} color={palette.coral} />
    </View>
  );
}

const styles = StyleSheet.create({
  requestCard: {
    backgroundColor: palette.paper,
    gap: spacing.md,
    overflow: 'hidden',
  },
  cardRibbon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.lime,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    marginBottom: -2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    transform: [{ rotate: '-1.5deg' }],
  },
  cardRibbonText: {
    color: palette.onLight,
    fontSize: 12,
    fontWeight: '900',
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  senderRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  senderBadge: {
    alignItems: 'center',
    backgroundColor: palette.amber,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  senderBadgeText: {
    color: palette.onLight,
    fontSize: 16,
    fontWeight: '900',
  },
  senderText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  subtleText: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  infoText: {
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  messageBox: {
    backgroundColor: '#FFF0A6',
    borderColor: palette.lineStrong,
    borderLeftColor: palette.coral,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  messageText: {
    color: palette.onLight,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    backgroundColor: palette.aquaSoft,
    gap: spacing.md,
  },
  summaryTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  barTrack: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    height: 16,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: palette.mint,
    borderRadius: radius.pill,
    height: '100%',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewCard: {
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  previewBlobLarge: {
    backgroundColor: palette.amberSoft,
    borderRadius: radius.pill,
    height: 116,
    position: 'absolute',
    right: -28,
    top: -20,
    width: 116,
  },
  previewBlobSmall: {
    backgroundColor: palette.mintSoft,
    borderRadius: radius.pill,
    bottom: 18,
    height: 54,
    position: 'absolute',
    right: 24,
    width: 54,
  },
  previewMiniCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 18,
    transform: [{ rotate: '7deg' }],
    width: 48,
  },
  previewMiniText: {
    color: palette.primaryDeep,
    fontSize: 20,
    fontWeight: '900',
  },
  previewTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 29,
    maxWidth: '78%',
  },
  previewInfo: {
    gap: spacing.xs,
    maxWidth: '86%',
  },
  previewMessage: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  recentRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  recentIcon: {
    alignItems: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  recentBody: {
    flex: 1,
    gap: 3,
  },
  recentTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  scheduleCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateBlock: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    minWidth: 64,
    padding: spacing.sm,
  },
  dateDay: {
    color: palette.onLight,
    fontSize: 12,
    fontWeight: '900',
  },
  dateNumber: {
    color: palette.onLight,
    fontSize: 24,
    fontWeight: '900',
  },
  scheduleBody: {
    flex: 1,
    gap: spacing.xs,
  },
  scheduleTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  peopleHint: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.primarySoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  peopleText: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
});
