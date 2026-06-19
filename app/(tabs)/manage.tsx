import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Link2, Send, UsersRound, X } from 'lucide-react-native';
import { Modal, Share, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DraftPreviewCard, ManagedCardsSection } from '@/components/card-menu';
import { ActionButton, AppScreen, Card } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  buildShareMessage,
  canDeleteManagedCard,
  formatCandidateResponseSummary,
  getManagedCardInboxTab,
  getManagedStatusGroup,
  getShareUrlForClipboard,
  type ManagedCardActionKind,
  type ManagedCardInboxTab,
  type ManagedCardScope,
  type ManagedStatusGroup,
} from '@/lib/cardMenu';
import { getConfirmedCardSchedulePath, getManagedCardDeleteConfirmation } from '@/lib/managedCards';
import {
  UNSHAREABLE_PREVIEW_CARD_MESSAGE,
  isShareablePublicCard,
} from '@/lib/previewActions';
import { getPreviewFriendOptions, getPreviewRecipientProfileIds, selectOnePreviewFriend } from '@/lib/previewFriends';
import type { Participant, PromiseCard, ReceivedCardResponseChoice, ResponseChoice } from '@/types/promise';

type SelectableResponseChoice = Exclude<ReceivedCardResponseChoice, 'MAYBE'>;

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

const scopeTabs: Array<{ key: ManagedCardScope; label: string }> = [
  { key: 'SENT', label: '보낸 카드' },
  { key: 'RECEIVED', label: '받은 카드' },
];

const sentTabs: ManagedCardInboxTab[] = ['SENT_NO_RESPONSE', 'SENT_HAS_RESPONSE', 'SENT_CONFIRMED', 'SENT_PAST'];
const receivedTabs: ManagedCardInboxTab[] = [
  'RECEIVED_NEEDS_REPLY',
  'RECEIVED_REPLIED',
  'RECEIVED_CONFIRMED',
  'RECEIVED_PAST',
];

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

