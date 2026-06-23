import { createElement, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, Clock3, Link2, MapPin, MessageCircle, Send, UsersRound, X } from 'lucide-react-native';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

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
  CARD_RESPONSE_WINDOW_NOTICE,
  compactDraftTimes,
  createDefaultCardDraft,
  createDefaultDraftTime,
  DUPLICATE_DRAFT_TIME_ERROR,
  ensureDraftTimeCount,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCardExpiresAt,
  getCandidateEndsAt,
  getGeneratedCardTitle,
  getModeLabel,
  getShareUrlForClipboard,
  limitDraftTimeCount,
  MAX_CARD_CANDIDATE_TIMES,
  PAST_DRAFT_TIME_ERROR,
  removeDraftTimeAtIndex,
  validateCardDraft,
  type CardDraft,
} from '@/lib/cardMenu';
import { getDeliveredCardManagePath } from '@/lib/managedCards';
import {
  UNSHAREABLE_PREVIEW_CARD_MESSAGE,
  getShareablePreviewCard,
} from '@/lib/previewActions';
import {
  getPreviewFriendOptions,
  getPreviewRecipientProfileIds,
  togglePreviewFriendSelection,
} from '@/lib/previewFriends';
import type { AppointmentMode, PromiseCard } from '@/types/promise';

const INITIAL_DRAFT: CardDraft = {
  ...createDefaultCardDraft(),
};
const MODAL_BACKDROP_COLOR = 'rgba(75, 52, 40, 0.42)';
const CARD_BASE_URL = (process.env.EXPO_PUBLIC_CARD_BASE_URL ?? 'https://whenbollae.app').replace(/\/+$/, '');

