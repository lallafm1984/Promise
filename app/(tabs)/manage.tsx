import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Link2, Send, Trash2, UsersRound, X } from 'lucide-react-native';
import { KeyboardAvoidingView, Modal, Platform, Share, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DraftPreviewCard, ManagedCardsSection } from '@/components/card-menu';
import { ActionButton, AppScreen, Card } from '@/components/ui';
import { compactHero, modalOverlay, palette, radius, spacing } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  buildScheduleItemFromConfirmedCard,
  buildShareMessage,
  canDeleteManagedCard,
  canDeleteResponseActionCard,
  canHideReceivedManagedCard,
  canHideManagedPastCard,
  canConfirmCandidateSlot,
  formatCandidateResponseSummary,
  getManagedCardInboxTab,
  getManagedCardResponseStats,
  getManagedCardScope,
  getModeLabel,
  getPrimarySlot,
  getManagedStatusGroup,
  getReceivedCardResponseBadges,
  getRecommendedConfirmationCandidate,
  getShareUrlForClipboard,
  shouldShowCardLocationDetail,
  type ManagedCardActionKind,
  type ManagedCardInboxTab,
  type ManagedCardScope,
  type ManagedStatusGroup,
} from '@/lib/cardMenu';
import {
  buildCardCancellationMessage,
  filterManagedCardsByHiddenPastIds,
  filterManagedCardsByHiddenReceivedReplyIds,
  getConfirmedCardSchedulePath,
  getManagedCardDeleteConfirmation,
  getManagedPastCardHideConfirmation,
  getReceivedReplyCardHideConfirmation,
} from '@/lib/managedCards';
import {
  UNSHAREABLE_PREVIEW_CARD_MESSAGE,
  isShareablePublicCard,
} from '@/lib/previewActions';
import { getPreviewFriendOptions, getPreviewRecipientProfileIds, togglePreviewFriendSelection } from '@/lib/previewFriends';
import {
  getReceivedCardResponseErrorMessage,
  isReceivedCardResponseUnavailableError,
} from '@/lib/responseErrors';
import type { CandidateSlot, Participant, PromiseCard, ReceivedCardResponseChoice, ResponseChoice } from '@/types/promise';

type SelectableResponseChoice = Exclude<ReceivedCardResponseChoice, 'MAYBE'>;
type QuickConfirmItem = { card: PromiseCard; suggestedCandidate: CandidateSlot };
type DeleteModalActionVariant = 'secondary' | 'danger';
const RESPONSE_COMMENT_SCROLL_DELAY_MS = 240;

const participantChoiceLabels: Record<ResponseChoice, string> = {
  YES: '가능',
  MAYBE: '애매',
  NO: '어려움',
  UNANSWERED: '미응답',
};

function getParticipantDisplayName(participant: Participant) {
  return participant.displayName?.trim() || participant.name;
}

function getParticipantComment(participant: Participant) {
  return participant.comment?.trim();
}

function getParticipantChoiceBadgeStyle(choice: ResponseChoice) {
  switch (choice) {
    case 'YES':
      return styles.respondentChoiceYes;
    case 'MAYBE':
      return styles.respondentChoiceMaybe;
    case 'NO':
      return styles.respondentChoiceNo;
    case 'UNANSWERED':
      return styles.respondentChoiceUnanswered;
  }
}

function getParticipantCandidateChoice(participant: Participant, candidateId: string, candidateCount: number): ResponseChoice {
  const response = participant.responses?.find((currentResponse) => currentResponse.candidateId === candidateId);

  if (response) {
    return response.choice;
  }

  return candidateCount === 1 ? participant.choice ?? 'UNANSWERED' : 'UNANSWERED';
}

function shouldHideManagedCardOnly(card: PromiseCard, now: Date): boolean {
  return (
    canHideReceivedManagedCard(card) ||
    canHideManagedPastCard(card, now) ||
    (getManagedCardScope(card) === 'SENT' && getManagedStatusGroup(card, now) === 'CONFIRMED')
  );
}

