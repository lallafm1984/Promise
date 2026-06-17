import { createElement, useMemo, useState, type CSSProperties } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Link2, MapPin, MessageCircle, Send, UsersRound, X } from 'lucide-react-native';
import { Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  CandidateTimeFields,
  DraftInput,
  DraftPreviewCard,
  ModeSelector,
} from '@/components/card-menu';
import { ActionButton, AppScreen, Card, StorageModeNotice } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  buildShareMessage,
  compactDraftTimes,
  createDefaultDraftTime,
  createDefaultDraftTimes,
  ensureDraftTimeCount,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
  getGeneratedCardTitle,
  getModeLabel,
  getRecipientProfileIds,
  removeDraftTimeAtIndex,
  validateCardDraft,
  type CardDraft,
} from '@/lib/cardMenu';
import type { AppointmentMode, PromiseCard } from '@/types/promise';

const INITIAL_DRAFT: CardDraft = {
  mode: 'DIRECT',
  times: createDefaultDraftTimes(2),
  location: '',
  message: '',
};

export default function CreateCardScreen() {
  const { addManagedCard, persisted: cardsPersisted } = useManagedCards();
  const { friends } = useFriends();
  const [mode, setMode] = useState<AppointmentMode>(INITIAL_DRAFT.mode);
  const [times, setTimes] = useState<string[]>(INITIAL_DRAFT.times);
  const [location, setLocation] = useState(INITIAL_DRAFT.location);
  const [message, setMessage] = useState(INITIAL_DRAFT.message);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<PromiseCard | null>(null);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const draft = useMemo<CardDraft>(
    () => ({
      mode,
      times,
      location,
      message,
    }),
    [location, message, mode, times],
  );
  const activeDraft = useMemo<CardDraft>(
    () => ({
      ...draft,
      times: mode === 'DIRECT' ? [times[0] ?? createDefaultDraftTime(0)] : ensureDraftTimeCount(times, 2),
    }),
    [draft, mode, times],
  );
  const visibleTimes = mode === 'DIRECT' ? [times[0] ?? createDefaultDraftTime(0)] : ensureDraftTimeCount(times, 2);

  function handleModeChange(nextMode: AppointmentMode) {
    setMode(nextMode);
    setFeedback(null);
    setPreviewCard(null);

    if (nextMode === 'POLL') {
      setTimes((currentTimes) => ensureDraftTimeCount(currentTimes, 2));
      return;
    }

    setTimes((currentTimes) => ensureDraftTimeCount(currentTimes, 2));
  }

  function handleChangeTime(index: number, value: string) {
    setTimes((currentTimes) =>
      ensureDraftTimeCount(currentTimes, mode === 'POLL' ? 2 : 1).map((time, timeIndex) =>
        timeIndex === index ? value : time,
      ),
    );
    setPreviewCard(null);
    setFeedback(null);
  }

  function handleAddTime() {
    setMode('POLL');
    setTimes((currentTimes) => {
      const nextTimes = ensureDraftTimeCount(currentTimes, 2);

      if (mode === 'DIRECT') {
        return nextTimes;
      }

      return [...nextTimes, createDefaultDraftTime(nextTimes.length)];
    });
    setPreviewCard(null);
    setFeedback(null);
  }

  function handleRemoveTime(index: number) {
    setTimes((currentTimes) => {
      const result = removeDraftTimeAtIndex(mode, currentTimes, index);

      if (result.mode !== mode) {
        setMode(result.mode);
      }

      setFeedback(null);
      return result.times;
    });
    setPreviewCard(null);
  }

  function handleCreateCard() {
    const validation = validateCardDraft(activeDraft);

    if (!validation.valid) {
      setFeedback(validation.error);
      setPreviewCard(null);
      return;
    }

    setPreviewCard(buildPreviewCard(activeDraft));
    setFeedback(null);
  }

  async function publishPreview(card: PromiseCard) {
    const publishedCard: PromiseCard = {
      ...card,
      status: card.mode === 'DIRECT' ? 'PENDING' : 'VOTING',
    };

    return addManagedCard(publishedCard);
  }

  function closePreview() {
    setPreviewCard(null);
    setFeedback(null);
    setIsFriendPickerOpen(false);
    setSelectedFriendIds([]);
  }

  async function handleSharePreview() {
    if (!previewCard) {
      return;
    }

    try {
      const saved = await publishPreview(previewCard);
      const result = await Share.share({ message: buildShareMessage(saved.card) });
      if (result.action === Share.dismissedAction) {
        setFeedback(saved.persisted ? '카드는 저장됐고 공유는 취소됐어요.' : '공유가 취소됐어요. 로그인 전이라 카드는 이 기기에만 저장돼요.');
        setPreviewCard(null);
        return;
      }
      setPreviewCard(null);
      setFeedback(
        saved.persisted ? '카톡 공유를 열었고 카드가 저장됐어요.' : '카톡 공유를 열었어요. 로그인 전이라 이 기기에만 저장돼요.',
      );
    } catch {
      setFeedback('공유를 열 수 없어요. 다시 시도해 주세요.');
    }
  }

  async function handleCopyPreviewLink() {
    if (!previewCard) {
      return;
    }

    try {
      const saved = await publishPreview(previewCard);
      await Clipboard.setStringAsync(saved.card.sharedUrl);
      setPreviewCard(null);
      setFeedback(
        saved.persisted ? '공유 링크를 복사하고 카드가 저장됐어요.' : '공유 링크를 복사했어요. 로그인 전이라 이 기기에만 저장돼요.',
      );
    } catch {
      setFeedback('링크를 복사하지 못했어요. 다시 시도해 주세요.');
    }
  }

  function handleSendToAppFriend() {
    if (friends.length === 0) {
      setFeedback('먼저 친구 메뉴에서 친구를 추가해 주세요.');
      return;
    }

    setIsFriendPickerOpen(true);
    setFeedback(null);
  }

  function toggleFriendSelection(friendId: string) {
    setSelectedFriendIds((currentIds) =>
      currentIds.includes(friendId) ? currentIds.filter((currentId) => currentId !== friendId) : [...currentIds, friendId],
    );
  }

  async function handleConfirmFriendSend() {
    if (!previewCard || selectedFriendIds.length === 0) {
      setFeedback('카드를 보낼 친구를 선택해 주세요.');
      return;
    }

    const selectedFriends = friends.filter((friend) => selectedFriendIds.includes(friend.id));
    const selectedNames = selectedFriends.map((friend) => friend.displayName).join(', ');
    const recipientProfileIds = getRecipientProfileIds(friends, selectedFriendIds);

    try {
      const saved = await publishPreview({
        ...previewCard,
        recipientProfileIds,
      });
      setPreviewCard(null);
      setIsFriendPickerOpen(false);
      setSelectedFriendIds([]);
      setFeedback(
        saved.persisted
          ? `${selectedNames}님에게 앱 카드로 보냈고 카드가 저장됐어요.`
          : `${selectedNames}님에게 앱 카드로 보냈어요. 로그인 전이라 이 기기에만 저장돼요.`,
      );
    } catch {
      setFeedback('카드를 저장하지 못했어요. 다시 시도해 주세요.');
    }
  }

  const previewPanel = previewCard ? (
    <View style={styles.modalPanel}>
      <View style={styles.modalHeader}>
        <View style={styles.modalTitleGroup}>
          <Text style={styles.modalKicker}>{getModeLabel(previewCard.mode)}</Text>
          <Text style={styles.modalTitle}>공유 전 미리보기</Text>
        </View>
        <Pressable
          accessibilityLabel="미리보기 닫기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={closePreview}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <X size={20} color={palette.primaryDeep} />
        </Pressable>
      </View>
      <DraftPreviewCard card={previewCard} />
      {feedback ? <Text style={styles.modalFeedback}>{feedback}</Text> : null}
      {isFriendPickerOpen ? (
        <View style={styles.friendPicker}>
          <Text style={styles.friendPickerTitle}>보낼 친구 선택</Text>
          <View style={styles.friendPickerList}>
            {friends.map((friend) => {
              const selected = selectedFriendIds.includes(friend.id);

              return (
                <Pressable
                  key={friend.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleFriendSelection(friend.id)}
                  style={({ pressed }) => [styles.friendPickerRow, selected && styles.selectedFriendPickerRow, pressed && styles.pressed]}>
                  <View style={[styles.friendAvatar, { backgroundColor: friend.color }]}>
                    <Text style={styles.friendAvatarText}>{friend.avatarLabel}</Text>
                  </View>
                  <View style={styles.friendPickerCopy}>
                    <Text style={styles.friendPickerName}>{friend.displayName}</Text>
                    <Text style={styles.friendPickerMeta}>@{friend.handle}</Text>
                  </View>
                  <View style={[styles.friendCheck, selected && styles.selectedFriendCheck]}>
                    <Text style={[styles.friendCheckText, selected && styles.selectedFriendCheckText]}>{selected ? '선택' : '대기'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.secondaryActionRow}>
            <ActionButton label="취소" variant="secondary" fullWidth onPress={() => setIsFriendPickerOpen(false)} />
            <ActionButton
              label="보내기"
              fullWidth
              onPress={() => {
                void handleConfirmFriendSend();
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.previewActions}>
          <ActionButton
            label="카톡 공유"
            variant="kakao"
            icon={<Send size={18} color={palette.onLight} />}
            fullWidth
            onPress={() => {
              void handleSharePreview();
            }}
          />
          <View style={styles.secondaryActionRow}>
            <ActionButton
              label="앱 친구에게 보내기"
              variant="secondary"
              icon={<UsersRound size={18} color={palette.primaryDeep} />}
              fullWidth
              onPress={handleSendToAppFriend}
            />
            <ActionButton
              label="링크 복사"
              variant="secondary"
              icon={<Link2 size={18} color={palette.primaryDeep} />}
              fullWidth
              onPress={() => {
                void handleCopyPreviewLink();
              }}
            />
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <>
      <AppScreen>
      <View style={styles.header}>
        <View style={styles.headerShapePrimary} />
        <View style={styles.headerShapeMint} />
        <View style={styles.headerShapeLime} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>언제볼래</Text>
          <Text style={styles.title}>카드 만들기</Text>
          <Text style={styles.subtitle}>날짜와 시간을 고르고 장소만 적으면 바로 공유돼요.</Text>
        </View>
      </View>

      <StorageModeNotice persisted={cardsPersisted} surface="cards" />

      <ModeSelector value={mode} onChange={handleModeChange} />

      <Card style={styles.formCard}>
        <CandidateTimeFields
          mode={mode}
          times={visibleTimes}
          onChangeTime={handleChangeTime}
          onAdd={handleAddTime}
          onRemove={handleRemoveTime}
        />
        <DraftInput
          label="어디서"
          value={location}
          placeholder="예: 성수 카페"
          icon={<MapPin size={16} color={palette.primaryDeep} />}
          onChangeText={(nextLocation) => {
            setLocation(nextLocation);
            setPreviewCard(null);
            setFeedback(null);
          }}
        />
        {isMessageOpen ? (
          <DraftInput
            label="한마디"
            value={message}
            placeholder="예: 늦으면 커피 내가 살게"
            icon={<MessageCircle size={16} color={palette.primaryDeep} />}
            multiline
            onChangeText={(nextMessage) => {
              setMessage(nextMessage);
              setPreviewCard(null);
              setFeedback(null);
            }}
          />
        ) : (
          <ActionButton
            label="+ 한마디 추가"
            variant="secondary"
            icon={<MessageCircle size={17} color={palette.primaryDeep} />}
            onPress={() => setIsMessageOpen(true)}
          />
        )}
        <ActionButton
          label="카드 만들기"
          icon={<Send size={18} color={palette.onLight} />}
          fullWidth
          onPress={handleCreateCard}
        />
      </Card>

      {feedback && !previewCard ? <Text style={styles.feedback}>{feedback}</Text> : null}

      </AppScreen>
      {previewCard && Platform.OS === 'web'
        ? createElement('div', { style: webModalBackdropStyle }, previewPanel)
        : null}
      {Platform.OS !== 'web' ? (
        <Modal animationType="fade" onRequestClose={closePreview} transparent visible={previewCard !== null}>
          <View style={styles.modalBackdrop}>{previewPanel}</View>
        </Modal>
      ) : null}
    </>
  );
}

function buildPreviewCard(draft: CardDraft): PromiseCard {
  const id = `local-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const times = compactDraftTimes(draft.times);

  return {
    id,
    mode: draft.mode,
    status: 'DRAFT',
    title: getGeneratedCardTitle(draft),
    hostName: '나',
    location: draft.location.trim(),
    message: draft.message.trim(),
    sharedUrl: `https://whenbollae.app/c/${id}`,
    createdAt,
    selectedSlotId: `${id}-slot-1`,
    candidates: times.map((time, index) => ({
      id: `${id}-slot-${index + 1}`,
      startsAt: time,
      endsAt: getCandidateEndsAt(time),
      label: formatDraftDateTimeLabel(time),
      shortLabel: formatDraftDateTimeShortLabel(time),
      summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
    })),
    participants: [],
  };
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 132,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    zIndex: 1,
  },
  headerShapePrimary: {
    backgroundColor: palette.coral,
    borderRadius: radius.lg,
    height: 76,
    position: 'absolute',
    right: -12,
    top: 14,
    transform: [{ rotate: '-18deg' }],
    width: 116,
  },
  headerShapeMint: {
    backgroundColor: palette.aqua,
    bottom: -28,
    height: 98,
    left: -28,
    position: 'absolute',
    transform: [{ rotate: '22deg' }],
    width: 88,
  },
  headerShapeLime: {
    backgroundColor: palette.lime,
    borderRadius: radius.pill,
    height: 42,
    position: 'absolute',
    right: 104,
    top: -10,
    transform: [{ rotate: '0deg' }],
    width: 42,
  },
  kicker: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 35,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  formCard: {
    gap: spacing.md,
  },
  feedback: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  previewActions: {
    gap: spacing.sm,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(75, 52, 40, 0.52)',
    bottom: 0,
    elevation: 20,
    flex: 1,
    justifyContent: 'center',
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  modalPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    elevation: 24,
    gap: spacing.md,
    maxWidth: 390,
    padding: spacing.md,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    width: '100%',
    zIndex: 1001,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  modalTitleGroup: {
    flex: 1,
    minWidth: 0,
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
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  modalFeedback: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  friendPicker: {
    gap: spacing.sm,
  },
  friendPickerTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  friendPickerList: {
    gap: spacing.xs,
  },
  friendPickerRow: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.sm,
  },
  selectedFriendPickerRow: {
    backgroundColor: palette.limeSoft,
  },
  friendAvatar: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  friendAvatarText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  friendPickerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  friendPickerName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  friendPickerMeta: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  friendCheck: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  selectedFriendCheck: {
    backgroundColor: palette.primary,
  },
  friendCheckText: {
    color: palette.inkMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  selectedFriendCheckText: {
    color: palette.onLight,
  },
});

const webModalBackdropStyle = {
  alignItems: 'center',
  backdropFilter: 'blur(1px)',
  backgroundColor: 'rgba(75, 52, 40, 0.52)',
  boxSizing: 'border-box',
  display: 'flex',
  height: '100dvh',
  inset: 0,
  justifyContent: 'center',
  minHeight: '100vh',
  padding: spacing.md,
  position: 'fixed',
  width: '100vw',
  zIndex: 2147483647,
} satisfies CSSProperties;