export default function CreateCardScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const screenScrollRef = useRef<ScrollView>(null);
  const messageInputRef = useRef<TextInput>(null);
  const { addManagedCard } = useManagedCards();
  const { friends, isLoading: isFriendsLoading, reload: reloadFriends } = useFriends();
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
      times:
        mode === 'DIRECT'
          ? [times[0] ?? createDefaultDraftTime(0)]
          : limitDraftTimeCount(ensureDraftTimeCount(times, 2)),
    }),
    [draft, mode, times],
  );
  const visibleTimes =
    mode === 'DIRECT' ? [times[0] ?? createDefaultDraftTime(0)] : limitDraftTimeCount(ensureDraftTimeCount(times, 2));
  const { options: previewFriendOptions } = useMemo(
    () => getPreviewFriendOptions(friends),
    [friends],
  );
  const friendPickerPanelHeight = Math.min(680, Math.max(500, Math.round(windowHeight * 0.76)));
  const selectedFriendCount = selectedFriendIds.length;
  useFocusEffect(
    useCallback(() => {
      void reloadFriends();
    }, [reloadFriends]),
  );

  function handleModeChange(nextMode: AppointmentMode) {
    setMode(nextMode);
    setFeedback(null);
    setPreviewCard(null);
    setValidationNotice(null);

    if (nextMode === 'POLL') {
      setTimes((currentTimes) => limitDraftTimeCount(ensureDraftTimeCount(currentTimes, 2)));
      return;
    }

    setTimes((currentTimes) => ensureDraftTimeCount(currentTimes, 2));
  }

  function handleChangeTime(index: number, value: string) {
    setTimes((currentTimes) =>
      limitDraftTimeCount(ensureDraftTimeCount(currentTimes, mode === 'POLL' ? 2 : 1)).map((time, timeIndex) =>
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
      const nextTimes = limitDraftTimeCount(ensureDraftTimeCount(currentTimes, 2));

      if (mode === 'DIRECT' || nextTimes.length >= MAX_CARD_CANDIDATE_TIMES) {
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
      if (validation.error === DUPLICATE_DRAFT_TIME_ERROR || validation.error === PAST_DRAFT_TIME_ERROR) {
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

  function focusMessageInput() {
    setTimeout(() => {
      messageInputRef.current?.focus();
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
      await Clipboard.setStringAsync(getShareUrlForClipboard(shareable.card));
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

  function goToFriendAdd() {
    setIsFriendPickerOpen(false);
    router.push('/friends');
  }

  function toggleFriendSelection(friendId: string) {
    setSelectedFriendIds((currentIds) => togglePreviewFriendSelection(currentIds, friendId));
  }

  async function handleConfirmFriendSend() {
    if (!previewCard || selectedFriendCount === 0) {
      setFeedback('카드를 보낼 친구를 선택해 주세요.');
      return;
    }

    const recipientProfileIds = getPreviewRecipientProfileIds(friends, selectedFriendIds);

    if (recipientProfileIds.length === 0) {
      setFeedback('실제 앱 친구를 추가한 뒤 카드를 보내 주세요.');
      return;
    }

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
    <View
      style={[
        styles.modalPanel,
        isFriendPickerOpen && styles.friendPickerPanel,
        isFriendPickerOpen ? { height: friendPickerPanelHeight } : null,
      ]}>
      <View style={styles.modalHeader}>
        <View style={styles.modalTitleGroup}>
          <Text style={styles.modalKicker}>{getModeLabel(previewCard.mode)}</Text>
          <Text style={styles.modalTitle}>{isFriendPickerOpen ? '앱 친구에게 보내기' : '공유 전 미리보기'}</Text>
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
      {isFriendPickerOpen ? (
        <PreviewFriendSendSummary card={previewCard} />
      ) : (
        <>
          <DraftPreviewCard card={previewCard} />
          <Text style={styles.expirationNotice}>{CARD_RESPONSE_WINDOW_NOTICE}</Text>
        </>
      )}
      {feedback ? <Text style={styles.modalFeedback}>{feedback}</Text> : null}
      {isFriendPickerOpen ? (
        <View style={styles.friendPicker}>
          <View style={styles.friendPickerHeadingRow}>
            <Text style={styles.friendPickerTitle}>보낼 친구 선택</Text>
            {!isFriendsLoading && previewFriendOptions.length > 0 ? (
              <Text style={styles.friendPickerCount}>
                {selectedFriendCount > 0 ? `${selectedFriendCount}명 선택` : `전체 ${previewFriendOptions.length}명`}
              </Text>
            ) : null}
          </View>
          {isFriendsLoading ? <Text style={styles.friendPickerNotice}>친구 목록을 불러오는 중이에요.</Text> : null}
          {!isFriendsLoading && previewFriendOptions.length === 0 ? (
            <View style={styles.friendPickerEmpty}>
              <Text style={styles.friendPickerNotice}>
                앱 친구가 아직 없어요. 친구 아이디로 먼저 친구를 추가하면 카드와 알림이 실제로 전달돼요.
                {'\n'}친구 추가 후 카드 탭으로 돌아오면 이 미리보기가 유지돼요.
              </Text>
              <ActionButton
                label="친구 추가"
                variant="secondary"
                icon={<UsersRound size={18} color={palette.primaryDeep} />}
                disabled={isPreviewActionPending}
                fullWidth
                onPress={goToFriendAdd}
              />
            </View>
          ) : null}
          {!isFriendsLoading && previewFriendOptions.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.friendPickerListContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.friendPickerListScroller}>
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
                      <Text style={[styles.friendCheckText, selected && styles.selectedFriendCheckText]}>
                        {selected ? '선택됨' : '선택하기'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
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
              label={
                isPreviewActionPending
                  ? '보내는 중'
                  : selectedFriendCount > 0
                    ? `${selectedFriendCount}명에게 보내기`
                    : '보내기'
              }
              disabled={isPreviewActionPending || selectedFriendCount === 0}
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
              singleLineLabel
              style={styles.previewAppFriendButton}
              labelStyle={styles.previewSecondaryActionLabel}
              fullWidth
              onPress={handleSendToAppFriend}
            />
            <ActionButton
              label="링크 복사"
              variant="secondary"
              icon={<Link2 size={18} color={palette.primaryDeep} />}
              disabled={isPreviewActionPending}
              singleLineLabel
              style={styles.previewLinkButton}
              labelStyle={styles.previewSecondaryActionLabel}
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
      <AppScreen keyboardAware reserveBottomTabs scrollRef={screenScrollRef}>
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
          maxTimes={MAX_CARD_CANDIDATE_TIMES}
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
            ref={messageInputRef}
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
              focusMessageInput();
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
          {isFriendPickerOpen ? (
            <View style={styles.modalBackdrop}>
              <Pressable
                accessibilityLabel="미리보기 닫기"
                accessibilityRole="button"
                onPress={closePreview}
                style={styles.modalBackdropTouchable}
              />
              <View style={styles.modalPressGuard}>{previewPanel}</View>
            </View>
          ) : (
            <Pressable style={styles.modalBackdrop} onPress={closePreview}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.modalScrollView}>
                <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
                  {previewPanel}
                </Pressable>
              </ScrollView>
            </Pressable>
          )}
        </Modal>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => setValidationNotice(null)}
        transparent
        visible={validationNotice !== null}>
        <Pressable style={styles.modalBackdrop} onPress={() => setValidationNotice(null)}>
          <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PreviewFriendSendSummary({ card }: { card: PromiseCard }) {
  const timeLabel =
    card.mode === 'POLL' && card.candidates.length > 1
      ? card.candidates.map((candidate) => candidate.label).join(' / ')
      : card.candidates[0]?.label ?? '시간 미정';
  const locationLabel = card.location.trim() || '장소 미정';

  return (
    <View style={styles.previewCompactSummary}>
      <View style={styles.previewCompactTopRow}>
        <Text style={styles.previewCompactKicker}>{getModeLabel(card.mode)}</Text>
        <Text numberOfLines={1} style={styles.previewCompactNotice}>
          {CARD_RESPONSE_WINDOW_NOTICE}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.previewCompactTitle}>
        {card.title}
      </Text>
      <View style={styles.previewCompactMetaLine}>
        <Clock3 size={14} color={palette.primaryDeep} />
        <Text numberOfLines={1} style={styles.previewCompactMetaText}>
          {timeLabel} · {locationLabel}
        </Text>
      </View>
    </View>
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
    expiresAt: getCardExpiresAt(createdAt),
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
  previewAppFriendButton: {
    flex: 1.55,
    paddingHorizontal: spacing.sm,
  },
  previewLinkButton: {
    flex: 0.95,
    paddingHorizontal: spacing.sm,
  },
  previewSecondaryActionLabel: {
    fontSize: 13,
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
  modalBackdropTouchable: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalPressGuard: {
    alignItems: 'center',
    width: '100%',
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
  friendPickerPanel: {
    gap: spacing.sm,
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
  expirationNotice: {
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
  previewCompactSummary: {
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: 6,
    padding: spacing.sm,
  },
  previewCompactTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  previewCompactKicker: {
    backgroundColor: palette.amber,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.ink,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  previewCompactNotice: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  previewCompactTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  previewCompactMetaLine: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  previewCompactMetaText: {
    color: palette.ink,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
    minWidth: 0,
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
    flex: 1,
    gap: spacing.sm,
    minHeight: 0,
  },
  friendPickerHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  friendPickerTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  friendPickerCount: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  friendPickerList: {
    gap: spacing.xs,
  },
  friendPickerListScroller: {
    flex: 1,
    minHeight: 180,
  },
  friendPickerListContent: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  friendPickerEmpty: {
    gap: spacing.sm,
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