function QuickConfirmCard({
  card,
  suggestedCandidate,
  selectedCandidateId,
  disabled,
  canDelete,
  onSelectCandidate,
  onConfirm,
  onOpenResults,
  onDelete,
}: {
  card: PromiseCard;
  suggestedCandidate: CandidateSlot;
  selectedCandidateId?: string;
  disabled: boolean;
  canDelete?: boolean;
  onSelectCandidate: (candidateId: string) => void;
  onConfirm: (candidateId: string) => void;
  onOpenResults: () => void;
  onDelete?: () => void;
}) {
  const stats = getManagedCardResponseStats(card);
  const hasConfirmableCandidate = card.candidates.some(canConfirmCandidateSlot);
  const shouldShowLocation = shouldShowCardLocationDetail(card);
  const selectedCandidate =
    card.mode === 'DIRECT'
      ? suggestedCandidate
      : card.candidates.find((candidate) => candidate.id === selectedCandidateId);
  const canConfirm = Boolean(selectedCandidate && canConfirmCandidateSlot(selectedCandidate));
  const confirmLabel =
    !hasConfirmableCandidate
      ? '가능 응답 없음'
      : card.mode === 'DIRECT'
        ? '약속 확정'
        : selectedCandidate
          ? `${selectedCandidate.shortLabel || selectedCandidate.label} 확정`
          : '시간을 선택해 주세요';
  const candidateMeta =
    card.mode === 'DIRECT'
      ? formatCandidateResponseSummary(suggestedCandidate.summary)
      : hasConfirmableCandidate
        ? '시간 선택 후 확정'
        : '상세 확인 필요';

  return (
    <Card style={[styles.quickConfirmCard, card.mode === 'DIRECT' ? styles.quickConfirmDirect : styles.quickConfirmPoll]}>
      <View style={styles.quickConfirmTop}>
        <View style={styles.quickConfirmModeBadge}>
          <Text style={styles.quickConfirmModeText}>{getModeLabel(card.mode)}</Text>
        </View>
        <View style={styles.quickConfirmTopActions}>
          <Text style={styles.quickConfirmCandidateMeta}>{candidateMeta}</Text>
          {canDelete && onDelete ? (
            <Pressable
              accessibilityLabel={`${card.title} 삭제`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDelete}
              style={({ pressed }) => [styles.quickConfirmDeleteButton, pressed && styles.pressed]}>
              <Trash2 size={15} color={palette.primaryDeep} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.quickConfirmBody}>
        <Text style={styles.quickConfirmCardTitle} numberOfLines={2}>
          {card.title}
        </Text>
        {card.mode === 'POLL' ? (
          <View style={styles.quickConfirmSlotList}>
            {card.candidates.map((candidate) => {
              const selected = selectedCandidateId === candidate.id;
              const candidateCanConfirm = canConfirmCandidateSlot(candidate);

              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !candidateCanConfirm, selected }}
                  disabled={!candidateCanConfirm}
                  onPress={() => onSelectCandidate(candidate.id)}
                  style={({ pressed }) => [
                    styles.quickConfirmSlotOption,
                    selected && styles.selectedQuickConfirmSlotOption,
                    !candidateCanConfirm && styles.disabledQuickConfirmSlotOption,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.quickConfirmSlotOptionTime,
                      selected && styles.selectedQuickConfirmSlotOptionText,
                      !candidateCanConfirm && styles.disabledQuickConfirmSlotOptionText,
                    ]}
                    numberOfLines={1}>
                    {candidate.shortLabel || candidate.label}
                  </Text>
                  <Text
                    style={[
                      styles.quickConfirmSlotOptionMeta,
                      selected && styles.selectedQuickConfirmSlotOptionText,
                      !candidateCanConfirm && styles.disabledQuickConfirmSlotOptionText,
                    ]}
                    numberOfLines={1}>
                    {formatCandidateResponseSummary(candidate.summary)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.quickConfirmSlot} numberOfLines={1}>
            {suggestedCandidate.label}
          </Text>
        )}
        {shouldShowLocation ? (
          <Text style={styles.quickConfirmLocation} numberOfLines={1}>
            {card.location}
          </Text>
        ) : null}
      </View>

      <View style={styles.quickConfirmStats}>
        <View style={styles.quickConfirmStat}>
          <Text style={styles.quickConfirmStatLabel}>응답</Text>
          <Text style={styles.quickConfirmStatValue}>{stats.total}명</Text>
        </View>
        <View style={[styles.quickConfirmStat, styles.quickConfirmStatYes]}>
          <Text style={styles.quickConfirmStatLabel}>가능</Text>
          <Text style={styles.quickConfirmStatValue}>{stats.yes}</Text>
        </View>
        <View style={[styles.quickConfirmStat, styles.quickConfirmStatNo]}>
          <Text style={styles.quickConfirmStatLabel}>어려움</Text>
          <Text style={styles.quickConfirmStatValue}>{stats.no}</Text>
        </View>
      </View>

      <View style={styles.quickConfirmActions}>
        <ActionButton
          label={disabled ? '확정 중' : confirmLabel}
          variant="primary"
          disabled={disabled || !canConfirm || !selectedCandidate}
          fullWidth
          onPress={() => selectedCandidate && onConfirm(selectedCandidate.id)}
        />
        <ActionButton label="상세보기" variant="secondary" disabled={disabled} fullWidth onPress={onOpenResults} />
      </View>
    </Card>
  );
}

function DeleteModalButton({
  disabled,
  label,
  onPress,
  variant,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant: DeleteModalActionVariant;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.deleteActionButton,
        variant === 'danger' ? styles.deleteDangerActionButton : styles.deleteSecondaryActionButton,
        disabled && styles.disabledDeleteActionButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        style={[
          styles.deleteActionText,
          variant === 'danger' ? styles.deleteDangerActionText : styles.deleteSecondaryActionText,
          disabled && styles.disabledDeleteActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const scopeTabs: Array<{ key: ManagedCardScope; label: string }> = [
  { key: 'SENT', label: '보낸 카드' },
  { key: 'RECEIVED', label: '받은 카드' },
];

const sentTabs: ManagedCardInboxTab[] = ['SENT_NO_RESPONSE', 'SENT_HAS_RESPONSE'];
const receivedTabs: ManagedCardInboxTab[] = ['RECEIVED_NEEDS_REPLY', 'RECEIVED_REPLIED'];

const tabsByScope: Record<ManagedCardScope, ManagedCardInboxTab[]> = {
  SENT: sentTabs,
  RECEIVED: receivedTabs,
};

const emptyCopyByTab: Record<ManagedCardInboxTab, { title: string; body: string }> = {
  SENT_NO_RESPONSE: {
    title: '응답을 기다리는 카드가 없어요',
    body: '새 카드를 만들거나, 이미 응답이 온 카드는 응답 도착 탭에서 확인해요.',
  },
  SENT_HAS_RESPONSE: {
    title: '도착한 응답이 없어요',
    body: '상대가 답하면 여기에서 가능 여부와 한마디를 바로 볼 수 있어요.',
  },
  SENT_CONFIRMED: {
    title: '확정된 보낸 카드가 없어요',
    body: '응답 결과에서 시간을 확정하면 일정으로 등록돼요.',
  },
  SENT_PAST: {
    title: '지난 보낸 약속이 없어요',
    body: '시간이 지난 확정 약속은 여기에 모여요.',
  },
  RECEIVED_NEEDS_REPLY: {
    title: '답장할 카드가 없어요',
    body: '친구가 보낸 카드가 오면 여기에서 바로 답장할 수 있어요.',
  },
  RECEIVED_REPLIED: {
    title: '답장 완료한 카드가 없어요',
    body: '내가 답한 카드는 생성자가 확정하기 전까지 여기에 남아요.',
  },
  RECEIVED_CONFIRMED: {
    title: '확정된 받은 약속이 없어요',
    body: '확정된 받은 약속은 일정에서도 함께 확인할 수 있어요.',
  },
  RECEIVED_PAST: {
    title: '지난 받은 약속이 없어요',
    body: '시간이 지난 받은 약속은 여기에 모여요.',
  },
};

const legacyGroupTabs: Partial<Record<ManagedStatusGroup, ManagedCardInboxTab>> = {
  PENDING: 'SENT_NO_RESPONSE',
  VOTING: 'SENT_NO_RESPONSE',
  DECLINED: 'SENT_HAS_RESPONSE',
};

function getScopeForTab(tab: ManagedCardInboxTab): ManagedCardScope {
  return tab.startsWith('RECEIVED') ? 'RECEIVED' : 'SENT';
}

function getCompactManagedCardTabLabel(tab: ManagedCardInboxTab): string {
  switch (tab) {
    case 'SENT_NO_RESPONSE':
      return '응답없음';
    case 'SENT_HAS_RESPONSE':
      return '응답도착';
    case 'SENT_CONFIRMED':
    case 'RECEIVED_CONFIRMED':
      return '확정';
    case 'SENT_PAST':
    case 'RECEIVED_PAST':
      return '지난';
    case 'RECEIVED_NEEDS_REPLY':
      return '답장필요';
    case 'RECEIVED_REPLIED':
      return '답장완료';
  }
}

export default function ManageCardsScreen() {
  const router = useRouter();
  const { group, scroll, tab } = useLocalSearchParams<{
    group?: string | string[];
    scroll?: string | string[];
    tab?: string | string[];
  }>();
  const {
    profile,
    managedCards,
    hiddenPastCardIds,
    hiddenReceivedReplyCardIds,
    isLoading,
    error,
    removeManagedCard,
    hideManagedPastCard,
    hideReceivedRepliedCard,
    sendManagedCardToRecipients,
    confirmManagedCard,
    respondToReceivedCard,
    reload: reloadManagedCards,
  } = useManagedCards();
  const { friends, isLoading: isFriendsLoading } = useFriends();
  const [activeScope, setActiveScope] = useState<ManagedCardScope>('SENT');
  const [activeTab, setActiveTab] = useState<ManagedCardInboxTab>('SENT_NO_RESPONSE');
  const [resultCard, setResultCard] = useState<PromiseCard | null>(null);
  const [responseCard, setResponseCard] = useState<PromiseCard | null>(null);
  const [responseFeedback, setResponseFeedback] = useState<string | null>(null);
  const [isResponseUnavailable, setIsResponseUnavailable] = useState(false);
  const [reshareCard, setReshareCard] = useState<PromiseCard | null>(null);
  const [deleteConfirmCard, setDeleteConfirmCard] = useState<PromiseCard | null>(null);
  const [isReshareFriendPickerOpen, setIsReshareFriendPickerOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isReshareActionPending, setIsReshareActionPending] = useState(false);
  const [reshareFeedback, setReshareFeedback] = useState<string | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [responseChoices, setResponseChoices] = useState<Record<string, SelectableResponseChoice>>({});
  const [responseComment, setResponseComment] = useState('');
  const [selectedQuickCandidateIds, setSelectedQuickCandidateIds] = useState<Record<string, string>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const responseModalScrollRef = useRef<ScrollView>(null);
  const now = useMemo(() => new Date(), [managedCards]);
  const currentProfile = useMemo(
    () => (profile ? { id: profile.id, displayName: profile.displayName } : undefined),
    [profile],
  );
  const { options: previewFriendOptions } = useMemo(
    () => getPreviewFriendOptions(friends),
    [friends],
  );
  const selectedFriendCount = selectedFriendIds.length;
  useFocusEffect(
    useCallback(() => {
      void reloadManagedCards({ force: true });
    }, [reloadManagedCards]),
  );
  useEffect(() => {
    const routeGroup = Array.isArray(group) ? group[0] : group;
    const routeTab = Array.isArray(tab) ? tab[0] : tab;

    if (routeTab && [...sentTabs, ...receivedTabs].includes(routeTab as ManagedCardInboxTab)) {
      const nextTab = routeTab as ManagedCardInboxTab;
      setActiveScope(getScopeForTab(nextTab));
      setActiveTab(nextTab);
      return;
    }

    if (routeGroup && routeGroup in legacyGroupTabs) {
      const nextTab = legacyGroupTabs[routeGroup as ManagedStatusGroup];
      if (!nextTab) {
        return;
      }
      setActiveScope(getScopeForTab(nextTab));
      setActiveTab(nextTab);
    }
  }, [group, tab]);
  const activeTabKeys = tabsByScope[activeScope];
  const tabCounts = useMemo(
    () =>
      activeTabKeys.reduce(
        (counts, tab) => ({
          ...counts,
          [tab]: filterManagedCardsByHiddenReceivedReplyIds(
            filterManagedCardsByHiddenPastIds(managedCards, hiddenPastCardIds, now),
            hiddenReceivedReplyCardIds,
            now,
            currentProfile,
          ).filter((card) => getManagedCardInboxTab(card, now, currentProfile) === tab).length,
        }),
        {} as Partial<Record<ManagedCardInboxTab, number>>,
      ),
    [activeTabKeys, currentProfile, hiddenPastCardIds, hiddenReceivedReplyCardIds, managedCards, now],
  );
  const visibleManagedCards = useMemo(
    () =>
      filterManagedCardsByHiddenReceivedReplyIds(
        filterManagedCardsByHiddenPastIds(managedCards, hiddenPastCardIds, now),
        hiddenReceivedReplyCardIds,
        now,
        currentProfile,
      ).filter((card) => getManagedCardInboxTab(card, now, currentProfile) === activeTab),
    [activeTab, currentProfile, hiddenPastCardIds, hiddenReceivedReplyCardIds, managedCards, now],
  );
  const visibleResponseActionItems = useMemo(
    () =>
      visibleManagedCards.reduce<QuickConfirmItem[]>((items, card) => {
        const candidate = getRecommendedConfirmationCandidate(card) ?? getPrimarySlot(card);

        if (candidate) {
          items.push({ card, suggestedCandidate: candidate });
        }

        return items;
      }, []),
    [visibleManagedCards],
  );
  const activeEmptyCopy = emptyCopyByTab[activeTab];

  function selectScope(scope: ManagedCardScope) {
    setActiveScope(scope);
    setActiveTab(tabsByScope[scope][0]);
  }

  function selectTab(tab: ManagedCardInboxTab) {
    setActiveScope(getScopeForTab(tab));
    setActiveTab(tab);
  }

  async function handleManagedAction(card: PromiseCard, action: ManagedCardActionKind) {
    if (action === 'OPEN_RECEIVED') {
      setResponseCard(card);
      setResponseChoices({});
      setResponseComment('');
      setResponseFeedback(null);
      setIsResponseUnavailable(false);
      return;
    }

    if (action === 'RESHARE') {
      setReshareCard(card);
      setIsReshareFriendPickerOpen(false);
      setSelectedFriendIds([]);
      setReshareFeedback(null);
      return;
    }

    if (action === 'SCHEDULE') {
      router.push(getConfirmedCardSchedulePath(card));
      return;
    }

    if (action === 'RESULTS') {
      setResultCard(card);
      return;
    }

    router.push('/create');
  }

  async function handleDeleteCard(card: PromiseCard) {
    if (
      !canDeleteManagedCard(card, now) &&
      !canDeleteResponseActionCard(card, now, currentProfile) &&
      !canHideReceivedManagedCard(card) &&
      !canHideManagedPastCard(card, now)
    ) {
      return;
    }

    setDeleteConfirmCard(card);
  }

  function closeDeleteConfirmModal() {
    if (isDeletingCard) {
      return;
    }

    setDeleteConfirmCard(null);
  }

  async function confirmDeleteCard() {
    if (!deleteConfirmCard) {
      return;
    }

    try {
      setIsDeletingCard(true);
      if (canHideReceivedManagedCard(deleteConfirmCard)) {
        hideReceivedRepliedCard(deleteConfirmCard, now, currentProfile);
      } else if (shouldHideManagedCardOnly(deleteConfirmCard, now)) {
        hideManagedPastCard(deleteConfirmCard, now);
      } else {
        await removeManagedCard(deleteConfirmCard.id);
      }
      setDeleteConfirmCard(null);
    } finally {
      setIsDeletingCard(false);
    }
  }

  async function confirmShareAndDeleteCard() {
    if (!deleteConfirmCard) {
      return;
    }

    const card = deleteConfirmCard;
    const scheduleItem = buildScheduleItemFromConfirmedCard(card) ?? {
      title: card.title,
      dateLabel: '확정 일정',
      timeLabel: '시간 확인 필요',
      location: card.location,
    };

    try {
      setIsDeletingCard(true);
      const shareResult = await Share.share({
        message: buildCardCancellationMessage(scheduleItem),
      });

      if (shareResult.action === Share.dismissedAction) {
        return;
      }

      await removeManagedCard(card.id);
      setDeleteConfirmCard(null);
    } finally {
      setIsDeletingCard(false);
    }
  }

  function closeReshareModal() {
    setReshareCard(null);
    setIsReshareFriendPickerOpen(false);
    setSelectedFriendIds([]);
    setIsReshareActionPending(false);
    setReshareFeedback(null);
  }

  async function handleReshareWithKakao() {
    if (!reshareCard) {
      return;
    }

    if (!isShareablePublicCard(reshareCard)) {
      setReshareFeedback(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
      return;
    }

    setIsReshareActionPending(true);

    try {
      const result = await Share.share({
        message: buildShareMessage(reshareCard),
        url: reshareCard.sharedUrl,
      });
      if (result.action !== Share.dismissedAction) {
        closeReshareModal();
      }
    } catch {
      setReshareFeedback('공유를 열 수 없어요. 다시 시도해 주세요.');
    } finally {
      setIsReshareActionPending(false);
    }
  }

  async function handleCopyReshareLink() {
    if (!reshareCard) {
      return;
    }

    if (!isShareablePublicCard(reshareCard)) {
      setReshareFeedback(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
      return;
    }

    setIsReshareActionPending(true);

    try {
      await Clipboard.setStringAsync(getShareUrlForClipboard(reshareCard));
      closeReshareModal();
    } catch {
      setReshareFeedback('링크를 복사하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsReshareActionPending(false);
    }
  }

  function openReshareFriendPicker() {
    setIsReshareFriendPickerOpen(true);
    setSelectedFriendIds([]);
    setReshareFeedback(null);
  }

  function goToFriendAddFromReshare() {
    setIsReshareFriendPickerOpen(false);
    router.push('/friends');
  }

  function toggleReshareFriendSelection(friendId: string) {
    setSelectedFriendIds((currentIds) => togglePreviewFriendSelection(currentIds, friendId));
  }

  async function handleConfirmReshareFriendSend() {
    if (!reshareCard || selectedFriendCount === 0) {
      return;
    }

    if (!isShareablePublicCard(reshareCard)) {
      setReshareFeedback(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
      return;
    }

    const recipientProfileIds = getPreviewRecipientProfileIds(friends, selectedFriendIds);

    if (recipientProfileIds.length === 0) {
      setReshareFeedback('실제 앱 친구를 추가한 뒤 카드를 보내 주세요.');
      return;
    }

    setIsReshareActionPending(true);

    try {
      await sendManagedCardToRecipients(reshareCard, recipientProfileIds);
      closeReshareModal();
    } catch {
      setReshareFeedback('카드를 보내지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsReshareActionPending(false);
    }
  }

  async function handleConfirmCandidate(card: PromiseCard, candidateId: string) {
    setIsConfirming(true);

    try {
      const confirmedCard = await confirmManagedCard(card.id, candidateId);
      setSelectedQuickCandidateIds((currentCandidateIds) => {
        const nextCandidateIds = { ...currentCandidateIds };
        delete nextCandidateIds[card.id];
        return nextCandidateIds;
      });
      setResultCard(null);
      selectTab(sentTabs[0]);
      await reloadManagedCards({ force: true });
      router.push(getConfirmedCardSchedulePath(confirmedCard));
    } catch {
      return;
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleSubmitResponse() {
    if (!responseCard) {
      return;
    }

    const responses = responseCard.candidates
      .map((candidate) => ({
        candidateId: candidate.id,
        choice: responseChoices[candidate.id],
      }))
      .filter((response): response is { candidateId: string; choice: SelectableResponseChoice } => Boolean(response.choice));

    if (responses.length !== responseCard.candidates.length) {
      setResponseFeedback('모든 시간에 응답을 선택해 주세요.');
      return;
    }

    setResponseFeedback(null);
    setIsResponding(true);

    try {
      const respondedCard = await respondToReceivedCard(responseCard.id, responses, responseComment);
      selectTab(getManagedCardInboxTab(respondedCard, now, currentProfile));
      closeResponseModal();
    } catch (error) {
      setResponseFeedback(getReceivedCardResponseErrorMessage(error));

      if (isReceivedCardResponseUnavailableError(error)) {
        setIsResponseUnavailable(true);
        hideReceivedRepliedCard(responseCard, now, currentProfile);
      }

      await reloadManagedCards({ force: true });
    } finally {
      setIsResponding(false);
    }
  }

  const scrollResponseCommentIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      responseModalScrollRef.current?.scrollToEnd({ animated: true });
    });
    setTimeout(() => {
      responseModalScrollRef.current?.scrollToEnd({ animated: true });
    }, RESPONSE_COMMENT_SCROLL_DELAY_MS);
  }, []);

  function setCandidateChoice(candidateId: string, choice: SelectableResponseChoice) {
    setResponseChoices((currentChoices) => ({
      ...currentChoices,
      [candidateId]: choice,
    }));
  }

  function closeResponseModal() {
    setResponseCard(null);
    setResponseChoices({});
    setResponseComment('');
    setResponseFeedback(null);
    setIsResponseUnavailable(false);
  }

  function selectQuickConfirmCandidate(cardId: string, candidateId: string) {
    setSelectedQuickCandidateIds((currentCandidateIds) => ({
      ...currentCandidateIds,
      [cardId]: candidateId,
    }));
  }

  const responseGroup = responseCard ? getManagedStatusGroup(responseCard, now) : null;
  const responseBadges = responseCard ? getReceivedCardResponseBadges(responseCard, currentProfile) : [];
  const canRespond = responseCard
    ? !isResponseUnavailable && (responseGroup === 'PENDING' || responseGroup === 'VOTING') && responseBadges.length === 0
    : false;
  const hasAllResponseChoices = responseCard
    ? responseCard.candidates.every((candidate) => Boolean(responseChoices[candidate.id]))
    : false;
  const resultGroup = resultCard ? getManagedStatusGroup(resultCard, now) : null;
  const canConfirmResult = resultGroup === 'PENDING' || resultGroup === 'VOTING';
  const deleteConfirmation = deleteConfirmCard
    ? canHideReceivedManagedCard(deleteConfirmCard)
      ? getReceivedReplyCardHideConfirmation()
      : shouldHideManagedCardOnly(deleteConfirmCard, now)
        ? getManagedPastCardHideConfirmation(deleteConfirmCard)
        : getManagedCardDeleteConfirmation(deleteConfirmCard)
    : null;
  const hasScheduleDeleteActions = Boolean(
    deleteConfirmation?.directDeleteLabel && deleteConfirmation.shareDeleteLabel,
  );
  const routeScrollKey = Array.isArray(scroll) ? scroll[0] : scroll;

  return (
    <AppScreen reserveBottomTabs scrollToTopKey={routeScrollKey}>
      <View style={styles.header}>
        <View style={styles.headerShapePrimary} />
        <View style={styles.headerShapeMint} />
        <View style={styles.headerShapeLime} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>언제볼래</Text>
          <Text style={styles.title}>관리함</Text>
          <Text style={styles.subtitle}>보낸 카드와 받은 카드를 나눠서 응답 상태를 확인해요.</Text>
        </View>
      </View>

      {error ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>카드를 불러오지 못했어요</Text>
          <Text style={styles.noticeBody}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.scopeTabs}>
        {scopeTabs.map((tab) => {
          const selected = activeScope === tab.key;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectScope(tab.key)}
              style={({ pressed }) => [styles.scopeTab, selected && styles.selectedScopeTab, pressed && styles.pressed]}>
              <View style={[styles.scopeTabAccent, selected && styles.selectedScopeTabAccent]} />
              <View style={styles.scopeTabContent}>
                <Text style={[styles.scopeTabLabel, selected && styles.selectedScopeTabLabel]}>{tab.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statusTabs}>
        {activeTabKeys.map((tab) => {
          const selected = activeTab === tab;

          return (
            <Pressable
              key={tab}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectTab(tab)}
              style={({ pressed }) => [styles.statusTab, selected && styles.selectedStatusTab, pressed && styles.pressed]}>
              <Text style={[styles.statusTabLabel, selected && styles.selectedStatusTabLabel]} numberOfLines={1}>
                {getCompactManagedCardTabLabel(tab)}
              </Text>
              <Text style={[styles.statusTabCount, selected && styles.selectedStatusTabCount]}>
                {isLoading ? '-' : (tabCounts[tab] ?? 0)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeScope === 'SENT' && activeTab === 'SENT_HAS_RESPONSE' && visibleResponseActionItems.length > 0 ? (
        <View style={styles.responseActionStack}>
          <Text style={styles.responseActionTitle}>응답 도착</Text>
          {visibleResponseActionItems.map(({ card, suggestedCandidate }) => (
            <QuickConfirmCard
              key={`${card.id}-${suggestedCandidate.id}`}
              card={card}
              suggestedCandidate={suggestedCandidate}
              selectedCandidateId={selectedQuickCandidateIds[card.id]}
              disabled={isConfirming}
              canDelete={canDeleteResponseActionCard(card, now, currentProfile)}
              onSelectCandidate={(candidateId) => selectQuickConfirmCandidate(card.id, candidateId)}
              onConfirm={(candidateId) => void handleConfirmCandidate(card, candidateId)}
              onOpenResults={() => setResultCard(card)}
              onDelete={() => void handleDeleteCard(card)}
            />
          ))}
        </View>
      ) : (
        <ManagedCardsSection
          cards={visibleManagedCards}
          activeTab={activeTab}
          currentProfile={currentProfile}
          emptyTitle={activeEmptyCopy.title}
          emptyBody={activeEmptyCopy.body}
          onAction={(card, action) => void handleManagedAction(card, action)}
          onDelete={(card) => void handleDeleteCard(card)}
        />
      )}

      <Modal
        transparent
        visible={deleteConfirmation !== null}
        animationType="fade"
        onRequestClose={closeDeleteConfirmModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeDeleteConfirmModal}>
          {deleteConfirmation ? (
            <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
              <Card style={styles.deleteModal}>
                <View style={styles.deleteIcon}>
                  <AlertTriangle size={24} color={palette.danger} />
                </View>
                <View style={styles.deleteCopy}>
                  <Text style={styles.resultTitle}>{deleteConfirmation.title}</Text>
                  <Text style={styles.deleteBody}>{deleteConfirmation.body}</Text>
                </View>
                <View style={[styles.deleteActions, hasScheduleDeleteActions && styles.scheduleDeleteActions]}>
                  {hasScheduleDeleteActions ? (
                    <>
                      <DeleteModalButton
                        label="취소"
                        variant="secondary"
                        disabled={isDeletingCard}
                        onPress={closeDeleteConfirmModal}
                      />
                      <DeleteModalButton
                        label={isDeletingCard ? '삭제 중' : deleteConfirmation.directDeleteLabel ?? deleteConfirmation.confirmLabel}
                        variant="danger"
                        disabled={isDeletingCard}
                        onPress={() => void confirmDeleteCard()}
                      />
                      <DeleteModalButton
                        label={isDeletingCard ? '삭제 중' : deleteConfirmation.shareDeleteLabel ?? deleteConfirmation.confirmLabel}
                        variant="danger"
                        disabled={isDeletingCard}
                        onPress={() => void confirmShareAndDeleteCard()}
                      />
                    </>
                  ) : (
                    <>
                      <ActionButton
                        label="취소"
                        variant="secondary"
                        disabled={isDeletingCard}
                        fullWidth
                        onPress={closeDeleteConfirmModal}
                      />
                      <ActionButton
                        label={isDeletingCard ? '삭제 중' : deleteConfirmation.confirmLabel}
                        variant="danger"
                        disabled={isDeletingCard}
                        fullWidth
                        onPress={() => void confirmDeleteCard()}
                      />
                    </>
                  )}
                </View>
              </Card>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(reshareCard)} animationType="fade" onRequestClose={closeReshareModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeReshareModal}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.modalScrollView}>
            <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
              {reshareCard ? (
              <Card style={styles.reshareModal}>
                <View style={styles.reshareHeader}>
                  <View style={styles.reshareHeaderCopy}>
                    <Text style={styles.resultKicker}>{reshareCard.mode === 'DIRECT' ? '이때볼래?' : '언제볼래?'}</Text>
                    <Text style={styles.resultTitle}>공유 전 미리보기</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="미리보기 닫기"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={closeReshareModal}
                    style={({ pressed }) => [styles.iconCloseButton, pressed && styles.pressed]}>
                    <X size={20} color={palette.primaryDeep} />
                  </Pressable>
                </View>

                <DraftPreviewCard card={reshareCard} />

                {reshareFeedback ? <Text style={styles.reshareFeedback}>{reshareFeedback}</Text> : null}

                {isReshareFriendPickerOpen ? (
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
                          {'\n'}친구 추가 후 관리함으로 돌아오면 이 카드 보내기를 이어갈 수 있어요.
                        </Text>
                        <ActionButton
                          label="친구 추가"
                          variant="secondary"
                          icon={<UsersRound size={18} color={palette.primaryDeep} />}
                          disabled={isReshareActionPending}
                          fullWidth
                          onPress={goToFriendAddFromReshare}
                        />
                      </View>
                    ) : null}
                    {!isFriendsLoading && previewFriendOptions.length > 0 ? (
                      <View style={styles.friendPickerList}>
                        {previewFriendOptions.map((friend) => {
                          const selected = selectedFriendIds.includes(friend.id);

                          return (
                            <Pressable
                              key={friend.id}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              disabled={isReshareActionPending}
                              onPress={() => toggleReshareFriendSelection(friend.id)}
                              style={({ pressed }) => [
                                styles.friendPickerRow,
                                selected && styles.selectedFriendPickerRow,
                                pressed && !isReshareActionPending && styles.pressed,
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
                      </View>
                    ) : null}
                    <View style={styles.secondaryActionRow}>
                      <ActionButton
                        label="취소"
                        variant="secondary"
                        disabled={isReshareActionPending}
                        fullWidth
                        onPress={() => setIsReshareFriendPickerOpen(false)}
                      />
                      <ActionButton
                        label={
                          isReshareActionPending
                            ? '보내는 중'
                            : selectedFriendCount > 0
                              ? `${selectedFriendCount}명에게 보내기`
                              : '보내기'
                        }
                        disabled={isReshareActionPending || selectedFriendCount === 0}
                        fullWidth
                        onPress={() => void handleConfirmReshareFriendSend()}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.previewActions}>
                    <ActionButton
                      label="카톡 공유"
                      variant="kakao"
                      icon={<Send size={18} color={palette.onLight} />}
                      disabled={isReshareActionPending}
                      fullWidth
                      onPress={() => void handleReshareWithKakao()}
                    />
                    <View style={styles.secondaryActionRow}>
                      <ActionButton
                        label="앱 친구에게 보내기"
                        variant="secondary"
                        icon={<UsersRound size={18} color={palette.primaryDeep} />}
                        disabled={isReshareActionPending}
                        singleLineLabel
                        style={styles.previewAppFriendButton}
                        labelStyle={styles.previewSecondaryActionLabel}
                        fullWidth
                        onPress={openReshareFriendPicker}
                      />
                      <ActionButton
                        label="링크 복사"
                        variant="secondary"
                        icon={<Link2 size={18} color={palette.primaryDeep} />}
                        disabled={isReshareActionPending}
                        singleLineLabel
                        style={styles.previewLinkButton}
                        labelStyle={styles.previewSecondaryActionLabel}
                        fullWidth
                        onPress={() => void handleCopyReshareLink()}
                      />
                    </View>
                  </View>
                )}
              </Card>
              ) : null}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(resultCard)} animationType="fade" onRequestClose={() => setResultCard(null)}>
        <View
          style={[styles.modalBackdrop, styles.resultModalBackdrop]}
          onTouchEnd={(event) => {
            if (event.target === event.currentTarget) {
              setResultCard(null);
            }
          }}>
          {resultCard ? (
            <Card style={styles.resultModal}>
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderCopy}>
                  <Text style={styles.resultKicker}>{resultCard.mode === 'DIRECT' ? '응답 결과' : '투표 결과'}</Text>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {resultCard.title}
                  </Text>
                  {shouldShowCardLocationDetail(resultCard) ? (
                    <Text style={styles.resultSubtitle}>{resultCard.location}</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setResultCard(null)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeButtonText}>닫기</Text>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.resultModalBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.resultModalBodyScroll}>
                <View style={styles.resultList}>
                  {resultCard.candidates.map((candidate) => {
                    const canConfirmCandidate = canConfirmResult && canConfirmCandidateSlot(candidate);

                    return (
                      <View key={candidate.id} style={styles.resultCandidate}>
                        <View style={styles.resultCandidateCopy}>
                          <Text style={styles.resultCandidateTime}>{candidate.label}</Text>
                          <Text style={styles.resultCandidateMeta}>{formatCandidateResponseSummary(candidate.summary)}</Text>
                        </View>
                        {canConfirmCandidate ? (
                          <ActionButton
                            label={isConfirming ? '확정 중' : '이 시간 확정'}
                            variant="primary"
                            disabled={isConfirming}
                            onPress={() => void handleConfirmCandidate(resultCard, candidate.id)}
                          />
                        ) : canConfirmResult ? (
                          <Text style={styles.resultCandidateConfirmHint}>가능 응답이 있어야 확정할 수 있어요.</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.respondentPanel}>
                  <View style={styles.respondentPanelHeader}>
                    <Text style={styles.respondentPanelTitle}>응답자 한마디</Text>
                    <Text style={styles.respondentPanelCount}>{resultCard.participants.length}명</Text>
                  </View>
                  {resultCard.participants.length > 0 ? (
                    <View style={styles.respondentRows}>
                      {resultCard.participants.map((participant) => {
                        const displayName = getParticipantDisplayName(participant);
                        const comment = getParticipantComment(participant);
                        const choice = participant.choice ?? 'UNANSWERED';

                        return (
                          <View key={participant.id} style={styles.respondentRow}>
                            <View style={[styles.respondentAvatar, { backgroundColor: participant.color }]}>
                              <Text style={styles.respondentAvatarText}>{participant.name}</Text>
                            </View>
                            <View style={styles.respondentCopy}>
                              <View style={styles.respondentNameRow}>
                                <Text style={styles.respondentName} numberOfLines={1}>
                                  {displayName}
                                </Text>
                                <View style={[styles.respondentChoiceBadge, getParticipantChoiceBadgeStyle(choice)]}>
                                  <Text style={styles.respondentChoiceText}>{participantChoiceLabels[choice]}</Text>
                                </View>
                              </View>
                              <Text
                                style={comment ? styles.respondentComment : styles.respondentCommentMuted}
                                numberOfLines={3}>
                                {comment || '한마디 없음'}
                              </Text>
                              {resultCard.mode === 'POLL' ? (
                                <View style={styles.respondentCandidateChoices}>
                                  {resultCard.candidates.map((candidate) => {
                                    const candidateChoice = getParticipantCandidateChoice(
                                      participant,
                                      candidate.id,
                                      resultCard.candidates.length,
                                    );

                                    return (
                                      <View
                                        key={`${participant.id}-${candidate.id}`}
                                        style={[
                                          styles.respondentCandidateChoice,
                                          getParticipantChoiceBadgeStyle(candidateChoice),
                                        ]}>
                                        <Text style={styles.respondentCandidateChoiceText}>
                                          {candidate.shortLabel} {participantChoiceLabels[candidateChoice]}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyRespondentText}>아직 응답이 없어요.</Text>
                  )}
                </View>
              </ScrollView>

              </Card>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(responseCard)} animationType="fade" onRequestClose={closeResponseModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.responseModalKeyboardAvoider}>
          <View
            style={[styles.modalBackdrop, styles.resultModalBackdrop]}
            onTouchEnd={(event) => {
              if (event.target === event.currentTarget) {
                closeResponseModal();
              }
            }}>
            {responseCard ? (
              <Card style={styles.resultModal}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultHeaderCopy}>
                    <Text style={styles.resultKicker}>{responseCard.requesterName ?? responseCard.hostName}님의 카드</Text>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {responseCard.title}
                    </Text>
                    {shouldShowCardLocationDetail(responseCard) ? (
                      <Text style={styles.resultSubtitle}>{responseCard.location}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={closeResponseModal}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                    <Text style={styles.closeButtonText}>닫기</Text>
                  </Pressable>
                </View>

                <ScrollView
                  ref={responseModalScrollRef}
                  contentContainerStyle={[
                    styles.resultModalBodyContent,
                    canRespond && styles.responseModalBodyContent,
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.resultModalBodyScroll}>
                  <View style={styles.resultList}>
                    {responseCard.candidates.map((candidate) => (
                      <View key={candidate.id} style={styles.responseCandidate}>
                        <View style={styles.resultCandidateCopy}>
                          <Text style={styles.resultCandidateTime}>{candidate.label}</Text>
                          <Text style={styles.resultCandidateMeta}>{formatCandidateResponseSummary(candidate.summary)}</Text>
                        </View>
                        {canRespond ? (
                          <View style={styles.responseChoiceRow}>
                            <ResponseChoiceButton
                              choice="YES"
                              label="가능"
                              selected={responseChoices[candidate.id] === 'YES'}
                              onPress={() => setCandidateChoice(candidate.id, 'YES')}
                            />
                            <ResponseChoiceButton
                              choice="NO"
                              label="어려움"
                              selected={responseChoices[candidate.id] === 'NO'}
                              onPress={() => setCandidateChoice(candidate.id, 'NO')}
                            />
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  {canRespond ? (
                    <View style={styles.responseCommentShell}>
                      <Text style={styles.responseCommentLabel}>한마디</Text>
                      <TextInput
                        accessibilityLabel="한마디"
                        maxLength={120}
                        multiline
                        onChangeText={setResponseComment}
                        onFocus={scrollResponseCommentIntoView}
                        placeholder="친구에게 전할 말을 적어주세요"
                        placeholderTextColor={palette.inkSoft}
                        style={styles.responseCommentInput}
                        value={responseComment}
                      />
                    </View>
                  ) : null}

                  {responseBadges.length > 0 ? <ResponseBadgeSummary badges={responseBadges} /> : null}
                  {responseFeedback ? (
                    <Text
                      style={[
                        styles.responseFeedback,
                        isResponseUnavailable && styles.responseUnavailableFeedback,
                      ]}>
                      {responseFeedback}
                    </Text>
                  ) : null}
                  {canRespond ? (
                    <ActionButton
                      label={isResponding ? '응답 중' : '응답 보내기'}
                      variant="primary"
                      disabled={isResponding || !hasAllResponseChoices}
                      fullWidth
                      onPress={() => void handleSubmitResponse()}
                    />
                  ) : null}
                </ScrollView>
              </Card>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

function ResponseChoiceButton({
  choice,
  label,
  selected,
  onPress,
}: {
  choice: SelectableResponseChoice;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.responseChoiceButton,
        choice === 'YES' ? styles.responseChoiceYesButton : styles.responseChoiceNoButton,
        selected && (choice === 'YES' ? styles.selectedResponseChoiceYesButton : styles.selectedResponseChoiceNoButton),
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.responseChoiceText, selected && styles.selectedResponseChoiceText]}>{label}</Text>
    </Pressable>
  );
}

function ResponseBadgeSummary({ badges }: { badges: ReturnType<typeof getReceivedCardResponseBadges> }) {
  return (
    <View style={styles.responseBadgeSummary}>
      <Text style={styles.responseBadgeSummaryLabel}>내 답장</Text>
      <View style={styles.responseBadgeList}>
        {badges.map((badge) => (
          <View key={badge.key} style={[styles.respondentChoiceBadge, getParticipantChoiceBadgeStyle(badge.choice)]}>
            <Text style={styles.respondentChoiceText} numberOfLines={1}>
              {badge.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: compactHero.minHeight,
    overflow: 'hidden',
    paddingHorizontal: compactHero.paddingHorizontal,
    paddingVertical: compactHero.paddingVertical,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    zIndex: 1,
  },
  headerShapePrimary: {
    backgroundColor: palette.primaryDeep,
    height: 44,
    position: 'absolute',
    right: -8,
    top: 22,
    transform: [{ rotate: '0deg' }],
    width: 142,
  },
  headerShapeMint: {
    backgroundColor: palette.surface,
    bottom: 18,
    height: 54,
    left: -18,
    position: 'absolute',
    transform: [{ rotate: '-6deg' }],
    width: 132,
  },
  headerShapeLime: {
    backgroundColor: palette.lilac,
    height: 92,
    position: 'absolute',
    right: 92,
    top: -34,
    transform: [{ rotate: '28deg' }],
    width: 54,
  },
  kicker: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: compactHero.titleSize,
    fontWeight: '900',
    lineHeight: compactHero.titleLineHeight,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: compactHero.subtitleSize,
    fontWeight: '700',
    lineHeight: compactHero.subtitleLineHeight,
  },
  noticeCard: {
    backgroundColor: palette.amberSoft,
    gap: spacing.xs,
  },
  noticeTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  noticeBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  responseActionStack: {
    gap: spacing.sm,
  },
  responseActionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  quickConfirmSection: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  quickConfirmHeader: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 62,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickConfirmHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  quickConfirmKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  quickConfirmTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  quickConfirmCount: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 34,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    textAlign: 'center',
  },
  quickConfirmToggle: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    minWidth: 50,
    paddingHorizontal: spacing.xs,
    paddingVertical: 7,
  },
  quickConfirmToggleText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  quickConfirmList: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  quickConfirmCard: {
    borderColor: palette.lineStrong,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  quickConfirmDirect: {
    backgroundColor: palette.amberSoft,
  },
  quickConfirmPoll: {
    backgroundColor: palette.aquaSoft,
  },
  quickConfirmTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  quickConfirmTopActions: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  quickConfirmModeBadge: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  quickConfirmModeText: {
    color: palette.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  quickConfirmCandidateMeta: {
    color: palette.inkMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  quickConfirmDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  quickConfirmBody: {
    gap: 4,
  },
  quickConfirmCardTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  quickConfirmSlot: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  quickConfirmSlotList: {
    gap: spacing.xs,
  },
  quickConfirmSlotOption: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectedQuickConfirmSlotOption: {
    backgroundColor: palette.limeSoft,
  },
  disabledQuickConfirmSlotOption: {
    backgroundColor: palette.paper,
    opacity: 0.62,
  },
  quickConfirmSlotOptionTime: {
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 0,
  },
  quickConfirmSlotOptionMeta: {
    color: palette.inkMuted,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
  },
  selectedQuickConfirmSlotOptionText: {
    color: palette.ink,
  },
  disabledQuickConfirmSlotOptionText: {
    color: palette.inkSoft,
  },
  quickConfirmLocation: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  quickConfirmStats: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickConfirmStat: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    gap: 2,
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  quickConfirmStatYes: {
    backgroundColor: palette.limeSoft,
  },
  quickConfirmStatNo: {
    backgroundColor: palette.coralSoft,
  },
  quickConfirmStatLabel: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  quickConfirmStatValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  quickConfirmActions: {
    gap: spacing.xs,
  },
  scopeTabs: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  scopeTab: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-start',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  selectedScopeTab: {
    backgroundColor: palette.primaryDeep,
  },
  scopeTabAccent: {
    backgroundColor: palette.line,
    borderRadius: radius.pill,
    height: 30,
    width: 5,
  },
  selectedScopeTabAccent: {
    backgroundColor: palette.lime,
  },
  scopeTabContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  scopeTabLabel: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
  },
  selectedScopeTabLabel: {
    color: palette.surface,
  },
  statusTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  statusTab: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 2,
    flexDirection: 'row',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  selectedStatusTab: {
    backgroundColor: palette.primary,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  statusTabLabel: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  selectedStatusTabLabel: {
    color: palette.onLight,
  },
  statusTabCount: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
    minWidth: 20,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
    textAlign: 'center',
  },
  selectedStatusTabCount: {
    backgroundColor: palette.surface,
    color: palette.primaryDeep,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: modalOverlay.backdrop,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalPressGuard: {
    alignItems: 'center',
    width: '100%',
  },
  modalScrollView: {
    alignSelf: 'stretch',
    flex: 1,
    maxHeight: '100%',
    width: '100%',
  },
  modalScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  resultModalBackdrop: {
    paddingBottom: spacing.md,
    paddingTop: spacing.xxl * 3,
  },
  reshareModal: {
    gap: spacing.md,
    maxWidth: 390,
    width: '100%',
  },
  deleteModal: {
    gap: spacing.md,
    maxWidth: 390,
    width: '100%',
  },
  deleteIcon: {
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
  deleteCopy: {
    gap: spacing.xs,
  },
  deleteBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scheduleDeleteActions: {
    gap: spacing.xs,
  },
  deleteActionButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  deleteSecondaryActionButton: {
    backgroundColor: palette.surface,
  },
  deleteDangerActionButton: {
    backgroundColor: palette.coralSoft,
  },
  disabledDeleteActionButton: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
  },
  deleteActionText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  deleteSecondaryActionText: {
    color: palette.ink,
  },
  deleteDangerActionText: {
    color: palette.primaryDeep,
  },
  disabledDeleteActionText: {
    color: palette.inkSoft,
  },
  reshareHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  reshareHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  iconCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    width: 48,
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
  friendPicker: {
    gap: spacing.sm,
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
  reshareFeedback: {
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
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
  resultModal: {
    gap: spacing.md,
    maxHeight: '82%',
    maxWidth: 520,
    overflow: 'hidden',
    width: '100%',
  },
  responseModalKeyboardAvoider: {
    flex: 1,
  },
  resultModalBodyScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  resultModalBodyContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  responseModalBodyContent: {
    paddingBottom: spacing.xxl * 2,
  },
  resultHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  resultHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  resultKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  resultTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  resultSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  resultList: {
    gap: spacing.sm,
  },
  respondentPanel: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  respondentPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  respondentPanelTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  respondentPanelCount: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  respondentRows: {
    gap: spacing.xs,
  },
  respondentRow: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  respondentAvatar: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  respondentAvatarText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  respondentCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  respondentNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  respondentName: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  respondentChoiceBadge: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  respondentChoiceYes: {
    backgroundColor: palette.mint,
  },
  respondentChoiceMaybe: {
    backgroundColor: palette.amber,
  },
  respondentChoiceNo: {
    backgroundColor: palette.coral,
  },
  respondentChoiceUnanswered: {
    backgroundColor: palette.paper,
  },
  respondentChoiceText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  respondentComment: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  respondentCommentMuted: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  respondentCandidateChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  respondentCandidateChoice: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  respondentCandidateChoiceText: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyRespondentText: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  resultCandidate: {
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  resultCandidateCopy: {
    gap: 3,
  },
  resultCandidateTime: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  resultCandidateMeta: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  resultCandidateConfirmHint: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.2,
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  responseCandidate: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  responseChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  responseChoiceButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexGrow: 1,
    minHeight: 38,
    minWidth: 76,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  responseChoiceYesButton: {
    backgroundColor: palette.mintSoft,
  },
  responseChoiceNoButton: {
    backgroundColor: palette.coralSoft,
  },
  selectedResponseChoiceYesButton: {
    backgroundColor: palette.mint,
  },
  selectedResponseChoiceNoButton: {
    backgroundColor: palette.danger,
  },
  responseChoiceText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedResponseChoiceText: {
    color: palette.onLight,
  },
  responseCommentShell: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  responseCommentLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  responseCommentInput: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
    minHeight: 58,
    padding: 0,
    textAlignVertical: 'top',
  },
  responseBadgeSummary: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  responseBadgeSummaryLabel: {
    color: palette.primaryDeep,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '900',
  },
  responseBadgeList: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    minWidth: 0,
  },
  responseFeedback: {
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    padding: spacing.sm,
  },
  responseUnavailableFeedback: {
    backgroundColor: palette.coralSoft,
  },
});
