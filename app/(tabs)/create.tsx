import { useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Link2, MapPin, MessageCircle, Send } from 'lucide-react-native';
import { Share, StyleSheet, Text, View } from 'react-native';

import {
  CandidateTimeFields,
  DraftInput,
  DraftPreviewCard,
  ManagedCardsSection,
  ModeSelector,
} from '@/components/card-menu';
import { ActionButton, AppScreen, Card, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { usePromiseData } from '@/hooks/usePromiseData';
import {
  buildShareMessage,
  compactDraftTimes,
  getGeneratedCardTitle,
  getModeLabel,
  validateCardDraft,
  type CardDraft,
  type ManagedCardActionKind,
} from '@/lib/cardMenu';
import type { AppointmentMode, PromiseCard } from '@/types/promise';

const INITIAL_DRAFT: CardDraft = {
  mode: 'DIRECT',
  times: [''],
  location: '',
  message: '',
};

export default function CreateCardScreen() {
  const { recentCards } = usePromiseData();
  const [mode, setMode] = useState<AppointmentMode>(INITIAL_DRAFT.mode);
  const [times, setTimes] = useState<string[]>(INITIAL_DRAFT.times);
  const [location, setLocation] = useState(INITIAL_DRAFT.location);
  const [message, setMessage] = useState(INITIAL_DRAFT.message);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<PromiseCard | null>(null);
  const [createdCards, setCreatedCards] = useState<PromiseCard[]>([]);

  const draft = useMemo<CardDraft>(
    () => ({
      mode,
      times,
      location,
      message,
    }),
    [location, message, mode, times],
  );

  const managedCards = useMemo(() => [...createdCards, ...recentCards], [createdCards, recentCards]);

  function handleModeChange(nextMode: AppointmentMode) {
    setMode(nextMode);
    setFeedback(null);
    setPreviewCard(null);

    if (nextMode === 'POLL') {
      setTimes((currentTimes) => {
        const nextTimes = currentTimes.length > 0 ? [...currentTimes] : [''];
        return nextTimes.length >= 2 ? nextTimes : [...nextTimes, ''];
      });
      return;
    }

    setTimes((currentTimes) => [currentTimes[0] ?? '']);
  }

  function handleChangeTime(index: number, value: string) {
    setTimes((currentTimes) => currentTimes.map((time, timeIndex) => (timeIndex === index ? value : time)));
    setPreviewCard(null);
    setFeedback(null);
  }

  function handleAddTime() {
    setMode('POLL');
    setTimes((currentTimes) => [...currentTimes, '']);
    setPreviewCard(null);
    setFeedback(null);
  }

  function handleRemoveTime(index: number) {
    setTimes((currentTimes) => {
      const nextTimes = currentTimes.filter((_, timeIndex) => timeIndex !== index);

      if (nextTimes.length <= 1) {
        setMode('DIRECT');
        setFeedback('후보 시간이 하나라 이때볼래?로 바뀌었어요.');
        return [nextTimes[0] ?? ''];
      }

      setFeedback(null);
      return nextTimes;
    });
    setPreviewCard(null);
  }

  function handleCreateCard() {
    const validation = validateCardDraft(draft);

    if (!validation.valid) {
      setFeedback(validation.error);
      setPreviewCard(null);
      return;
    }

    setPreviewCard(buildPreviewCard(draft));
    setFeedback(null);
  }

  async function publishPreview(kind: 'share' | 'copy') {
    if (!previewCard) {
      return;
    }

    const shareMessage = buildShareMessage(previewCard);

    if (kind === 'share') {
      await Share.share({ message: shareMessage });
      setFeedback('카톡 공유를 열었어요.');
    } else {
      await Clipboard.setStringAsync(shareMessage);
      setFeedback('공유 링크를 복사했어요.');
    }

    setCreatedCards((currentCards) => [
      {
        ...previewCard,
        status: previewCard.mode === 'DIRECT' ? 'PENDING' : 'VOTING',
      },
      ...currentCards,
    ]);
  }

  async function handleManagedAction(card: PromiseCard, action: ManagedCardActionKind) {
    if (action === 'RESHARE') {
      await Share.share({ message: buildShareMessage(card) });
      setFeedback('공유를 다시 열었어요.');
      return;
    }

    if (action === 'RECREATE') {
      setMode(card.mode);
      setTimes(card.mode === 'DIRECT' ? [card.candidates[0]?.label ?? ''] : card.candidates.map((candidate) => candidate.label));
      setLocation(card.location);
      setMessage(card.message);
      setIsMessageOpen(card.message.trim().length > 0);
      setPreviewCard(null);
      setFeedback('이전 카드 내용으로 다시 만들 수 있어요.');
      return;
    }

    if (action === 'RESULTS') {
      setFeedback('후보 시간별 응답을 확인하는 흐름으로 연결됩니다.');
      return;
    }

    setFeedback('확정된 시간과 장소를 확인하는 흐름으로 연결됩니다.');
  }

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.kicker}>언제볼래</Text>
        <Text style={styles.title}>카드 만들기</Text>
        <Text style={styles.subtitle}>시간과 장소만 정하면 바로 공유할 수 있어요.</Text>
      </View>

      <ModeSelector value={mode} onChange={handleModeChange} />

      <Card style={styles.formCard}>
        <CandidateTimeFields
          mode={mode}
          times={times}
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

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {previewCard ? (
        <View style={styles.sectionStack}>
          <SectionHeader title="공유 전 미리보기" action={getModeLabel(previewCard.mode)} />
          <DraftPreviewCard card={previewCard} />
          <View style={styles.actionRow}>
            <ActionButton
              label="카톡 공유"
              variant="kakao"
              icon={<Send size={18} color={palette.onLight} />}
              fullWidth
              onPress={() => {
                void publishPreview('share');
              }}
            />
            <ActionButton
              label="링크 복사"
              variant="secondary"
              icon={<Link2 size={18} color={palette.primaryDeep} />}
              fullWidth
              onPress={() => {
                void publishPreview('copy');
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.sectionStack}>
        <SectionHeader title="내 카드 관리함" />
        <ManagedCardsSection cards={managedCards} onAction={handleManagedAction} />
      </View>
    </AppScreen>
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
      startsAt: createdAt,
      endsAt: createdAt,
      label: time,
      shortLabel: time,
      summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
    })),
    participants: [],
  };
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
    padding: spacing.lg,
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
  sectionStack: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
