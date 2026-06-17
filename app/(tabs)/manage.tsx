import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Share, Pressable, StyleSheet, Text, View } from 'react-native';

import { ManagedCardsSection } from '@/components/card-menu';
import { ActionButton, AppScreen, Card, StorageModeNotice } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useManagedCards } from '@/hooks/useManagedCards';
import {
  buildShareMessage,
  getManagedStatusGroup,
  type ManagedCardActionKind,
  type ManagedStatusGroup,
} from '@/lib/cardMenu';
import type { PromiseCard } from '@/types/promise';
import type { ReceivedCardResponseChoice } from '@/types/promise';

const statusTabs: Array<{ key: ManagedStatusGroup; label: string }> = [
  { key: 'PENDING', label: '응답 대기' },
  { key: 'VOTING', label: '투표 중' },
  { key: 'CONFIRMED', label: '확정됨' },
  { key: 'PAST', label: '지난 약속' },
];

export default function ManageCardsScreen() {
  const router = useRouter();
  const { managedCards, isLoading, persisted, error, removeManagedCard, confirmManagedCard, respondToReceivedCard } = useManagedCards();
  const [activeGroup, setActiveGroup] = useState<ManagedStatusGroup>('PENDING');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resultCard, setResultCard] = useState<PromiseCard | null>(null);
  const [responseCard, setResponseCard] = useState<PromiseCard | null>(null);
  const [responseChoices, setResponseChoices] = useState<Record<string, ReceivedCardResponseChoice>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const now = useMemo(() => new Date(), [managedCards]);
  const statusCounts = useMemo(
    () =>
      statusTabs.reduce(
        (counts, tab) => ({
          ...counts,
          [tab.key]: managedCards.filter((card) => getManagedStatusGroup(card, now) === tab.key).length,
        }),
        {} as Record<ManagedStatusGroup, number>,
      ),
    [managedCards, now],
  );

  async function handleManagedAction(card: PromiseCard, action: ManagedCardActionKind) {
    if (action === 'OPEN_RECEIVED') {
      setResponseCard(card);
      setResponseChoices({});
      return;
    }

    if (action === 'RESHARE') {
      try {
        const result = await Share.share({ message: buildShareMessage(card) });
        if (result.action === Share.dismissedAction) {
          setFeedback('공유가 취소됐어요.');
          return;
        }
        setFeedback('공유를 다시 열었어요.');
      } catch {
        setFeedback('공유를 열 수 없어요. 다시 시도해 주세요.');
      }
      return;
    }

    if (action === 'SCHEDULE') {
      router.push('/schedule');
      return;
    }

    if (action === 'RESULTS') {
      setResultCard(card);
      return;
    }

    router.push('/create');
  }

  async function handleDeleteCard(card: PromiseCard) {
    if (getManagedStatusGroup(card) !== 'PAST') {
      return;
    }

    try {
      await removeManagedCard(card.id);
      setFeedback('카드를 삭제했어요.');
    } catch {
      setFeedback('카드를 삭제하지 못했어요. 다시 시도해 주세요.');
    }
  }

  async function handleConfirmCandidate(card: PromiseCard, candidateId: string) {
    setIsConfirming(true);

    try {
      await confirmManagedCard(card.id, candidateId);
      setFeedback('선택한 시간으로 약속을 확정했어요.');
      setResultCard(null);
      setActiveGroup('CONFIRMED');
    } catch {
      setFeedback('약속을 확정하지 못했어요. 다시 시도해 주세요.');
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
      .filter((response): response is { candidateId: string; choice: ReceivedCardResponseChoice } => Boolean(response.choice));

    if (responses.length !== responseCard.candidates.length) {
      setFeedback('모든 후보 시간에 응답해 주세요.');
      return;
    }

    setIsResponding(true);

    try {
      await respondToReceivedCard(responseCard.id, responses);
      setFeedback('응답을 보냈어요.');
      setResponseCard(null);
    } catch {
      setFeedback('응답을 보내지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsResponding(false);
    }
  }

  function setCandidateChoice(candidateId: string, choice: ReceivedCardResponseChoice) {
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

  return (
    <AppScreen>
      <View style={styles.header}>
        <View style={styles.headerShapePrimary} />
        <View style={styles.headerShapeMint} />
        <View style={styles.headerShapeLime} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>언제볼래</Text>
          <Text style={styles.title}>관리함</Text>
          <Text style={styles.subtitle}>응답 대기, 투표 중, 확정된 약속을 상태별로 확인해요.</Text>
        </View>
      </View>

      <StorageModeNotice persisted={persisted} surface="cards" />

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {error ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>카드를 불러오지 못했어요</Text>
          <Text style={styles.noticeBody}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.statusTabs}>
        {statusTabs.map((tab) => {
          const selected = activeGroup === tab.key;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActiveGroup(tab.key)}
              style={({ pressed }) => [styles.statusTab, selected && styles.selectedStatusTab, pressed && styles.pressed]}>
              <Text style={[styles.statusTabLabel, selected && styles.selectedStatusTabLabel]}>{tab.label}</Text>
              <Text style={[styles.statusTabCount, selected && styles.selectedStatusTabCount]}>
                {isLoading ? '-' : statusCounts[tab.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ManagedCardsSection
        cards={managedCards}
        activeGroup={activeGroup}
        onAction={(card, action) => void handleManagedAction(card, action)}
        onDelete={activeGroup === 'PAST' ? (card) => void handleDeleteCard(card) : undefined}
      />

      <Modal transparent visible={Boolean(resultCard)} animationType="fade" onRequestClose={() => setResultCard(null)}>
        <View style={styles.modalBackdrop}>
          {resultCard ? (
            <Card style={styles.resultModal}>
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderCopy}>
                  <Text style={styles.resultKicker}>투표 결과</Text>
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
                {resultCard.candidates.map((candidate) => (
                  <View key={candidate.id} style={styles.resultCandidate}>
                    <View style={styles.resultCandidateCopy}>
                      <Text style={styles.resultCandidateTime}>{candidate.label}</Text>
                      <Text style={styles.resultCandidateMeta}>
                        가능 {candidate.summary.yes} · 애매 {candidate.summary.maybe} · 어려움 {candidate.summary.no}
                      </Text>
                    </View>
                    <ActionButton
                      label={isConfirming ? '확정 중' : '이 시간 확정'}
                      variant="primary"
                      disabled={isConfirming}
                      onPress={() => void handleConfirmCandidate(resultCard, candidate.id)}
                    />
                  </View>
                ))}
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
                      <Text style={styles.resultCandidateMeta}>
                        가능 {candidate.summary.yes} · 애매 {candidate.summary.maybe} · 어려움 {candidate.summary.no}
                      </Text>
                    </View>
                    {canRespond ? (
                      <View style={styles.responseChoiceRow}>
                        <ResponseChoiceButton
                          label="가능"
                          selected={responseChoices[candidate.id] === 'YES'}
                          onPress={() => setCandidateChoice(candidate.id, 'YES')}
                        />
                        <ResponseChoiceButton
                          label="애매"
                          selected={responseChoices[candidate.id] === 'MAYBE'}
                          onPress={() => setCandidateChoice(candidate.id, 'MAYBE')}
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
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusTab: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 126,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '900',
    minWidth: 28,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
