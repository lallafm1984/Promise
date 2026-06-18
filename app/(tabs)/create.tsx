import { createElement, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { AlertTriangle, Link2, MapPin, MessageCircle, Send, UsersRound, X } from 'lucide-react-native';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import {
  CandidateTimeFields,
  DraftInput,
  DraftPreviewCard,
  ModeSelector,
} from '@/components/card-menu';
import { ActionButton, AppScreen, Card } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  buildShareMessage,
  compactDraftTimes,
  createDefaultCardDraft,
  createDefaultDraftTime,
  ensureDraftTimeCount,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
  getGeneratedCardTitle,
  getModeLabel,
  removeDraftTimeAtIndex,
  validateCardDraft,
  type CardDraft,
} from '@/lib/cardMenu';
import { getDeliveredCardManagePath } from '@/lib/managedCards';
import {
  UNSHAREABLE_PREVIEW_CARD_MESSAGE,
  getShareablePreviewCard,
} from '@/lib/previewActions';
import { getPreviewFriendOptions, getPreviewRecipientProfileIds, selectOnePreviewFriend } from '@/lib/previewFriends';
import type { AppointmentMode, PromiseCard } from '@/types/promise';

const INITIAL_DRAFT: CardDraft = {
  ...createDefaultCardDraft(),
};
const MODAL_BACKDROP_COLOR = 'rgba(75, 52, 40, 0.42)';
const DUPLICATE_TIME_ERROR = '후보 시간을 서로 다르게 입력해 주세요.';
const CARD_BASE_URL = (process.env.EXPO_PUBLIC_CARD_BASE_URL ?? 'https://whenbollae.app').replace(/\/+$/, '');

