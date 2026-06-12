import type { ReactNode } from 'react';
import { CalendarDays, Clock3, MapPin, MessageCircle, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Card, Chip } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import {
  getManagedCardAction,
  getManagedStatusGroup,
  getModeLabel,
  getPrimarySlot,
  type ManagedCardActionKind,
  type ManagedStatusGroup,
} from '@/lib/cardMenu';
import type { AppointmentMode, PromiseCard } from '@/types/promise';

interface ModeSelectorProps {
  value: AppointmentMode;
  onChange: (mode: AppointmentMode) => void;
}

interface DraftInputProps {
  label: string;
  value: string;
  placeholder: string;
  icon: ReactNode;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}

interface CandidateTimeFieldsProps {
  mode: AppointmentMode;
  times: string[];
  onChangeTime: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

interface ManagedCardsSectionProps {
  cards: PromiseCard[];
  onAction: (card: PromiseCard, action: ManagedCardActionKind) => void;
}

const DIRECT_DESCRIPTION = '\uC815\uD574\uC9C4 \uC2DC\uAC04 \uD558\uB098\uB97C \uBC14\uB85C \uACF5\uC720\uD574\uC694';
const POLL_DESCRIPTION = '\uC5EC\uB7EC \uD6C4\uBCF4 \uC2DC\uAC04\uC73C\uB85C \uD22C\uD45C\uB97C \uBC1B\uC544\uC694';
const WHEN_LABEL = '\uC5B8\uC81C';
const CANDIDATE_TIME_LABEL = '\uD6C4\uBCF4 \uC2DC\uAC04';
const CANDIDATE_ADD_LABEL = '+ \uD6C4\uBCF4 \uC2DC\uAC04 \uCD94\uAC00';
const DELETE_LABEL = '\uC0AD\uC81C';
const DIRECT_TIME_PLACEHOLDER = '\uC608: \uC624\uB298 19:30';
const POLL_TIME_PLACEHOLDER = '\uC608: 6\uC6D4 14\uC77C 19:30';
const UNKNOWN_TIME_LABEL = '\uC2DC\uAC04 \uBBF8\uC815';

const statusGroups: Array<{ key: ManagedStatusGroup; title: string }> = [
  { key: 'PENDING', title: '\uC751\uB2F5 \uB300\uAE30' },
  { key: 'VOTING', title: '\uD22C\uD45C \uC911' },
  { key: 'CONFIRMED', title: '\uD655\uC815\uB428' },
  { key: 'PAST', title: '\uC9C0\uB09C \uC57D\uC18D' },
];

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <View style={styles.modeGrid}>
      <ModeOption
        selected={value === 'DIRECT'}
        title={getModeLabel('DIRECT')}
        description={DIRECT_DESCRIPTION}
        icon={<Clock3 size={19} color={value === 'DIRECT' ? palette.surface : palette.primaryDeep} />}
        onPress={() => onChange('DIRECT')}
      />
      <ModeOption
        selected={value === 'POLL'}
        title={getModeLabel('POLL')}
        description={POLL_DESCRIPTION}
        icon={<CalendarDays size={19} color={value === 'POLL' ? palette.surface : palette.primaryDeep} />}
        onPress={() => onChange('POLL')}
      />
    </View>
  );
}

function ModeOption({
  selected,
  title,
  description,
  icon,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.modeOption, selected && styles.selectedModeOption, pressed && styles.pressed]}>
      <View style={[styles.modeIcon, selected && styles.selectedModeIcon]}>{icon}</View>
      <Text style={[styles.modeTitle, selected && styles.selectedModeText]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.modeDescription, selected && styles.selectedModeText]}>{description}</Text>
    </Pressable>
  );
}

export function DraftInput({ label, value, placeholder, icon, multiline, onChangeText }: DraftInputProps) {
  return (
    <View style={[styles.inputShell, multiline && styles.multilineShell]}>
      <View style={styles.inputLabelRow}>
        {icon}
        <Text style={styles.inputLabel}>{label}</Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        value={value}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkSoft}
        style={[styles.textInput, multiline && styles.multilineInput]}
      />
    </View>
  );
}