const legacyGroupTabs: Record<ManagedStatusGroup, ManagedCardInboxTab> = {
  PENDING: 'SENT_NO_RESPONSE',
  VOTING: 'SENT_NO_RESPONSE',
  DECLINED: 'SENT_HAS_RESPONSE',
  CONFIRMED: 'SENT_CONFIRMED',
  PAST: 'SENT_PAST',
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
  const { group, scroll } = useLocalSearchParams<{ group?: string | string[]; scroll?: string | string[] }>();
  const {
    profile,
    managedCards,
    isLoading,
    error,
    removeManagedCard,
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
  const [reshareCard, setReshareCard] = useState<PromiseCard | null>(null);
  const [deleteConfirmCard, setDeleteConfirmCard] = useState<PromiseCard | null>(null);
  const [isReshareFriendPickerOpen, setIsReshareFriendPickerOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isReshareActionPending, setIsReshareActionPending] = useState(false);
  const [reshareFeedback, setReshareFeedback] = useState<string | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [responseChoices, setResponseChoices] = useState<Record<string, SelectableResponseChoice>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const now = useMemo(() => new Date(), [managedCards]);
  const currentProfile = useMemo(
    () => (profile ? { id: profile.id, displayName: profile.displayName } : undefined),
    [profile],
  );
  const { options: previewFriendOptions, isUsingTestFriends } = useMemo(
    () => getPreviewFriendOptions(friends),
    [friends],
  );
  useFocusEffect(
    useCallback(() => {
      void reloadManagedCards();
    }, [reloadManagedCards]),
  );
  useEffect(() => {
    const routeGroup = Array.isArray(group) ? group[0] : group;

    if (routeGroup && routeGroup in legacyGroupTabs) {
      const nextTab = legacyGroupTabs[routeGroup as ManagedStatusGroup];
      setActiveScope(getScopeForTab(nextTab));
      setActiveTab(nextTab);
    }
  }, [group]);
  const activeTabKeys = tabsByScope[activeScope];
  const tabCounts = useMemo(
    () =>
      activeTabKeys.reduce(
        (counts, tab) => ({
          ...counts,
          [tab]: managedCards.filter((card) => getManagedCardInboxTab(card, now, currentProfile) === tab).length,
        }),
        {} as Partial<Record<ManagedCardInboxTab, number>>,
      ),
    [activeTabKeys, currentProfile, managedCards, now],
  );
  const visibleManagedCards = useMemo(
    () => managedCards.filter((card) => getManagedCardInboxTab(card, now, currentProfile) === activeTab),
    [activeTab, currentProfile, managedCards, now],
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
    if (!canDeleteManagedCard(card, now)) {
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
      await removeManagedCard(deleteConfirmCard.id);
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

  function toggleReshareFriendSelection(friendId: string) {
    setSelectedFriendIds((currentIds) => selectOnePreviewFriend(currentIds, friendId));
  }

  async function handleConfirmReshareFriendSend() {
    if (!reshareCard || selectedFriendIds.length === 0) {
      return;
    }

    if (!isShareablePublicCard(reshareCard)) {
      setReshareFeedback(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
      return;
    }

    const recipientProfileIds = getPreviewRecipientProfileIds(friends, selectedFriendIds);

    setIsReshareActionPending(true);

    try {
      if (!isUsingTestFriends) {
        await sendManagedCardToRecipients(reshareCard, recipientProfileIds);
      }

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
      await confirmManagedCard(card.id, candidateId);
      setResultCard(null);
      selectTab('SENT_CONFIRMED');
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
      return;
    }

    setIsResponding(true);

    try {
      const respondedCard = await respondToReceivedCard(responseCard.id, responses);
      selectTab(getManagedCardInboxTab(respondedCard, now, currentProfile));
      setResponseCard(null);
    } catch {
      return;
    } finally {
      setIsResponding(false);
    }
  }

  function setCandidateChoice(candidateId: string, choice: SelectableResponseChoice) {
    setResponseChoices((currentChoices) => ({
      ...currentChoices,
      [candidateId]: choice,
    }));
  }

  const responseGroup = responseCard ? getManagedStatusGroup(responseCard, now) : null;
  const canRespond = responseCard ? responseGroup === 'PENDING' || responseGroup === 'VOTING' : false;
  const hasAllResponseChoices = responseCard
    ? responseCard.candidates.every((candidate) => Boolean(responseChoices[candidate.id]))
    : false;
  const resultGroup = resultCard ? getManagedStatusGroup(resultCard, now) : null;
  const canConfirmResult = resultGroup === 'PENDING' || resultGroup === 'VOTING';
  const deleteConfirmation = deleteConfirmCard ? getManagedCardDeleteConfirmation(deleteConfirmCard) : null;
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

      <ManagedCardsSection
        cards={visibleManagedCards}
        activeTab={activeTab}
        currentProfile={currentProfile}
        emptyTitle={activeEmptyCopy.title}
        emptyBody={activeEmptyCopy.body}
        onAction={(card, action) => void handleManagedAction(card, action)}
        onDelete={(card) => void handleDeleteCard(card)}
      />

      <Modal
        transparent
        visible={deleteConfirmation !== null}
        animationType="fade"
        onRequestClose={closeDeleteConfirmModal}>
        <View style={styles.modalBackdrop}>
          {deleteConfirmation ? (
            <Card style={styles.deleteModal}>
              <View style={styles.deleteIcon}>
                <AlertTriangle size={24} color={palette.danger} />
              </View>
              <View style={styles.deleteCopy}>
                <Text style={styles.resultTitle}>{deleteConfirmation.title}</Text>
                <Text style={styles.deleteBody}>{deleteConfirmation.body}</Text>
              </View>
              <View style={styles.deleteActions}>
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
              </View>
            </Card>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(reshareCard)} animationType="fade" onRequestClose={closeReshareModal}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
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
                                  {selected ? '선택' : '대기'}
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
                        label={isReshareActionPending ? '보내는 중' : '보내기'}
                        disabled={isReshareActionPending || selectedFriendIds.length === 0}
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
                        fullWidth
                        onPress={openReshareFriendPicker}
                      />
                      <ActionButton
                        label="링크 복사"
                        variant="secondary"
                        icon={<Link2 size={18} color={palette.primaryDeep} />}
                        disabled={isReshareActionPending}
                        fullWidth
                        onPress={() => void handleCopyReshareLink()}
                      />
                    </View>
                  </View>
                )}
              </Card>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(resultCard)} animationType="fade" onRequestClose={() => setResultCard(null)}>
        <View style={styles.modalBackdrop}>
          {resultCard ? (
            <Card style={styles.resultModal}>
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderCopy}>
                  <Text style={styles.resultKicker}>{resultCard.mode === 'DIRECT' ? '응답 결과' : '투표 결과'}</Text>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {resultCard.title}
                  </Text>
                  <Text style={styles.resultSubtitle}>{resultCard.location}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setResultCard(null)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeButtonText}>닫기</Text>
                </Pressable>
              </View>

              <View style={styles.resultList}>
                {resultCard.candidates.map((candidate) => {
                  const canConfirmCandidate = canConfirmResult && candidate.summary.yes > 0;

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
                  <ScrollView
                    contentContainerStyle={styles.respondentRows}
                    showsVerticalScrollIndicator={false}
                    style={styles.respondentRowsScroll}>
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
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyRespondentText}>아직 응답이 없어요.</Text>
                )}
              </View>

            </Card>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(responseCard)} animationType="fade" onRequestClose={() => setResponseCard(null)}>
        <View style={styles.modalBackdrop}>
          {responseCard ? (
            <Card style={styles.resultModal}>
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderCopy}>
                  <Text style={styles.resultKicker}>{responseCard.requesterName ?? responseCard.hostName}님의 카드</Text>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {responseCard.title}
                  </Text>
                  <Text style={styles.resultSubtitle}>{responseCard.location}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setResponseCard(null)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeButtonText}>닫기</Text>
                </Pressable>
              </View>

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
                          label="가능"
                          selected={responseChoices[candidate.id] === 'YES'}
                          onPress={() => setCandidateChoice(candidate.id, 'YES')}
                        />
                        <ResponseChoiceButton
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
                <ActionButton
                  label={isResponding ? '응답 중' : '응답 보내기'}
                  variant="primary"
                  disabled={isResponding || !hasAllResponseChoices}
                  fullWidth
                  onPress={() => void handleSubmitResponse()}
                />
              ) : (
                <Text style={styles.responseClosedText}>지난 카드는 내용을 확인만 할 수 있어요.</Text>
              )}
            </Card>
          ) : null}
        </View>
      </Modal>
    </AppScreen>
  );
}

function ResponseChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.responseChoiceButton, selected && styles.selectedResponseChoiceButton, pressed && styles.pressed]}>
      <Text style={[styles.responseChoiceText, selected && styles.selectedResponseChoiceText]}>{label}</Text>
    </Pressable>
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
    backgroundColor: 'rgba(40, 32, 24, 0.32)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalScrollView: {
    width: '100%',
  },
  modalScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
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
    maxWidth: 520,
    width: '100%',
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
  respondentRowsScroll: {
    maxHeight: 220,
  },
  respondentRows: {
    gap: spacing.xs,
    paddingBottom: 2,
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
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexGrow: 1,
    minHeight: 38,
    minWidth: 76,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selectedResponseChoiceButton: {
    backgroundColor: palette.primary,
  },
  responseChoiceText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedResponseChoiceText: {
    color: palette.onLight,
  },
  responseClosedText: {
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    padding: spacing.sm,
  },
});