export default function CreateCardScreen() {
  const router = useRouter();
  const screenScrollRef = useRef<ScrollView>(null);
  const { addManagedCard } = useManagedCards();
  const { friends, isLoading: isFriendsLoading } = useFriends();
  const [mode, setMode] = useState<AppointmentMode>(INITIAL_DRAFT.mode);
  const [times, setTimes] = useState<string[]>(INITIAL_DRAFT.times);
  const [location, setLocation] = useState(INITIAL_DRAFT.location);
  const [message, setMessage] = useState(INITIAL_DRAFT.message);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<PromiseCard | null>(null);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [isPreviewActionPending, setIsPreviewActionPending] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

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
  const { options: previewFriendOptions, isUsingTestFriends } = useMemo(
    () => getPreviewFriendOptions(friends),
    [friends],
  );

  function handleModeChange(nextMode: AppointmentMode) {
    setMode(nextMode);
    setFeedback(null);
    setPreviewCard(null);
    setValidationNotice(null);

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
    setValidationNotice(null);
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
    setValidationNotice(null);
  }

  function handleRemoveTime(index: number) {
    setTimes((currentTimes) => {
      const result = removeDraftTimeAtIndex(mode, currentTimes, index);

      if (result.mode !== mode) {
        setMode(result.mode);
      }

      setFeedback(null);
      setValidationNotice(null);
      return result.times;
    });
    setPreviewCard(null);
  }

  function handleCreateCard() {
    const validation = validateCardDraft(activeDraft);

    if (!validation.valid) {
      if (validation.error === DUPLICATE_TIME_ERROR) {
        setValidationNotice(validation.error);
        setFeedback(null);
      } else {
        setFeedback(validation.error);
      }
      setPreviewCard(null);
      return;
    }

    setPreviewCard(buildPreviewCard(activeDraft));
    setIsFriendPickerOpen(false);
    setSelectedFriendIds([]);
    setFeedback(null);
  }

  async function publishPreview(card: PromiseCard) {
    const publishedCard: PromiseCard = {
      ...card,
      status: card.mode === 'DIRECT' ? 'PENDING' : 'VOTING',
    };

    return addManagedCard(publishedCard);
  }

  function goToDeliveredCard(card: PromiseCard) {
    resetDraft();
    router.replace(getDeliveredCardManagePath(card, `after-create-${Date.now()}`));
  }

  function resetDraft() {
    const nextDraft = createDefaultCardDraft();

    setMode(nextDraft.mode);
    setTimes(nextDraft.times);
    setLocation(nextDraft.location);
    setMessage(nextDraft.message);
    setIsMessageOpen(false);
    setFeedback(null);
    setPreviewCard(null);
    setIsFriendPickerOpen(false);
    setIsPreviewActionPending(false);
    setSelectedFriendIds([]);
    setValidationNotice(null);
  }

  function scrollFocusedInputIntoView() {
    if (Platform.OS === 'web') {
      return;
    }

    setTimeout(() => {
      screenScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }

  function closePreview() {
    setPreviewCard(null);
    setFeedback(null);
    setIsFriendPickerOpen(false);
    setIsPreviewActionPending(false);
    setSelectedFriendIds([]);
  }

  function getPreviewActionFeedback(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function handleSharePreview() {
    if (!previewCard) {
      return;
    }

    setIsPreviewActionPending(true);

    try {
      const shareable = await getShareablePreviewCard(previewCard, publishPreview);
      const result = await Share.share({
        message: buildShareMessage(shareable.card),
        url: shareable.card.sharedUrl,
      });
      if (result.action === Share.dismissedAction) {
        setPreviewCard(null);
        setFeedback(null);
        return;
      }
      goToDeliveredCard(shareable.card);
    } catch (error) {
      setFeedback(getPreviewActionFeedback(error, '공유를 열 수 없어요. 다시 시도해 주세요.'));
    } finally {
      setIsPreviewActionPending(false);
    }
  }

  async function handleCopyPreviewLink() {
    if (!previewCard) {
      return;
    }

    setIsPreviewActionPending(true);

    try {
      const shareable = await getShareablePreviewCard(previewCard, publishPreview);
      await Clipboard.setStringAsync(shareable.card.sharedUrl);
      goToDeliveredCard(shareable.card);
    } catch (error) {
      setFeedback(getPreviewActionFeedback(error, '링크를 복사하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      setIsPreviewActionPending(false);
    }
  }

  function handleSendToAppFriend() {
    setIsFriendPickerOpen(true);
    setSelectedFriendIds([]);
    setFeedback(null);
  }

  function toggleFriendSelection(friendId: string) {
    setSelectedFriendIds((currentIds) => selectOnePreviewFriend(currentIds, friendId));
  }

  async function handleConfirmFriendSend() {
    if (!previewCard || selectedFriendIds.length === 0) {
      setFeedback('카드를 보낼 친구를 선택해 주세요.');
      return;
    }

    const recipientProfileIds = getPreviewRecipientProfileIds(friends, selectedFriendIds);

    setIsPreviewActionPending(true);

    try {
      const saved = await getShareablePreviewCard({
        ...previewCard,
        recipientProfileIds,
      }, publishPreview);
      goToDeliveredCard(saved.card);
    } catch (error) {
      setFeedback(
        getPreviewActionFeedback(error, UNSHAREABLE_PREVIEW_CARD_MESSAGE),
      );
    } finally {
      setIsPreviewActionPending(false);
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
          {isFriendsLoading ? <Text style={styles.friendPickerNotice}>친구 목록을 불러오는 중이에요.</Text> : null}
          {!isFriendsLoading && isUsingTestFriends ? (
            <Text style={styles.friendPickerNotice}>실제 앱 친구가 없어 테스트 친구로 보내기 흐름을 확인할 수 있어요.</Text>
          ) : null}
          {!isFriendsLoading ? (
            <View style={styles.friendPickerList}>
              {previewFriendOptions.map((friend) => {
                const selected = selectedFriendIds.includes(friend.id);

                return (
                  <Pressable
                    key={friend.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    disabled={isPreviewActionPending}
                    onPress={() => toggleFriendSelection(friend.id)}
                    style={({ pressed }) => [
                      styles.friendPickerRow,
                      selected && styles.selectedFriendPickerRow,
                      pressed && !isPreviewActionPending && styles.pressed,
                    ]}>
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
          ) : null}
          <View style={styles.secondaryActionRow}>
            <ActionButton
              label="취소"
              variant="secondary"
              disabled={isPreviewActionPending}
              fullWidth
              onPress={() => setIsFriendPickerOpen(false)}
            />
            <ActionButton
              label={isPreviewActionPending ? '보내는 중' : '보내기'}
              disabled={isPreviewActionPending || selectedFriendIds.length === 0}
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
            disabled={isPreviewActionPending}
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
              disabled={isPreviewActionPending}
              fullWidth
              onPress={handleSendToAppFriend}
            />
            <ActionButton
              label="링크 복사"
              variant="secondary"
              icon={<Link2 size={18} color={palette.primaryDeep} />}
              disabled={isPreviewActionPending}
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
      <AppScreen keyboardAware scrollRef={screenScrollRef}>
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
          onFocus={scrollFocusedInputIntoView}
          onChangeText={(nextLocation) => {
            setLocation(nextLocation);
            setPreviewCard(null);
            setFeedback(null);
            setValidationNotice(null);
          }}
        />
        {isMessageOpen ? (
          <DraftInput
            label="한마디"
            value={message}
            placeholder="예: 늦으면 커피 내가 살게"
            icon={<MessageCircle size={16} color={palette.primaryDeep} />}
            multiline
            onFocus={scrollFocusedInputIntoView}
            onChangeText={(nextMessage) => {
              setMessage(nextMessage);
              setPreviewCard(null);
              setFeedback(null);
              setValidationNotice(null);
            }}
          />
        ) : (
          <ActionButton
            label="+ 한마디 추가"
            variant="secondary"
            icon={<MessageCircle size={17} color={palette.primaryDeep} />}
            onPress={() => {
              setIsMessageOpen(true);
              scrollFocusedInputIntoView();
            }}
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
          <View style={styles.modalBackdrop}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.modalScrollView}>
              {previewPanel}
            </ScrollView>
          </View>
        </Modal>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => setValidationNotice(null)}
        transparent
        visible={validationNotice !== null}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.validationModal}>
            <View style={styles.validationIcon}>
              <AlertTriangle size={24} color={palette.danger} />
            </View>
            <View style={styles.validationCopy}>
              <Text style={styles.validationTitle}>후보 시간 확인</Text>
              <Text style={styles.validationBody}>{validationNotice}</Text>
            </View>
            <ActionButton label="확인" fullWidth onPress={() => setValidationNotice(null)} />
          </Card>
        </View>
      </Modal>
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
    sharedUrl: `${CARD_BASE_URL}/c/${id}`,
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
    backgroundColor: MODAL_BACKDROP_COLOR,
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  modalScrollView: {
    width: '100%',
  },
  modalScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
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
  validationModal: {
    gap: spacing.md,
    maxWidth: 390,
    width: '100%',
  },
  validationIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  validationCopy: {
    gap: spacing.xs,
  },
  validationTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  validationBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
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
  friendPickerNotice: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    padding: spacing.md,
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
  backgroundColor: MODAL_BACKDROP_COLOR,
  boxSizing: 'border-box',
  display: 'flex',
  height: '100dvh',
  inset: 0,
  justifyContent: 'center',
  minHeight: '100vh',
  overflowY: 'auto',
  padding: spacing.md,
  position: 'fixed',
  width: '100vw',
  zIndex: 2147483647,
} satisfies CSSProperties;