export function CandidateTimeFields({ mode, times, onChangeTime, onAdd, onRemove }: CandidateTimeFieldsProps) {
  return (
    <View style={styles.stack}>
      {times.map((time, index) => (
        <View key={`time-${index}`} style={styles.timeRow}>
          <View style={styles.timeInput}>
            <DraftInput
              label={mode === 'DIRECT' ? WHEN_LABEL : `${CANDIDATE_TIME_LABEL} ${index + 1}`}
              value={time}
              placeholder={mode === 'DIRECT' ? DIRECT_TIME_PLACEHOLDER : POLL_TIME_PLACEHOLDER}
              icon={<Clock3 size={16} color={palette.primaryDeep} />}
              onChangeText={(nextValue) => onChangeTime(index, nextValue)}
            />
          </View>
          {mode === 'POLL' && times.length > 1 ? (
            <Pressable
              accessibilityLabel={`${CANDIDATE_TIME_LABEL} ${index + 1} ${DELETE_LABEL}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onRemove(index)}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
              <Trash2 size={17} color={palette.primaryDeep} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <ActionButton
        label={CANDIDATE_ADD_LABEL}
        variant="secondary"
        icon={<Plus size={17} color={palette.primaryDeep} />}
        onPress={onAdd}
      />
    </View>
  );
}

export function DraftPreviewCard({ card }: { card: PromiseCard }) {
  const candidateLabels = card.candidates.map((candidate) => candidate.label).join(' / ');
  const message = card.message.trim();

  return (
    <Card style={styles.previewCard}>
      <View style={styles.previewTop}>
        <Chip label={getModeLabel(card.mode)} tone={card.mode === 'DIRECT' ? 'amber' : 'aqua'} />
      </View>
      <Text style={styles.previewTitle}>{card.title}</Text>
      <View style={styles.previewInfoList}>
        <InfoPill icon={<Clock3 size={15} color={palette.primaryDeep} />} text={candidateLabels} />
        <InfoPill icon={<MapPin size={15} color={palette.primaryDeep} />} text={card.location} />
      </View>
      {message.length > 0 ? (
        <View style={styles.messageBox}>
          <MessageCircle size={15} color={palette.primaryDeep} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function ManagedCardsSection({ cards, onAction }: ManagedCardsSectionProps) {
  const now = new Date();

  if (cards.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{'\uC544\uC9C1 \uB9CC\uB4E0 \uCE74\uB4DC\uAC00 \uC5C6\uC5B4\uC694'}</Text>
        <Text style={styles.emptyBody}>
          {'\uC2DC\uAC04\uACFC \uC7A5\uC18C\uB9CC \uC815\uD558\uBA74 \uBC14\uB85C \uACF5\uC720\uD560 \uC218 \uC788\uC5B4\uC694.'}
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.managementStack}>
      {statusGroups.map((group) => {
        const groupCards = cards.filter((card) => getManagedStatusGroup(card, now) === group.key);

        if (groupCards.length === 0) {
          return null;
        }

        return (
          <View key={group.key} style={styles.statusGroup}>
            <Text style={styles.statusGroupTitle}>{group.title}</Text>
            {groupCards.map((card) => (
              <ManagedCardRow key={card.id} card={card} now={now} onAction={onAction} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ManagedCardRow({
  card,
  now,
  onAction,
}: {
  card: PromiseCard;
  now: Date;
  onAction: ManagedCardsSectionProps['onAction'];
}) {
  const statusGroup = getManagedStatusGroup(card, now);
  const action = getManagedCardAction(card, now);
  const primarySlot = getPrimarySlot(card);
  const statusTitle = statusGroups.find((group) => group.key === statusGroup)?.title;

  return (
    <Card style={styles.managedCard}>
      <View style={styles.managedTop}>
        <Chip label={getModeLabel(card.mode)} tone={card.mode === 'DIRECT' ? 'amber' : 'aqua'} />
        <Text style={styles.managedStatus} numberOfLines={1}>
          {statusTitle}
        </Text>
      </View>
      <Text style={styles.managedTitle} numberOfLines={2}>
        {card.title}
      </Text>
      <View style={styles.previewInfoList}>
        <InfoPill icon={<Clock3 size={15} color={palette.primaryDeep} />} text={primarySlot?.shortLabel ?? UNKNOWN_TIME_LABEL} />
        <InfoPill icon={<MapPin size={15} color={palette.primaryDeep} />} text={card.location} />
      </View>
      <ActionButton label={action.label} variant="secondary" fullWidth onPress={() => onAction(card, action.kind)} />
    </Card>
  );
}

function InfoPill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.infoPill}>
      {icon}
      <Text style={styles.infoText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeOption: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    flex: 1,
    gap: spacing.xs,
    minHeight: 130,
    minWidth: 0,
    padding: spacing.md,
  },
  selectedModeOption: {
    backgroundColor: palette.primary,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  modeIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  selectedModeIcon: {
    backgroundColor: palette.primaryDeep,
  },
  modeTitle: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  modeDescription: {
    color: palette.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  selectedModeText: {
    color: palette.surface,
  },
  stack: {
    gap: spacing.sm,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  inputShell: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multilineShell: {
    minHeight: 112,
  },
  inputLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inputLabel: {
    color: palette.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  textInput: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    minHeight: 34,
    padding: 0,
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: palette.coralSoft,
    gap: spacing.md,
  },
  previewTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  previewTitle: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 30,
  },
  previewInfoList: {
    gap: spacing.xs,
  },
  infoPill: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoText: {
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  messageBox: {
    alignItems: 'flex-start',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderLeftColor: palette.coral,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  messageText: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  managementStack: {
    gap: spacing.md,
  },
  statusGroup: {
    gap: spacing.sm,
  },
  statusGroupTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  managedCard: {
    gap: spacing.sm,
  },
  managedTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  managedStatus: {
    color: palette.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  managedTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  emptyCard: {
    backgroundColor: palette.paper,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
});
