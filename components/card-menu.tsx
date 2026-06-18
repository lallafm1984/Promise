import { createElement, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { CalendarDays, Clock3, MapPin, MessageCircle, Plus, Trash2 } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Card, Chip } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import {
  formatDraftDateInputValue,
  formatDraftDateTimeLabel,
  formatDraftTimeInputValue,
  canDeleteManagedCard,
  getManagedCardAction,
  getManagedStatusGroup,
  getModeLabel,
  getPrimarySlot,
  mergeDraftDatePart,
  mergeDraftDateTime,
  mergeDraftTimePart,
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
  onFocus?: () => void;
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
  activeGroup?: ManagedStatusGroup;
  onAction: (card: PromiseCard, action: ManagedCardActionKind) => void;
  onDelete?: (card: PromiseCard) => void;
}

const DIRECT_DESCRIPTION = '\uC815\uD574\uC9C4 \uC2DC\uAC04 \uD558\uB098\uB97C \uBC14\uB85C \uACF5\uC720\uD574\uC694';
const POLL_DESCRIPTION = '\uC5EC\uB7EC \uD6C4\uBCF4 \uC2DC\uAC04\uC73C\uB85C \uD22C\uD45C\uB97C \uBC1B\uC544\uC694';
const WHEN_LABEL = '\uC5B8\uC81C';
const CANDIDATE_TIME_LABEL = '\uC5B8\uC81C \uD6C4\uBCF4';
const DATE_SELECT_LABEL = '\uB0A0\uC9DC';
const TIME_SELECT_LABEL = '\uC2DC\uAC04';
const CANDIDATE_ADD_LABEL = '+ \uD6C4\uBCF4 \uC2DC\uAC04 \uCD94\uAC00';
const DELETE_LABEL = '\uC0AD\uC81C';
const UNKNOWN_TIME_LABEL = '\uC2DC\uAC04 \uBBF8\uC815';

type PickerMode = 'date' | 'time';

interface ActivePicker {
  index: number;
  mode: PickerMode;
}

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

export function DraftInput({ label, value, placeholder, icon, multiline, onChangeText, onFocus }: DraftInputProps) {
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
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={palette.inkSoft}
        style={[styles.textInput, multiline && styles.multilineInput]}
      />
    </View>
  );
}

export function CandidateTimeFields({ mode, times, onChangeTime, onAdd, onRemove }: CandidateTimeFieldsProps) {
  const [activePicker, setActivePicker] = useState<ActivePicker | null>(null);
  const isPollMode = mode === 'POLL';

  return (
    <View style={styles.stack}>
      {times.map((time, index) => (
        <DateTimeSlotField
          key={`time-${index}`}
          label={mode === 'DIRECT' ? WHEN_LABEL : `${CANDIDATE_TIME_LABEL} ${index + 1}`}
          value={time}
          activePicker={activePicker?.index === index ? activePicker.mode : null}
          onChange={(nextValue) => onChangeTime(index, nextValue)}
          onOpenPicker={(pickerMode) => setActivePicker({ index, mode: pickerMode })}
          onClosePicker={() => setActivePicker(null)}
          onRemove={isPollMode && index > 0 ? () => onRemove(index) : undefined}
          removeLabel={`${CANDIDATE_TIME_LABEL} ${index + 1} ${DELETE_LABEL}`}
        />
      ))}
      {isPollMode ? (
        <ActionButton
          label={CANDIDATE_ADD_LABEL}
          variant="secondary"
          icon={<Plus size={17} color={palette.primaryDeep} />}
          onPress={onAdd}
        />
      ) : null}
    </View>
  );
}

function DateTimeSlotField({
  label,
  value,
  activePicker,
  onChange,
  onOpenPicker,
  onClosePicker,
  onRemove,
  removeLabel,
}: {
  label: string;
  value: string;
  activePicker: PickerMode | null;
  onChange: (value: string) => void;
  onOpenPicker: (mode: PickerMode) => void;
  onClosePicker: () => void;
  onRemove?: () => void;
  removeLabel: string;
}) {
  const pickerValue = new Date(value);
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.dateTimeShell}>
      <View style={styles.slotHeader}>
        <View style={styles.slotTitleRow}>
          <Clock3 size={16} color={palette.primaryDeep} />
          <Text style={styles.inputLabel}>{label}</Text>
        </View>
        {onRemove ? (
          <Pressable
            accessibilityLabel={removeLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRemove}
            style={({ pressed }) => [styles.inlineRemoveButton, pressed && styles.pressed]}>
            <Trash2 size={15} color={palette.primaryDeep} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.dateTimeSummary}>
        <CalendarDays size={17} color={palette.primaryDeep} />
        <Text style={styles.dateTimeValue} numberOfLines={1}>
          {formatDraftDateTimeLabel(value)}
        </Text>
      </View>
      {isWeb ? (
        <WebDateTimeControls value={value} onChange={onChange} label={label} />
      ) : (
        <View style={styles.pickerControls}>
          <PickerButton
            label={DATE_SELECT_LABEL}
            selected={activePicker === 'date'}
            onPress={() => onOpenPicker('date')}
          />
          <PickerButton
            label={TIME_SELECT_LABEL}
            selected={activePicker === 'time'}
            onPress={() => onOpenPicker('time')}
          />
        </View>
      )}
      {!isWeb && activePicker ? (
        <DateTimePicker
          value={Number.isNaN(pickerValue.getTime()) ? new Date() : pickerValue}
          mode={activePicker}
          display={activePicker === 'time' ? 'spinner' : 'default'}
          accentColor={palette.primaryDeep}
          is24Hour
          positiveButton={{ label: '\uC120\uD0DD' }}
          negativeButton={{ label: '\uB2EB\uAE30' }}
          onDismiss={onClosePicker}
          onValueChange={(_, selectedDate) => {
            onChange(mergeDraftDateTime(value, selectedDate, activePicker));

            if (Platform.OS === 'android') {
              onClosePicker();
            }
          }}
          style={styles.nativePicker}
        />
      ) : null}
    </View>
  );
}

function PickerButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pickerButton, selected && styles.selectedPickerButton, pressed && styles.pressed]}>
      <Text style={[styles.pickerButtonText, selected && styles.selectedPickerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function WebDateTimeControls({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.webPickerControls}>
      {createElement('input', {
        'aria-label': label,
        lang: 'en-GB',
        type: 'datetime-local',
        value: `${formatDraftDateInputValue(value)}T${formatDraftTimeInputValue(value)}`,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const [datePart, timePart] = event.currentTarget.value.split('T');
          onChange(mergeDraftTimePart(mergeDraftDatePart(value, datePart), timePart));
        },
        style: webDateTimeInputStyle,
      })}
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

export function ManagedCardsSection({ cards, activeGroup, onAction, onDelete }: ManagedCardsSectionProps) {
  const now = new Date();
  const visibleGroups = activeGroup ? statusGroups.filter((group) => group.key === activeGroup) : statusGroups;

  if (cards.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>
          {activeGroup ? '\uC774 \uC0C1\uD0DC\uC758 \uCE74\uB4DC\uAC00 \uC5C6\uC5B4\uC694' : '\uC544\uC9C1 \uB9CC\uB4E0 \uCE74\uB4DC\uAC00 \uC5C6\uC5B4\uC694'}
        </Text>
        <Text style={styles.emptyBody}>
          {activeGroup
            ? '\uB2E4\uB978 \uC0C1\uD0DC \uD0ED\uC744 \uD655\uC778\uD558\uAC70\uB098 \uC0C8 \uCE74\uB4DC\uB97C \uB9CC\uB4E4\uC5B4\uBCF4\uC138\uC694.'
            : '\uC2DC\uAC04\uACFC \uC7A5\uC18C\uB9CC \uC815\uD558\uBA74 \uBC14\uB85C \uACF5\uC720\uD560 \uC218 \uC788\uC5B4\uC694.'}
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.managementStack}>
      {visibleGroups.map((group) => {
        const groupCards = cards.filter((card) => getManagedStatusGroup(card, now) === group.key);

        if (groupCards.length === 0) {
          return activeGroup ? (
            <Card key={group.key} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{'\uC774 \uC0C1\uD0DC\uC758 \uCE74\uB4DC\uAC00 \uC5C6\uC5B4\uC694'}</Text>
              <Text style={styles.emptyBody}>
                {'\uB2E4\uB978 \uC0C1\uD0DC \uD0ED\uC744 \uD655\uC778\uD558\uAC70\uB098 \uC0C8 \uCE74\uB4DC\uB97C \uB9CC\uB4E4\uC5B4\uBCF4\uC138\uC694.'}
              </Text>
            </Card>
          ) : null;
        }

        return (
          <View key={group.key} style={styles.statusGroup}>
            {!activeGroup ? <Text style={styles.statusGroupTitle}>{group.title}</Text> : null}
            {groupCards.map((card) => (
              <ManagedCardRow key={card.id} card={card} now={now} onAction={onAction} onDelete={onDelete} />
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
  onDelete,
}: {
  card: PromiseCard;
  now: Date;
  onAction: ManagedCardsSectionProps['onAction'];
  onDelete?: ManagedCardsSectionProps['onDelete'];
}) {
  const statusGroup = getManagedStatusGroup(card, now);
  const action = getManagedCardAction(card, now);
  const primarySlot = getPrimarySlot(card);
  const statusTitle = statusGroups.find((group) => group.key === statusGroup)?.title;

  return (
    <Card style={styles.managedCard}>
      <View style={styles.managedTop}>
        <Chip label={getModeLabel(card.mode)} tone={card.mode === 'DIRECT' ? 'amber' : 'aqua'} />
        <View style={styles.managedTopActions}>
          <Text style={styles.managedStatus} numberOfLines={1}>
            {statusTitle}
          </Text>
          {onDelete && canDeleteManagedCard(card, now) ? (
            <Pressable
              accessibilityLabel={`${card.title} ${DELETE_LABEL}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onDelete(card)}
              style={({ pressed }) => [styles.managedDeleteButton, pressed && styles.pressed]}>
              <Trash2 size={15} color={palette.primaryDeep} />
            </Pressable>
          ) : null}
        </View>
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

const webInputStyle: CSSProperties = {
  backgroundColor: palette.paper,
  border: `1.5px solid ${palette.lineStrong}`,
  borderRadius: radius.sm,
  boxSizing: 'border-box',
  color: palette.ink,
  fontSize: 14,
  fontWeight: 900,
  minHeight: 42,
  minWidth: 0,
  outlineColor: palette.primaryDeep,
  padding: `${spacing.xs}px ${spacing.sm}px`,
};

const webDateTimeInputStyle: CSSProperties = {
  ...webInputStyle,
  flex: '1 1 100%',
};

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
  dateTimeShell: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    minHeight: 116,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateTimeSummary: {
    alignItems: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  dateTimeValue: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  pickerControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  selectedPickerButton: {
    backgroundColor: palette.primary,
  },
  pickerButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedPickerButtonText: {
    color: palette.onLight,
  },
  webPickerControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  nativePicker: {
    alignSelf: 'stretch',
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  slotTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  inlineRemoveButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
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
  managedTopActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  managedStatus: {
    color: palette.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  managedDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
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
