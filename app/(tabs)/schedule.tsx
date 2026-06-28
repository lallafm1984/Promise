import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react-native';

import { AppScreen, Card, SectionHeader } from '@/components/ui';
import { compactHero, modalOverlay, palette, radius, spacing } from '@/constants/theme';
import { useManagedCards } from '@/hooks/useManagedCards';
import { usePromiseData } from '@/hooks/usePromiseData';
import { useSchedulePlanner } from '@/hooks/useSchedulePlanner';
import { requestInterstitialAd } from '@/lib/interstitialAds';
import {
  buildShareMessage,
  buildScheduleItemFromConfirmedCard,
  formatDraftDateTimeLabel,
  formatDraftDateTimeShortLabel,
  getCandidateEndsAt,
  getParticipantChoiceForSelectedSlot,
  getResponseChoiceLabel,
  getScheduleParticipantsForViewer,
  mergeDraftDateTime,
} from '@/lib/cardMenu';
import { filterScheduleItemsByRemovedCardIds, getCardScheduleDeleteConfirmation } from '@/lib/managedCards';
import { getTodosForDate } from '@/lib/schedulePlannerState';
import {
  compareScheduleItems,
  formatMonthTitle,
  formatSelectedDate,
  getScheduleCounts,
  getScheduleDate,
  getVisibleCalendarRows,
  getWeekCells,
  parseDateKey,
  startOfDay,
  toDateKey,
} from '@/lib/scheduleCalendar';
import type {
  DisplayScheduleItem,
  PromiseCard,
  RecurringTodoItem,
  ResponseChoice,
  ScheduleColorKey,
  TodoItem,
  WeekdayIndex,
} from '@/types/promise';

type ScheduleMode = 'SCHEDULE' | 'TODO';
type ScheduleParticipant = NonNullable<DisplayScheduleItem['participants']>[number];
type ScheduleDialogActionVariant = 'primary' | 'secondary' | 'danger';

interface ScheduleDialogAction {
  label: string;
  variant?: ScheduleDialogActionVariant;
  onPress: () => void;
}

interface ScheduleDialogState {
  title: string;
  body: string;
  tone?: 'notice' | 'danger';
  actions: ScheduleDialogAction[];
}

type ScheduleColorOption = {
  key: ScheduleColorKey;
  label: string;
  soft: string;
  accent: string;
};

const colorOptions: ScheduleColorOption[] = [
  { key: 'coral', label: '코랄', soft: palette.coralSoft, accent: palette.coral },
  { key: 'mint', label: '민트', soft: palette.mintSoft, accent: palette.mint },
  { key: 'lime', label: '라임', soft: palette.limeSoft, accent: palette.lime },
  { key: 'sky', label: '스카이', soft: palette.skySoft, accent: palette.sky },
  { key: 'amber', label: '앰버', soft: palette.amberSoft, accent: palette.amber },
];
const completedTodoColorByKey: Record<ScheduleColorKey, string> = {
  coral: '#F5C0A5',
  mint: '#C9DDC8',
  lime: '#DBE8A7',
  sky: '#C8DEE2',
  amber: '#FFD091',
};
const scheduleColorOptions = colorOptions.filter((option) => option.key !== 'coral');

function getColorOption(options: ScheduleColorOption[], key: ScheduleColorKey = 'sky') {
  return options.find((option) => option.key === key) ?? options.find((option) => option.key === 'sky') ?? colorOptions[0];
}

function getScheduleColor(key: ScheduleColorKey = 'sky') {
  return getColorOption(colorOptions, key);
}

function getCompletedTodoBackgroundColor(key: ScheduleColorKey = 'sky') {
  return completedTodoColorByKey[key] ?? completedTodoColorByKey.sky;
}

function getManualScheduleColor(key: ScheduleColorKey = 'sky') {
  return getColorOption(scheduleColorOptions, key);
}

function normalizeManualScheduleColorKey(key: ScheduleColorKey = 'sky') {
  return getManualScheduleColor(key).key;
}

function getScheduleParticipantDisplayName(participant: ScheduleParticipant) {
  return participant.displayName?.trim() || participant.name;
}

function getScheduleParticipantComment(participant: ScheduleParticipant) {
  return participant.comment?.trim();
}

function getScheduleParticipantChoice(item: DisplayScheduleItem, participant: ScheduleParticipant): ResponseChoice {
  if (item.candidates && item.candidates.length > 0) {
    return getParticipantChoiceForSelectedSlot(
      { candidates: item.candidates, selectedSlotId: item.selectedSlotId },
      participant,
    );
  }

  return participant.choice ?? 'UNANSWERED';
}

function getScheduleParticipantChoiceBadgeStyle(choice: ResponseChoice) {
  switch (choice) {
    case 'YES':
      return styles.cardResponseChoiceYes;
    case 'MAYBE':
      return styles.cardResponseChoiceMaybe;
    case 'NO':
      return styles.cardResponseChoiceNo;
    case 'UNANSWERED':
      return styles.cardResponseChoiceUnanswered;
  }
}

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
const recurringWeekdayOptions: Array<{ value: WeekdayIndex; label: string }> = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];
const defaultRecurringWeekdays: WeekdayIndex[] = [1, 2, 3, 4, 5];
const TODO_WEEK_DRAG_LIMIT = 60;
const TODO_WEEK_RELEASE_THRESHOLD = 34;
const TODO_WEEK_SLIDE_DISTANCE = 430;

function formatTodoDayTitle(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabels[date.getDay()]}`;
}

function createScheduleTimeForDate(date: Date) {
  const nextDate = startOfDay(date);
  nextDate.setHours(12, 0, 0, 0);
  return nextDate.toISOString();
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function ScheduleScreen() {
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  const { scheduleItems, reload: reloadPromiseData } = usePromiseData();
  const { profile, managedCards, removedCardIds, requestManagedCardChange, removeManagedCard } = useManagedCards();
  const {
    manualScheduleItems,
    todos,
    recurringTodos,
    recurringTodoCompletions,
    isLoading: plannerLoading,
    isMutating,
    createManualScheduleItem,
    updateManualScheduleItem,
    deleteManualScheduleItem,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo: saveTodoToggle,
    createRecurringTodo,
    deleteRecurringTodo,
    toggleRecurringTodoCompletion,
  } = useSchedulePlanner();
  const [activeMode, setActiveMode] = useState<ScheduleMode>('SCHEDULE');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [composerMode, setComposerMode] = useState<ScheduleMode | null>(null);
  const [editingScheduleItem, setEditingScheduleItem] = useState<DisplayScheduleItem | null>(null);
  const [editingCardScheduleItem, setEditingCardScheduleItem] = useState<DisplayScheduleItem | null>(null);
  const [editingTodoItem, setEditingTodoItem] = useState<TodoItem | null>(null);
  const [cardActionItem, setCardActionItem] = useState<DisplayScheduleItem | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<ScheduleDialogState | null>(null);
  const [isCardActionPending, setIsCardActionPending] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleColor, setScheduleColor] = useState<ScheduleColorKey>('sky');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDetail, setTodoDetail] = useState('');
  const [todoColor, setTodoColor] = useState<ScheduleColorKey>('coral');
  const [isRecurringTodoModalOpen, setIsRecurringTodoModalOpen] = useState(false);
  const [isRecurringTodoFormOpen, setIsRecurringTodoFormOpen] = useState(false);
  const [recurringTodoTitle, setRecurringTodoTitle] = useState('');
  const [recurringTodoDetail, setRecurringTodoDetail] = useState('');
  const [recurringTodoColor, setRecurringTodoColor] = useState<ScheduleColorKey>('mint');
  const [recurringTodoWeekdays, setRecurringTodoWeekdays] = useState<WeekdayIndex[]>(defaultRecurringWeekdays);
  const [isWeekTransitioning, setIsWeekTransitioning] = useState(false);
  const calendarMotion = useRef(new Animated.Value(1)).current;
  const contentMotion = useRef(new Animated.Value(1)).current;
  const weekDragX = useRef(new Animated.Value(0)).current;
  const selectedDateKey = toDateKey(selectedDate);
  const visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const todoWeekCells = useMemo(() => getWeekCells(selectedDate), [selectedDate]);
  const cardScheduleItems = useMemo<DisplayScheduleItem[]>(
    () => {
      const currentProfile = profile ? { id: profile.id, displayName: profile.displayName } : undefined;
      const serverCardScheduleItems = filterScheduleItemsByRemovedCardIds(scheduleItems, removedCardIds).map((item) => ({
        ...item,
        participants: getScheduleParticipantsForViewer(item.participants ?? [], currentProfile),
      }));
      const serverCardIds = new Set(serverCardScheduleItems.map((item) => item.cardId));
      const localCardScheduleItems = managedCards
        .map((card) => buildScheduleItemFromConfirmedCard(card, currentProfile))
        .filter((item): item is NonNullable<ReturnType<typeof buildScheduleItemFromConfirmedCard>> => Boolean(item))
        .filter((item) => !serverCardIds.has(item.cardId));

      return [...serverCardScheduleItems, ...localCardScheduleItems].map((item) => ({ ...item, source: 'CARD' }));
    },
    [managedCards, profile, removedCardIds, scheduleItems],
  );
  const allScheduleItems = useMemo<DisplayScheduleItem[]>(
    () => [...manualScheduleItems, ...cardScheduleItems],
    [cardScheduleItems, manualScheduleItems],
  );
  const scheduleCounts = useMemo(
    () => getScheduleCounts(allScheduleItems, visibleMonth.getFullYear()),
    [allScheduleItems, visibleMonth],
  );
  const todoCounts = useMemo(
    () =>
      todoWeekCells.reduce<Record<string, number>>((counts, cell) => {
        return {
          ...counts,
          [cell.key]: getTodosForDate(todos, recurringTodos, recurringTodoCompletions, cell.key).length,
        };
      }, {}),
    [recurringTodoCompletions, recurringTodos, todoWeekCells, todos],
  );
  const calendarRows = useMemo(
    () => getVisibleCalendarRows(visibleMonth, selectedDate, true),
    [selectedDate, visibleMonth],
  );
  const selectedItems = useMemo(
    () =>
      allScheduleItems
        .filter((item) => toDateKey(getScheduleDate(item, visibleMonth.getFullYear())) === selectedDateKey)
        .sort(compareScheduleItems),
    [allScheduleItems, selectedDateKey, visibleMonth],
  );
  const selectedTodos = useMemo(
    () => getTodosForDate(todos, recurringTodos, recurringTodoCompletions, selectedDateKey),
    [recurringTodoCompletions, recurringTodos, selectedDateKey, todos],
  );
  const isScheduleMutating = isMutating || isCardActionPending;
  const completedTodoCount = selectedTodos.filter((todo) => todo.done).length;
  const weekPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          activeMode === 'TODO' &&
          !isWeekTransitioning &&
          Math.abs(gestureState.dx) > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderMove: (_, gestureState) => {
          const clampedDx = Math.max(-TODO_WEEK_DRAG_LIMIT, Math.min(TODO_WEEK_DRAG_LIMIT, gestureState.dx));
          weekDragX.setValue(clampedDx);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > TODO_WEEK_RELEASE_THRESHOLD) {
            transitionTodoWeek(gestureState.dx < 0 ? 1 : -1);
            return;
          }

          Animated.spring(weekDragX, {
            damping: 17,
            stiffness: 150,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(weekDragX, {
            damping: 17,
            stiffness: 150,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [activeMode, isWeekTransitioning, weekDragX],
  );
  const routeDateKey = Array.isArray(date) ? date[0] : date;
  const applyRouteDateSelection = useCallback(() => {
    const routeDate = parseDateKey(routeDateKey);

    if (!routeDate) {
      return;
    }

    setActiveMode('SCHEDULE');
    setSelectedDate((currentDate) => {
      const nextDate = startOfDay(routeDate);

      return toDateKey(currentDate) === toDateKey(nextDate) ? currentDate : nextDate;
    });
  }, [routeDateKey]);

  useFocusEffect(applyRouteDateSelection);
  useFocusEffect(
    useCallback(() => {
      void reloadPromiseData({ force: true });
    }, [reloadPromiseData]),
  );

  function runLayoutTransition() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  function runMotionFeedback(value: Animated.Value) {
    value.stopAnimation();
    value.setValue(0.86);
    Animated.timing(value, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }

  function moveMonth(offset: number) {
    runLayoutTransition();
    runMotionFeedback(calendarMotion);
    setSelectedDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  }

  function selectDate(date: Date) {
    runMotionFeedback(contentMotion);
    setSelectedDate(startOfDay(date));
  }

  function shiftSelectedDate(dayOffset: number) {
    runLayoutTransition();
    runMotionFeedback(calendarMotion);
    runMotionFeedback(contentMotion);
    setSelectedDate((currentDate) =>
      startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + dayOffset)),
    );
  }

  function transitionTodoWeek(direction: 1 | -1) {
    if (isWeekTransitioning) {
      return;
    }

    setIsWeekTransitioning(true);
    weekDragX.stopAnimation();

    Animated.timing(weekDragX, {
      duration: 170,
      easing: Easing.in(Easing.cubic),
      toValue: -direction * TODO_WEEK_SLIDE_DISTANCE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        weekDragX.setValue(0);
        setIsWeekTransitioning(false);
        return;
      }

      setSelectedDate((currentDate) =>
        startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + direction * 7)),
      );
      contentMotion.setValue(0.92);
      weekDragX.setValue(direction * TODO_WEEK_SLIDE_DISTANCE);

      Animated.parallel([
        Animated.timing(weekDragX, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(contentMotion, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsWeekTransitioning(false);
      });
    });
  }

  function setMode(nextMode: ScheduleMode) {
    if (nextMode === activeMode) {
      return;
    }

    runLayoutTransition();
    runMotionFeedback(contentMotion);
    setActiveMode(nextMode);
  }

  function openScheduleComposer() {
    setEditingScheduleItem(null);
    setEditingCardScheduleItem(null);
    setScheduleTitle('');
    setScheduleTime(createScheduleTimeForDate(selectedDate));
    setScheduleLocation('');
    setScheduleColor('sky');
    setComposerMode('SCHEDULE');
  }

  function openScheduleEditor(item: DisplayScheduleItem) {
    if (item.source !== 'MANUAL') {
      return;
    }

    setEditingScheduleItem(item);
    setEditingCardScheduleItem(null);
    setScheduleTitle(item.title);
    setScheduleTime(item.startsAt || createScheduleTimeForDate(selectedDate));
    setScheduleLocation(item.location);
    setScheduleColor(normalizeManualScheduleColorKey(item.colorKey));
    setComposerMode('SCHEDULE');
  }

  function openCardActions(item: DisplayScheduleItem) {
    if (item.source !== 'CARD') {
      return;
    }

    setCardActionItem(item);
  }

  function closeCardActions() {
    if (isCardActionPending) {
      return;
    }

    setCardActionItem(null);
  }

  function openCardScheduleEditor(item: DisplayScheduleItem) {
    setCardActionItem(null);
    setEditingScheduleItem(null);
    setEditingCardScheduleItem(item);
    setScheduleTitle(item.title);
    setScheduleTime(item.startsAt || createScheduleTimeForDate(selectedDate));
    setScheduleLocation(item.location);
    setScheduleColor('lime');
    setComposerMode('SCHEDULE');
  }

  function closeComposer() {
    setComposerMode(null);
    setEditingScheduleItem(null);
    setEditingCardScheduleItem(null);
    setEditingTodoItem(null);
  }

  function findManagedCardForSchedule(item: DisplayScheduleItem) {
    return managedCards.find((card) => card.id === item.cardId);
  }

  function buildCardChangeRequest(item: DisplayScheduleItem, card: PromiseCard): PromiseCard {
    const startsAt = scheduleTime || item.startsAt || createScheduleTimeForDate(selectedDate);
    const location = scheduleLocation.trim() || '장소 미정';
    const candidateId = `${card.id}-change-slot-${Date.now()}`;
    const label = formatDraftDateTimeLabel(startsAt);

    return {
      ...card,
      mode: 'DIRECT',
      status: 'PENDING',
      title: `${label}에 ${location}에서 볼래?`,
      location,
      selectedSlotId: candidateId,
      candidates: [
        {
          id: candidateId,
          startsAt,
          endsAt: getCandidateEndsAt(startsAt),
          label,
          shortLabel: formatDraftDateTimeShortLabel(startsAt),
          summary: { yes: 0, maybe: 0, no: 0, unanswered: 1 },
        },
      ],
      participants: [],
    };
  }

  function showScheduleNotice(title: string, body: string, tone: ScheduleDialogState['tone'] = 'notice') {
    setScheduleDialog({
      title,
      body,
      tone,
      actions: [
        {
          label: '확인',
          onPress: () => setScheduleDialog(null),
        },
      ],
    });
  }

  function showScheduleConfirm({
    title,
    body,
    confirmLabel,
    onConfirm,
  }: {
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) {
    setScheduleDialog({
      title,
      body,
      tone: 'danger',
      actions: [
        {
          label: '취소',
          variant: 'secondary',
          onPress: () => setScheduleDialog(null),
        },
        {
          label: confirmLabel,
          variant: 'danger',
          onPress: () => {
            setScheduleDialog(null);
            onConfirm();
          },
        },
      ],
    });
  }

  async function submitScheduleItem() {
    const title = scheduleTitle.trim();

    if (!editingCardScheduleItem && title.length === 0) {
      return;
    }

    const startsAt = scheduleTime || createScheduleTimeForDate(selectedDate);

    try {
      const input = {
        title,
        location: scheduleLocation.trim() || '장소 미정',
        startsAt,
        endsAt: getCandidateEndsAt(startsAt),
        colorKey: normalizeManualScheduleColorKey(scheduleColor),
      };

      if (editingCardScheduleItem) {
        const card = findManagedCardForSchedule(editingCardScheduleItem);

        if (!card) {
          showScheduleNotice('카드를 찾지 못했어요', '잠시 후 다시 시도해 주세요.', 'danger');
          return;
        }

        setIsCardActionPending(true);
        const result = await requestManagedCardChange(buildCardChangeRequest(editingCardScheduleItem, card));

        if (result.saveFailed) {
          showScheduleNotice('카드를 저장하지 못했어요', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.', 'danger');
          return;
        }

        const shareResult = await Share.share({
          message: buildShareMessage(result.card),
          url: result.card.sharedUrl,
        });

        if (shareResult.action !== Share.dismissedAction) {
          closeComposer();
        }
      } else if (editingScheduleItem) {
        await updateManualScheduleItem(editingScheduleItem.id, input);
        closeComposer();
        void requestInterstitialAd('manual_schedule_saved');
      } else {
        await createManualScheduleItem(input);
        closeComposer();
        void requestInterstitialAd('manual_schedule_saved');
      }

      runMotionFeedback(contentMotion);
    } catch {
      runMotionFeedback(contentMotion);
    } finally {
      setIsCardActionPending(false);
    }
  }

  async function deleteCardScheduleWithoutShare(item: DisplayScheduleItem) {
    setIsCardActionPending(true);

    try {
      const result = await removeManagedCard(item.cardId);

      if (result.deleteFailed) {
        showScheduleNotice('일정을 삭제하지 못했어요', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.', 'danger');
        return;
      }

      setCardActionItem(null);
      runMotionFeedback(contentMotion);
    } catch {
      showScheduleNotice('일정을 삭제하지 못했어요', '잠시 후 다시 시도해 주세요.', 'danger');
      runMotionFeedback(contentMotion);
    } finally {
      setIsCardActionPending(false);
    }
  }

  function requestDeleteCardSchedule(item: DisplayScheduleItem) {
    const confirmation = getCardScheduleDeleteConfirmation(item);
    setCardActionItem(null);

    showScheduleConfirm({
      title: confirmation.title,
      body: confirmation.body,
      confirmLabel: confirmation.confirmLabel ?? '삭제',
      onConfirm: () => {
        void deleteCardScheduleWithoutShare(item);
      },
    });
  }

  function requestDeleteEditingScheduleItem() {
    const item = editingScheduleItem;

    if (!item) {
      return;
    }

    showScheduleConfirm({
      title: '일정 삭제',
      body: `"${item.title}" 일정을 삭제할까요?`,
      confirmLabel: '삭제',
      onConfirm: () => {
        void deleteManualScheduleItem(item.id)
          .then(() => {
            closeComposer();
            runMotionFeedback(contentMotion);
          })
          .catch(() => {
            showScheduleNotice('일정을 삭제하지 못했어요', '잠시 후 다시 시도해 주세요.', 'danger');
            runMotionFeedback(contentMotion);
          });
      },
    });
  }

  function openTodoComposer() {
    setEditingScheduleItem(null);
    setEditingCardScheduleItem(null);
    setEditingTodoItem(null);
    setTodoTitle('');
    setTodoDetail('');
    setTodoColor('coral');
    setComposerMode('TODO');
  }

  function openTodoEditor(todo: TodoItem) {
    if (todo.source === 'RECURRING') {
      setIsRecurringTodoModalOpen(true);
      return;
    }

    const todoDate = parseDateKey(todo.dateKey);

    setEditingScheduleItem(null);
    setEditingCardScheduleItem(null);
    setEditingTodoItem(todo);
    setSelectedDate(todoDate ? startOfDay(todoDate) : selectedDate);
    setTodoTitle(todo.title);
    setTodoDetail(todo.detail);
    setTodoColor(todo.colorKey);
    setComposerMode('TODO');
  }

  async function submitTodoItem() {
    const title = todoTitle.trim();

    if (title.length === 0) {
      return;
    }

    try {
      const input = {
        dateKey: editingTodoItem?.dateKey ?? selectedDateKey,
        title,
        detail: todoDetail.trim() || '오늘 중',
        colorKey: todoColor,
      };

      if (editingTodoItem) {
        await updateTodo(editingTodoItem.id, input);
      } else {
        await createTodo(input);
      }

      closeComposer();
      void requestInterstitialAd('todo_saved');
      runMotionFeedback(contentMotion);
    } catch {
      runMotionFeedback(contentMotion);
    }
  }

  function requestDeleteEditingTodoItem() {
    if (!editingTodoItem) {
      return;
    }

    const todo = editingTodoItem;

    showScheduleConfirm({
      title: '할일 삭제',
      body: `"${todo.title}" 할일을 삭제할까요?`,
      confirmLabel: '삭제',
      onConfirm: () => {
        void deleteTodo(todo.id)
          .then(() => {
            closeComposer();
            runMotionFeedback(contentMotion);
          })
          .catch(() => {
            showScheduleNotice('할일을 삭제하지 못했어요', '잠시 후 다시 시도해 주세요.', 'danger');
            runMotionFeedback(contentMotion);
          });
      },
    });
  }

  function resetRecurringTodoDraft() {
    setRecurringTodoTitle('');
    setRecurringTodoDetail('');
    setRecurringTodoColor('mint');
    setRecurringTodoWeekdays(defaultRecurringWeekdays);
  }

  function openRecurringTodoModal() {
    setIsRecurringTodoModalOpen(true);
  }

  function closeRecurringTodoModal() {
    setIsRecurringTodoModalOpen(false);
    setIsRecurringTodoFormOpen(false);
    resetRecurringTodoDraft();
  }

  function toggleRecurringWeekday(weekday: WeekdayIndex) {
    setRecurringTodoWeekdays((currentWeekdays) => {
      if (currentWeekdays.includes(weekday)) {
        return currentWeekdays.filter((currentWeekday) => currentWeekday !== weekday);
      }

      return [...currentWeekdays, weekday].sort((left, right) => left - right);
    });
  }

  function submitRecurringTodo() {
    const title = recurringTodoTitle.trim();

    if (!title) {
      showScheduleNotice('반복할일 이름을 입력해 주세요', '반복해서 표시할 할일을 입력해 주세요.', 'danger');
      return;
    }

    if (recurringTodoWeekdays.length === 0) {
      showScheduleNotice('요일을 선택해 주세요', '반복할 요일을 하나 이상 선택해 주세요.', 'danger');
      return;
    }

    createRecurringTodo({
      title,
      detail: recurringTodoDetail,
      weekdays: recurringTodoWeekdays,
      colorKey: recurringTodoColor,
    });
    resetRecurringTodoDraft();
    setIsRecurringTodoFormOpen(false);
    runMotionFeedback(contentMotion);
  }

  function requestDeleteRecurringTodoItem(recurringTodo: RecurringTodoItem) {
    showScheduleConfirm({
      title: '반복할일 삭제',
      body: `"${recurringTodo.title}" 반복할일을 삭제할까요? 선택된 요일에 더 이상 표시되지 않아요.`,
      confirmLabel: '삭제',
      onConfirm: () => {
        deleteRecurringTodo(recurringTodo.id);
        runMotionFeedback(contentMotion);
      },
    });
  }

  function toggleTodoOptimistic(todo: TodoItem) {
    if (todo.source === 'RECURRING' && todo.recurringTodoId) {
      toggleRecurringTodoCompletion(todo.recurringTodoId, todo.dateKey);
      runMotionFeedback(contentMotion);
      return;
    }

    void saveTodoToggle(todo.id)
      .then(() => {
        runMotionFeedback(contentMotion);
      })
      .catch(() => {
        runMotionFeedback(contentMotion);
      });
  }

  const calendarAnimatedStyle = {
    opacity: calendarMotion,
    transform: [
      {
        scale: calendarMotion.interpolate({
          inputRange: [0.86, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };
  const todoWeekAnimatedStyle = {
    opacity: calendarMotion,
    transform: [
      {
        translateX: weekDragX,
      },
    ],
  };
  const contentAnimatedStyle = {
    opacity: contentMotion,
    transform: [
      {
        translateY: contentMotion.interpolate({
          inputRange: [0.86, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  return (
    <>
      <AppScreen reserveBottomTabs>
      <View style={styles.header}>
        <View style={styles.headerShapePrimary} />
        <View style={styles.headerShapeMint} />
        <View style={styles.headerShapeLime} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>언제볼래</Text>
          <Text style={styles.title}>일정</Text>
          <Text style={styles.subtitle}>약속 일정과 해야 할 일을 날짜별로 확인해요.</Text>
        </View>
      </View>

      <View style={styles.modeTabs}>
        <ModeTab
          count={selectedItems.length}
          icon={<CalendarDays size={16} color={activeMode === 'SCHEDULE' ? palette.onLight : palette.primaryDeep} />}
          label="일정"
          selected={activeMode === 'SCHEDULE'}
          onPress={() => setMode('SCHEDULE')}
        />
        <ModeTab
          count={selectedTodos.length}
          icon={<ListChecks size={16} color={activeMode === 'TODO' ? palette.onLight : palette.primaryDeep} />}
          label="할일"
          selected={activeMode === 'TODO'}
          onPress={() => setMode('TODO')}
        />
      </View>

      {activeMode === 'SCHEDULE' ? (
        <Card style={styles.calendarCard}>
          <View style={styles.calendarTop}>
            <Pressable
              accessibilityLabel="이전 달"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => moveMonth(-1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
              <ChevronLeft size={16} color={palette.primaryDeep} />
            </Pressable>
            <View style={styles.monthTitleGroup}>
              <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth)}</Text>
            </View>
            <Pressable
              accessibilityLabel="다음 달"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => moveMonth(1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
              <ChevronRight size={16} color={palette.primaryDeep} />
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {weekdayLabels.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <Animated.View style={[styles.calendarGrid, calendarAnimatedStyle]}>
            {calendarRows.map((row) => (
              <View key={row.map((cell) => cell.key).join('-')} style={styles.calendarRow}>
                {row.map((cell) => {
                  const cellKey = toDateKey(cell.date);
                  const selected = cellKey === selectedDateKey;
                  const today = cellKey === toDateKey(startOfDay(new Date()));
                  const count = scheduleCounts[cellKey] ?? 0;
                  const hasCount = count > 0;

                  return (
                    <Pressable
                      key={cell.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${formatSelectedDate(cell.date)} 일정 ${count}개`}
                      onPress={() => selectDate(cell.date)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        !cell.inCurrentMonth && styles.outsideDayCell,
                        today && styles.todayCell,
                        selected && styles.selectedDayCell,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          !cell.inCurrentMonth && styles.outsideDayNumber,
                          selected && styles.selectedDayNumber,
                        ]}>
                        {cell.date.getDate()}
                      </Text>
                      {hasCount ? (
                        <View style={[styles.countBadge, selected && styles.selectedCountBadge]}>
                          <Text style={[styles.countText, selected && styles.selectedCountText]}>{count}</Text>
                        </View>
                      ) : (
                        <View style={styles.emptyCountSlot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </Card>
      ) : (
        <TodoWeekStrip
          counts={todoCounts}
          panHandlers={weekPanResponder.panHandlers}
          selectedDate={selectedDate}
          selectedDateKey={selectedDateKey}
          weekCells={todoWeekCells}
          weekStyle={todoWeekAnimatedStyle}
          onSelectDate={selectDate}
        />
      )}

      <Animated.View style={[styles.contentStack, contentAnimatedStyle]}>
        {plannerLoading ? <Text style={styles.syncText}>일정 동기화 중...</Text> : null}
        {activeMode === 'SCHEDULE' ? (
          <SchedulePanel
            isLoading={plannerLoading}
            selectedDate={selectedDate}
            selectedItems={selectedItems}
            onAdd={openScheduleComposer}
            onEdit={openScheduleEditor}
            onDeleteCardSchedule={requestDeleteCardSchedule}
          />
        ) : (
          <TodoPanel
            completedCount={completedTodoCount}
            selectedDate={selectedDate}
            selectedTodos={selectedTodos}
            totalCount={selectedTodos.length}
            onAdd={openTodoComposer}
            onEdit={openTodoEditor}
            onOpenRecurring={openRecurringTodoModal}
            onToggle={toggleTodoOptimistic}
          />
        )}
      </Animated.View>
      </AppScreen>

      <ComposerModal
        mode={composerMode}
        scheduleColor={scheduleColor}
        scheduleLocation={scheduleLocation}
        scheduleTime={scheduleTime}
        scheduleTitle={scheduleTitle}
        isEditingSchedule={editingScheduleItem !== null}
        isEditingCardSchedule={editingCardScheduleItem !== null}
        isSubmitting={isScheduleMutating}
        selectedDate={selectedDate}
        todoColor={todoColor}
        todoDetail={todoDetail}
        todoTitle={todoTitle}
        isEditingTodo={Boolean(editingTodoItem)}
        onChangeScheduleColor={setScheduleColor}
        onChangeScheduleLocation={setScheduleLocation}
        onChangeScheduleTime={setScheduleTime}
        onChangeScheduleTitle={setScheduleTitle}
        onChangeTodoColor={setTodoColor}
        onChangeTodoDetail={setTodoDetail}
        onChangeTodoTitle={setTodoTitle}
        onClose={closeComposer}
        onDeleteSchedule={requestDeleteEditingScheduleItem}
        onDeleteTodo={requestDeleteEditingTodoItem}
        onSubmitSchedule={submitScheduleItem}
        onSubmitTodo={submitTodoItem}
      />
      <CardScheduleActionModal
        item={cardActionItem}
        isPending={isCardActionPending}
        onClose={closeCardActions}
        onDelete={requestDeleteCardSchedule}
        onEdit={openCardScheduleEditor}
      />
      <RecurringTodoModal
        isFormOpen={isRecurringTodoFormOpen}
        recurringTodos={recurringTodos}
        selectedWeekdays={recurringTodoWeekdays}
        title={recurringTodoTitle}
        detail={recurringTodoDetail}
        color={recurringTodoColor}
        visible={isRecurringTodoModalOpen}
        onAddPress={() => setIsRecurringTodoFormOpen(true)}
        onChangeColor={setRecurringTodoColor}
        onChangeDetail={setRecurringTodoDetail}
        onChangeTitle={setRecurringTodoTitle}
        onClose={closeRecurringTodoModal}
        onDelete={requestDeleteRecurringTodoItem}
        onSubmit={submitRecurringTodo}
        onToggleWeekday={toggleRecurringWeekday}
      />
      <ScheduleDialogModal dialog={scheduleDialog} onClose={() => setScheduleDialog(null)} />
    </>
  );
}

function ScheduleDialogModal({
  dialog,
  onClose,
}: {
  dialog: ScheduleDialogState | null;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={dialog !== null}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {dialog ? (
          <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dialogPanel}>
              <View style={[styles.dialogIcon, dialog.tone === 'danger' ? styles.dialogDangerIcon : styles.dialogNoticeIcon]}>
                <AlertTriangle size={22} color={dialog.tone === 'danger' ? palette.danger : palette.primaryDeep} />
              </View>
              <View style={styles.dialogCopy}>
                <Text style={styles.modalTitle}>{dialog.title}</Text>
                <Text style={styles.dialogBody}>{dialog.body}</Text>
              </View>
              <View style={styles.dialogActions}>
                {dialog.actions.map((action) => {
                  const variant = action.variant ?? 'primary';

                  return (
                    <Pressable
                      key={action.label}
                      accessibilityRole="button"
                      onPress={action.onPress}
                      style={({ pressed }) => [
                        styles.dialogActionButton,
                        variant === 'danger'
                          ? styles.dialogDangerButton
                          : variant === 'secondary'
                            ? styles.dialogSecondaryButton
                            : styles.dialogPrimaryButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.dialogActionText,
                          variant === 'primary' && styles.dialogPrimaryActionText,
                        ]}>
                        {action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function ModeTab({
  count,
  icon,
  label,
  selected,
  onPress,
}: {
  count: number;
  icon: ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.modeTab, selected && styles.selectedModeTab, pressed && styles.pressed]}>
      {icon}
      <Text style={[styles.modeTabLabel, selected && styles.selectedModeTabLabel]}>{label}</Text>
      <Text style={[styles.modeTabCount, selected && styles.selectedModeTabCount]}>{count}</Text>
    </Pressable>
  );
}

function TodoWeekStrip({
  counts,
  panHandlers,
  selectedDate,
  selectedDateKey,
  weekCells,
  weekStyle,
  onSelectDate,
}: {
  counts: Record<string, number>;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  selectedDate: Date;
  selectedDateKey: string;
  weekCells: ReturnType<typeof getWeekCells>;
  weekStyle: object;
  onSelectDate: (date: Date) => void;
}) {
  return (
    <View style={styles.todoWeekSurface}>
      <View style={styles.todoWeekTop}>
        <View style={styles.todoMonthTitleGroup}>
          <Text style={styles.todoMonthTitle}>{formatMonthTitle(selectedDate)}</Text>
          <ChevronDown size={15} color={palette.inkMuted} />
        </View>
      </View>

      <View style={styles.todoWeekdayRow}>
        {weekdayLabels.map((label, index) => (
          <Text key={label} style={[styles.todoWeekdayLabel, index === 0 && styles.todoSundayText]}>
            {label}
          </Text>
        ))}
      </View>

      <Animated.View {...panHandlers} style={[styles.todoWeekDateRow, weekStyle]}>
        {weekCells.map((cell) => {
          const selected = cell.key === selectedDateKey;
          const today = cell.key === toDateKey(startOfDay(new Date()));
          const sunday = cell.date.getDay() === 0;
          const count = counts[cell.key] ?? 0;

          return (
            <Pressable
              key={cell.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatSelectedDate(cell.date)} 할일 ${count}개`}
              onPress={() => onSelectDate(cell.date)}
              style={({ pressed }) => [
                styles.todoWeekDateButton,
                today && !selected && styles.todoTodayButton,
                selected && styles.todoSelectedDateButton,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.todoWeekDateText,
                  sunday && styles.todoSundayText,
                  !cell.inCurrentMonth && styles.todoOutsideMonthText,
                  selected && styles.todoSelectedDateText,
                ]}>
                {cell.date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

function SchedulePanel({
  isLoading,
  selectedDate,
  selectedItems,
  onAdd,
  onEdit,
  onDeleteCardSchedule,
}: {
  isLoading: boolean;
  selectedDate: Date;
  selectedItems: DisplayScheduleItem[];
  onAdd: () => void;
  onEdit: (item: DisplayScheduleItem) => void;
  onDeleteCardSchedule: (item: DisplayScheduleItem) => void;
}) {
  return (
    <>
      <SectionHeader title={`${formatSelectedDate(selectedDate)} 일정`} action={`${selectedItems.length}개`} />
      {selectedItems.length === 0 && isLoading ? (
        <Card style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <CalendarDays size={23} color={palette.primaryDeep} />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>일정을 불러오고 있어요</Text>
            <Text style={styles.emptyBody}>직접 추가한 일정을 먼저 확인하는 중이에요.</Text>
          </View>
        </Card>
      ) : selectedItems.length > 0 ? (
        <View style={styles.list}>
          {selectedItems.map((item) => (
            <ScheduleItemCard key={item.id} item={item} onEdit={onEdit} onDeleteCardSchedule={onDeleteCardSchedule} />
          ))}
        </View>
      ) : (
        <Card style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <CalendarDays size={23} color={palette.primaryDeep} />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>이 날의 일정이 없어요</Text>
            <Text style={styles.emptyBody}>일정 추가를 누르면 선택한 날짜에 임시 일정 카드가 들어와요.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onAdd}
              style={({ pressed }) => [styles.addButton, styles.emptyAddButton, pressed && styles.pressed]}>
              <Plus size={17} color={palette.primaryDeep} />
              <Text style={styles.addButtonText}>일정 추가</Text>
            </Pressable>
          </View>
        </Card>
      )}
      {selectedItems.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Plus size={17} color={palette.primaryDeep} />
          <Text style={styles.addButtonText}>일정 추가</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function ScheduleItemCard({
  item,
  onEdit,
  onDeleteCardSchedule,
}: {
  item: DisplayScheduleItem;
  onEdit: (item: DisplayScheduleItem) => void;
  onDeleteCardSchedule: (item: DisplayScheduleItem) => void;
}) {
  if (item.source === 'CARD') {
    const participants = item.participants ?? [];

    return (
      <Card style={styles.cardScheduleCard}>
        <View style={styles.manualScheduleBody}>
          <View style={styles.manualScheduleTop}>
            <Text style={styles.manualScheduleTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.manualScheduleActionGroup}>
              <Pressable
                accessibilityLabel={`${item.title} 카드 일정 삭제`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onDeleteCardSchedule(item)}
                style={({ pressed }) => [styles.iconActionButton, pressed && styles.pressed]}>
                <Trash2 size={15} color={palette.primaryDeep} />
              </Pressable>
            </View>
          </View>
          <View style={styles.cardScheduleInfoRow}>
            <Clock3 size={15} color={palette.primaryDeep} />
            <Text style={styles.manualInfoText}>{item.timeLabel}</Text>
          </View>
          <View style={styles.cardScheduleInfoRow}>
            <MapPin size={15} color={palette.primaryDeep} />
            <Text style={styles.manualInfoText}>{item.location}</Text>
          </View>
          {participants.length > 0 ? (
            <View style={styles.cardResponsePanel}>
              <View style={styles.cardResponseHeader}>
                <MessageCircle size={14} color={palette.primaryDeep} />
                <Text style={styles.cardResponseTitle}>참여자 응답</Text>
              </View>
              <View style={styles.cardResponseList}>
                {participants.map((participant) => {
                  const displayName = getScheduleParticipantDisplayName(participant);
                  const comment = getScheduleParticipantComment(participant);
                  const choice = getScheduleParticipantChoice(item, participant);

                  return (
                    <View key={participant.id} style={styles.cardResponseRow}>
                      <View style={[styles.cardResponseAvatar, { backgroundColor: participant.color }]}>
                        <Text style={styles.cardResponseAvatarText}>{participant.name}</Text>
                      </View>
                      <View style={styles.cardResponseCopy}>
                        <View style={styles.cardResponseNameRow}>
                          <Text style={styles.cardResponseName} numberOfLines={1}>
                            {displayName}
                          </Text>
                          <View style={[styles.cardResponseChoiceBadge, getScheduleParticipantChoiceBadgeStyle(choice)]}>
                            <Text style={styles.cardResponseChoiceText}>{getResponseChoiceLabel(choice)}</Text>
                          </View>
                        </View>
                        <Text
                          style={comment ? styles.cardResponseComment : styles.cardResponseCommentMuted}
                          numberOfLines={2}>
                          {comment || '한마디 없음'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Card>
    );
  }

  const color = getManualScheduleColor(item.colorKey);

  return (
    <Card style={[styles.cardScheduleCard, styles.manualScheduleCard, { backgroundColor: color.soft }]}>
      <View style={styles.manualScheduleBody}>
        <View style={styles.manualScheduleTop}>
          <Text style={styles.manualScheduleTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.manualScheduleActionGroup}>
            <Pressable
              accessibilityLabel={`${item.title} 일정 편집`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit(item)}
              style={({ pressed }) => [styles.iconActionButton, pressed && styles.pressed]}>
              <Pencil size={15} color={palette.primaryDeep} />
            </Pressable>
          </View>
        </View>
        <View style={styles.cardScheduleInfoRow}>
          <Clock3 size={15} color={palette.primaryDeep} />
          <Text style={styles.manualInfoText}>{item.timeLabel}</Text>
        </View>
        <View style={styles.cardScheduleInfoRow}>
          <MapPin size={15} color={palette.primaryDeep} />
          <Text style={styles.manualInfoText}>{item.location}</Text>
        </View>
      </View>
    </Card>
  );
}

function TodoPanel({
  completedCount,
  selectedDate,
  selectedTodos,
  totalCount,
  onAdd,
  onEdit,
  onOpenRecurring,
  onToggle,
}: {
  completedCount: number;
  selectedDate: Date;
  selectedTodos: TodoItem[];
  totalCount: number;
  onAdd: () => void;
  onEdit: (todo: TodoItem) => void;
  onOpenRecurring: () => void;
  onToggle: (todo: TodoItem) => void;
}) {
  return (
    <View style={styles.todoPanel}>
      <View style={styles.todoDateHeader}>
        <Text style={styles.todoDateTitle}>{formatTodoDayTitle(selectedDate)}</Text>
        <Text style={styles.todoDateMeta}>{`완료 ${completedCount}/${totalCount}`}</Text>
      </View>
      <View style={styles.todoDivider} />

      {selectedTodos.length > 0 ? (
        <View style={styles.todoList}>
          {selectedTodos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onEdit={() => onEdit(todo)} onToggle={() => onToggle(todo)} />
          ))}
        </View>
      ) : (
        <Text style={styles.todoEmptyText}>이날의 할일이 없습니다.</Text>
      )}

      <View style={styles.todoActionRow}>
        <Pressable
          accessibilityLabel="할일 추가"
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, styles.todoActionButton, pressed && styles.pressed]}>
          <Plus size={17} color={palette.primaryDeep} />
          <Text style={styles.addButtonText}>할일 추가</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="반복할일"
          accessibilityRole="button"
          onPress={onOpenRecurring}
          style={({ pressed }) => [styles.addButton, styles.todoActionButton, pressed && styles.pressed]}>
          <Repeat2 size={17} color={palette.primaryDeep} />
          <Text style={styles.addButtonText}>반복할일</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TodoRow({ todo, onEdit, onToggle }: { todo: TodoItem; onEdit: () => void; onToggle: () => void }) {
  const color = getScheduleColor(todo.colorKey);
  const backgroundColor = todo.done ? getCompletedTodoBackgroundColor(todo.colorKey) : color.soft;

  return (
    <View style={[styles.todoRow, { backgroundColor }]}>
      <Pressable
        accessibilityLabel={`${todo.title} 완료 전환`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.done }}
        onPress={onToggle}
        style={({ pressed }) => [styles.todoCheckButton, pressed && styles.pressed]}>
        <View style={[styles.checkbox, todo.done && styles.checkedBox]}>
          {todo.done ? <Check size={16} color={palette.onLight} /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.done }}
        onPress={onToggle}
        style={({ pressed }) => [styles.todoCopy, pressed && styles.pressed]}>
        <Text style={[styles.todoTitle, todo.done && styles.doneTodoText]}>{todo.title}</Text>
        <Text style={[styles.todoDetail, todo.done && styles.doneTodoText]}>{todo.detail}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`${todo.title} 편집`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={({ pressed }) => [styles.todoEditButton, pressed && styles.pressed]}>
        <Pencil size={18} color={palette.primaryDeep} />
        <Text style={styles.todoEditButtonText}>편집</Text>
      </Pressable>
    </View>
  );
}

function formatRecurringWeekdays(weekdays: WeekdayIndex[]) {
  return recurringWeekdayOptions
    .filter((option) => weekdays.includes(option.value))
    .map((option) => option.label)
    .join(', ');
}

function RecurringTodoModal({
  color,
  detail,
  isFormOpen,
  recurringTodos,
  selectedWeekdays,
  title,
  visible,
  onAddPress,
  onChangeColor,
  onChangeDetail,
  onChangeTitle,
  onClose,
  onDelete,
  onSubmit,
  onToggleWeekday,
}: {
  color: ScheduleColorKey;
  detail: string;
  isFormOpen: boolean;
  recurringTodos: RecurringTodoItem[];
  selectedWeekdays: WeekdayIndex[];
  title: string;
  visible: boolean;
  onAddPress: () => void;
  onChangeColor: (value: ScheduleColorKey) => void;
  onChangeDetail: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onClose: () => void;
  onDelete: (recurringTodo: RecurringTodoItem) => void;
  onSubmit: () => void;
  onToggleWeekday: (weekday: WeekdayIndex) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.recurringTodoKeyboardAvoider}>
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="반복할일 배경 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalBackdropTouchable}
          />
          <View style={[styles.modalPressGuard, styles.recurringTodoPressGuard]}>
            <View style={[styles.modalPanel, styles.recurringTodoPanel, isFormOpen && styles.recurringTodoFormPanel]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.modalKicker}>반복 설정</Text>
                  <Text style={styles.modalTitle}>반복할일</Text>
                </View>
                <Pressable
                  accessibilityLabel="반복할일 닫기"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                  <X size={19} color={palette.primaryDeep} />
                </Pressable>
              </View>

              {!isFormOpen ? (
                <ScrollView
                  contentContainerStyle={styles.recurringTodoScrollContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.recurringTodoScroll}>
                  {recurringTodos.length > 0 ? (
                    <View style={styles.recurringTodoList}>
                      {recurringTodos.map((recurringTodo) => (
                        <View key={recurringTodo.id} style={styles.recurringTodoRow}>
                          <View style={styles.recurringTodoCopy}>
                            <Text style={styles.recurringTodoTitle} numberOfLines={1}>
                              {recurringTodo.title}
                            </Text>
                            <Text style={styles.recurringTodoMeta} numberOfLines={2}>
                              {formatRecurringWeekdays(recurringTodo.weekdays)} · {recurringTodo.detail}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityLabel={`${recurringTodo.title} 반복할일 삭제`}
                            accessibilityRole="button"
                            onPress={() => onDelete(recurringTodo)}
                            style={({ pressed }) => [styles.recurringTodoDeleteButton, pressed && styles.pressed]}>
                            <Trash2 size={15} color={palette.primaryDeep} />
                            <Text style={styles.recurringTodoDeleteText}>삭제</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.recurringTodoEmptyText}>등록된 반복할일이 없습니다.</Text>
                  )}
                </ScrollView>
              ) : (
                <View style={styles.recurringTodoFormBody}>
                  <View style={styles.recurringTodoForm}>
                    <ModalInput
                      label="반복할일"
                      placeholder="예: 운동하기"
                      value={title}
                      onChangeText={onChangeTitle}
                    />
                    <ModalInput
                      label="메모"
                      placeholder="예: 30분"
                      value={detail}
                      onChangeText={onChangeDetail}
                    />
                    <View style={styles.weekdayPickerShell}>
                      <Text style={styles.modalInputLabel}>요일</Text>
                      <View style={styles.recurringWeekdayRow}>
                        {recurringWeekdayOptions.map((option) => {
                          const selected = selectedWeekdays.includes(option.value);

                          return (
                            <Pressable
                              key={option.value}
                              accessibilityLabel={`${option.label}요일 반복`}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              onPress={() => onToggleWeekday(option.value)}
                              style={({ pressed }) => [
                                styles.recurringWeekdayButton,
                                selected && styles.selectedRecurringWeekdayButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text
                                style={[
                                  styles.recurringWeekdayText,
                                  selected && styles.selectedRecurringWeekdayText,
                                ]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <ColorPicker label="카드 색상" value={color} onChange={onChangeColor} />
                  </View>
                </View>
              )}

              <View style={styles.recurringTodoFooter}>
                {isFormOpen ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onSubmit}
                    style={({ pressed }) => [styles.modalSubmitButton, pressed && styles.pressed]}>
                    <Text style={styles.modalSubmitText}>추가하기</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onAddPress}
                    style={({ pressed }) => [styles.modalActionButton, pressed && styles.pressed]}>
                    <Plus size={16} color={palette.onLight} />
                    <Text style={styles.modalSubmitText}>추가하기</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CardScheduleActionModal({
  item,
  isPending,
  onClose,
  onDelete,
  onEdit,
}: {
  item: DisplayScheduleItem | null;
  isPending: boolean;
  onClose: () => void;
  onDelete: (item: DisplayScheduleItem) => void;
  onEdit: (item: DisplayScheduleItem) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={item !== null}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {item ? (
          <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalKicker}>{item.dateLabel}</Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  카드 일정 관리
                </Text>
              </View>
              <Pressable
                accessibilityLabel="카드 일정 관리 닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
              disabled={isPending}
              onPress={() => onEdit(item)}
              style={({ pressed }) => [
                styles.modalActionButton,
                isPending && styles.disabledSubmitButton,
                pressed && !isPending && styles.pressed,
              ]}>
              <Pencil size={16} color={isPending ? palette.inkSoft : palette.onLight} />
              <Text style={[styles.modalSubmitText, isPending && styles.disabledSubmitText]}>편집하고 공유하기</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
              disabled={isPending}
              onPress={() => onDelete(item)}
              style={({ pressed }) => [
                styles.modalDeleteButton,
                isPending && styles.disabledSubmitButton,
                pressed && !isPending && styles.pressed,
              ]}>
              <Trash2 size={16} color={isPending ? palette.inkSoft : palette.primaryDeep} />
              <Text style={[styles.modalDeleteText, isPending && styles.disabledSubmitText]}>일정 삭제하기</Text>
            </Pressable>
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function ComposerModal({
  mode,
  scheduleColor,
  scheduleLocation,
  scheduleTime,
  scheduleTitle,
  isEditingSchedule,
  isEditingCardSchedule,
  isEditingTodo,
  isSubmitting,
  selectedDate,
  todoColor,
  todoDetail,
  todoTitle,
  onChangeScheduleColor,
  onChangeScheduleLocation,
  onChangeScheduleTime,
  onChangeScheduleTitle,
  onChangeTodoColor,
  onChangeTodoDetail,
  onChangeTodoTitle,
  onClose,
  onDeleteSchedule,
  onDeleteTodo,
  onSubmitSchedule,
  onSubmitTodo,
}: {
  mode: ScheduleMode | null;
  scheduleColor: ScheduleColorKey;
  scheduleLocation: string;
  scheduleTime: string;
  scheduleTitle: string;
  isEditingSchedule: boolean;
  isEditingCardSchedule: boolean;
  isEditingTodo: boolean;
  isSubmitting: boolean;
  selectedDate: Date;
  todoColor: ScheduleColorKey;
  todoDetail: string;
  todoTitle: string;
  onChangeScheduleColor: (value: ScheduleColorKey) => void;
  onChangeScheduleLocation: (value: string) => void;
  onChangeScheduleTime: (value: string) => void;
  onChangeScheduleTitle: (value: string) => void;
  onChangeTodoColor: (value: ScheduleColorKey) => void;
  onChangeTodoDetail: (value: string) => void;
  onChangeTodoTitle: (value: string) => void;
  onClose: () => void;
  onDeleteSchedule: () => void;
  onDeleteTodo: () => void;
  onSubmitSchedule: () => void;
  onSubmitTodo: () => void;
}) {
  const isSchedule = mode === 'SCHEDULE';
  const title = isSchedule ? '일정 추가' : '할일 추가';
  const disabled =
    isSubmitting ||
    (isSchedule
      ? isEditingCardSchedule
        ? scheduleLocation.trim().length === 0
        : scheduleTitle.trim().length === 0
      : todoTitle.trim().length === 0);
  const modalTitle = isEditingCardSchedule
    ? '카드 일정 편집'
    : isSchedule && isEditingSchedule
      ? '일정 편집'
      : !isSchedule && isEditingTodo
        ? '할일 편집'
        : title;
  const submitLabel = isEditingCardSchedule
    ? '공유하기'
    : (isSchedule && isEditingSchedule) || (!isSchedule && isEditingTodo)
      ? '수정 저장'
      : title;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={mode !== null}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.scheduleComposerKeyboardAvoider}>
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel={`${modalTitle} 배경 닫기`}
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalBackdropTouchable}
          />
          <View style={[styles.modalPressGuard, styles.scheduleComposerPressGuard]}>
            <View style={[styles.modalPanel, styles.scheduleComposerPanel]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalKicker}>{formatSelectedDate(selectedDate)}</Text>
                <Text style={styles.modalTitle}>{modalTitle}</Text>
              </View>
              <Pressable
                accessibilityLabel={`${modalTitle} 닫기`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scheduleComposerForm}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.scheduleComposerFormScroll}>
              {isSchedule ? (
                <View style={styles.modalForm}>
                  {!isEditingCardSchedule ? (
                    <ModalInput
                      compact
                      label="일정 이름"
                      placeholder="예: 저녁 약속"
                      value={scheduleTitle}
                      onChangeText={onChangeScheduleTitle}
                    />
                  ) : null}
                  <CompactScheduleTimeField
                    value={scheduleTime || createScheduleTimeForDate(selectedDate)}
                    onChange={onChangeScheduleTime}
                  />
                  <ModalInput
                    compact
                    label="장소"
                    placeholder="예: 성수 밥집"
                    value={scheduleLocation}
                    onChangeText={onChangeScheduleLocation}
                  />
                  {!isEditingCardSchedule ? (
                    <ColorPicker
                      label="카드 색상"
                      compact
                      options={scheduleColorOptions}
                      value={scheduleColor}
                      onChange={onChangeScheduleColor}
                    />
                  ) : null}
                </View>
              ) : (
                <View style={styles.modalForm}>
                  <ModalInput
                    compact
                    label="할일"
                    placeholder="예: 참석자에게 위치 보내기"
                    value={todoTitle}
                    onChangeText={onChangeTodoTitle}
                  />
                  <ModalInput
                    compact
                    label="메모"
                    placeholder="예: 오늘 중"
                    value={todoDetail}
                    onChangeText={onChangeTodoDetail}
                  />
                  <ColorPicker
                    label="카드 색상"
                    compact
                    value={todoColor}
                    onChange={onChangeTodoColor}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.scheduleComposerFooter}>
              {isSchedule && isEditingSchedule && !isEditingCardSchedule ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitting }}
                  disabled={isSubmitting}
                  onPress={onDeleteSchedule}
                  style={({ pressed }) => [
                    styles.modalDeleteButton,
                    isSubmitting && styles.disabledSubmitButton,
                    pressed && !isSubmitting && styles.pressed,
                  ]}>
                  <Trash2 size={16} color={isSubmitting ? palette.inkSoft : palette.primaryDeep} />
                  <Text style={[styles.modalDeleteText, isSubmitting && styles.disabledSubmitText]}>일정 삭제</Text>
                </Pressable>
              ) : null}

              {!isSchedule && isEditingTodo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitting }}
                  disabled={isSubmitting}
                  onPress={onDeleteTodo}
                  style={({ pressed }) => [
                    styles.modalDeleteButton,
                    isSubmitting && styles.disabledSubmitButton,
                    pressed && !isSubmitting && styles.pressed,
                  ]}>
                  <Trash2 size={16} color={isSubmitting ? palette.inkSoft : palette.primaryDeep} />
                  <Text style={[styles.modalDeleteText, isSubmitting && styles.disabledSubmitText]}>할일 삭제</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={isSchedule ? onSubmitSchedule : onSubmitTodo}
                style={({ pressed }) => [
                  styles.modalSubmitButton,
                  disabled && styles.disabledSubmitButton,
                  pressed && !disabled && styles.pressed,
                ]}>
                <Text style={[styles.modalSubmitText, disabled && styles.disabledSubmitText]}>
                  {isSubmitting ? '저장 중' : submitLabel}
                </Text>
              </Pressable>
            </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CompactScheduleTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [activePicker, setActivePicker] = useState<'date' | 'time' | null>(null);
  const pickerValue = new Date(value);
  const resolvedPickerValue = Number.isNaN(pickerValue.getTime()) ? new Date() : pickerValue;

  return (
    <View style={styles.compactTimeShell}>
      <View style={styles.compactTimeHeader}>
        <View style={styles.compactTimeTitleRow}>
          <Clock3 size={15} color={palette.primaryDeep} />
          <Text style={styles.modalInputLabel}>언제</Text>
        </View>
        <View style={styles.compactTimeSummary}>
          <CalendarDays size={15} color={palette.primaryDeep} />
          <Text style={styles.compactTimeValue} numberOfLines={1}>
            {formatDraftDateTimeLabel(value)}
          </Text>
        </View>
      </View>
      <View style={styles.compactPickerControls}>
        <CompactPickerButton label="날짜" selected={activePicker === 'date'} onPress={() => setActivePicker('date')} />
        <CompactPickerButton label="시간" selected={activePicker === 'time'} onPress={() => setActivePicker('time')} />
      </View>
      {activePicker ? (
        <DateTimePicker
          value={resolvedPickerValue}
          mode={activePicker}
          display={activePicker === 'time' ? 'spinner' : 'default'}
          accentColor={palette.primaryDeep}
          is24Hour
          positiveButton={{ label: '\uC120\uD0DD' }}
          negativeButton={{ label: '\uB2EB\uAE30' }}
          onDismiss={() => setActivePicker(null)}
          onValueChange={(_, selectedDate) => {
            onChange(mergeDraftDateTime(value, selectedDate, activePicker));

            if (Platform.OS === 'android') {
              setActivePicker(null);
            }
          }}
          style={styles.compactNativePicker}
        />
      ) : null}
    </View>
  );
}

function CompactPickerButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactPickerButton,
        selected && styles.selectedCompactPickerButton,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.compactPickerButtonText, selected && styles.selectedCompactPickerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function ColorPicker({
  compact,
  label,
  options = colorOptions,
  value,
  onChange,
}: {
  compact?: boolean;
  label: string;
  options?: ScheduleColorOption[];
  value: ScheduleColorKey;
  onChange: (value: ScheduleColorKey) => void;
}) {
  return (
    <View style={[styles.colorPickerShell, compact && styles.compactColorPickerShell]}>
      <Text style={styles.modalInputLabel}>{label}</Text>
      <View style={[styles.colorOptions, compact && styles.compactColorOptions]}>
        {options.map((option) => {
          const selected = option.key === value;

          return (
            <Pressable
              key={option.key}
              accessibilityLabel={`${option.label} 색상 선택`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.colorOption,
                compact && styles.compactColorOption,
                { backgroundColor: option.soft },
                selected && styles.selectedColorOption,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.colorSwatch, { backgroundColor: option.accent }]} />
              <Text style={styles.colorOptionText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ModalInput({
  compact,
  label,
  placeholder,
  value,
  onChangeText,
}: {
  compact?: boolean;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={[styles.modalInputShell, compact && styles.compactModalInputShell]}>
      <Text style={styles.modalInputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkSoft}
        style={[styles.modalInput, compact && styles.compactModalInput]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
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
    backgroundColor: palette.sky,
    height: 128,
    position: 'absolute',
    right: -38,
    top: -34,
    transform: [{ rotate: '-10deg' }],
    width: 94,
  },
  headerShapeMint: {
    backgroundColor: palette.amber,
    bottom: -24,
    height: 38,
    left: -44,
    position: 'absolute',
    transform: [{ rotate: '7deg' }],
    width: 124,
  },
  headerShapeLime: {
    backgroundColor: palette.mint,
    height: 76,
    position: 'absolute',
    right: 82,
    top: -22,
    transform: [{ rotate: '18deg' }],
    width: 48,
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
  modeTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  modeTab: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  selectedModeTab: {
    backgroundColor: palette.primary,
  },
  modeTabLabel: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  selectedModeTabLabel: {
    color: palette.onLight,
  },
  modeTabCount: {
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
  selectedModeTabCount: {
    backgroundColor: palette.surface,
    color: palette.primaryDeep,
  },
  todoWeekSurface: {
    backgroundColor: palette.surface,
    borderBottomColor: palette.line,
    borderBottomWidth: 1.5,
    borderTopColor: palette.line,
    borderTopWidth: 1.5,
    gap: spacing.xs,
    marginHorizontal: -spacing.md,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  todoWeekTop: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
  todoMonthTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  todoMonthTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  todoWeekdayRow: {
    flexDirection: 'row',
  },
  todoWeekdayLabel: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  todoWeekDateRow: {
    flexDirection: 'row',
    minHeight: 38,
  },
  todoWeekDateButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  todoTodayButton: {
    backgroundColor: palette.skySoft,
    borderRadius: radius.pill,
  },
  todoSelectedDateButton: {
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  todoWeekDateText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  todoSundayText: {
    color: palette.primaryDeep,
  },
  todoOutsideMonthText: {
    color: palette.inkSoft,
  },
  todoSelectedDateText: {
    color: palette.onLight,
  },
  calendarCard: {
    backgroundColor: palette.surface,
    gap: 6,
    padding: spacing.sm,
  },
  calendarTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.2,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  monthTitleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  monthTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  monthSubtitle: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  collapseButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  collapseText: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  weekHeader: {
    flexDirection: 'row',
    gap: 3,
  },
  weekdayLabel: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  calendarGrid: {
    gap: 3,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dayCell: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 7,
    borderWidth: 1.2,
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    minHeight: 31,
    paddingVertical: 2,
  },
  outsideDayCell: {
    backgroundColor: palette.surface,
    opacity: 0.55,
  },
  todayCell: {
    borderColor: palette.primaryDeep,
    borderWidth: 1.6,
  },
  selectedDayCell: {
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
  },
  dayNumber: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  outsideDayNumber: {
    color: palette.inkSoft,
  },
  selectedDayNumber: {
    color: palette.onLight,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 18,
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  emptyCountSlot: {
    height: 14,
    minWidth: 18,
  },
  selectedCountBadge: {
    backgroundColor: palette.surface,
  },
  countText: {
    color: palette.onLight,
    fontSize: 9,
    fontWeight: '900',
  },
  selectedCountText: {
    color: palette.primaryDeep,
  },
  contentStack: {
    gap: spacing.md,
  },
  syncText: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  addButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
  },
  emptyAddButton: {
    marginTop: spacing.xs,
  },
  addButtonText: {
    color: palette.primaryDeep,
    fontSize: 14,
    fontWeight: '900',
  },
  list: {
    gap: spacing.sm,
  },
  cardScheduleCard: {
    alignItems: 'center',
    backgroundColor: palette.coralSoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardScheduleInfoRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  cardResponsePanel: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  cardResponseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cardResponseTitle: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  cardResponseList: {
    gap: spacing.xs,
  },
  cardResponseRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardResponseAvatar: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  cardResponseAvatarText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  cardResponseCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cardResponseNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  cardResponseName: {
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  cardResponseChoiceBadge: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardResponseChoiceYes: {
    backgroundColor: palette.limeSoft,
  },
  cardResponseChoiceMaybe: {
    backgroundColor: palette.amberSoft,
  },
  cardResponseChoiceNo: {
    backgroundColor: palette.coralSoft,
  },
  cardResponseChoiceUnanswered: {
    backgroundColor: palette.surface,
  },
  cardResponseChoiceText: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  cardResponseComment: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  cardResponseCommentMuted: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  manualScheduleCard: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  manualDateBlock: {
    alignItems: 'center',
    backgroundColor: palette.sky,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    minWidth: 64,
    padding: spacing.sm,
  },
  manualDateMonth: {
    color: palette.onLight,
    fontSize: 12,
    fontWeight: '900',
  },
  manualDateDay: {
    color: palette.onLight,
    fontSize: 24,
    fontWeight: '900',
  },
  manualScheduleBody: {
    flex: 1,
    gap: spacing.xs,
  },
  manualScheduleTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  manualScheduleActionGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  manualScheduleTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    minWidth: 0,
  },
  iconActionButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  manualInfoRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  manualInfoText: {
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  todoPanel: {
    gap: spacing.sm,
    minHeight: 240,
  },
  todoDateHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 40,
  },
  todoDateTitle: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  todoDateMeta: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  todoDivider: {
    backgroundColor: palette.line,
    height: 1,
  },
  todoEmptyText: {
    color: palette.inkSoft,
    fontSize: 14,
    fontWeight: '900',
  },
  todoList: {
    gap: spacing.sm,
  },
  todoActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  todoActionButton: {
    flex: 1,
  },
  todoRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 68,
    padding: spacing.md,
  },
  doneTodoRow: {
    backgroundColor: palette.mintSoft,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  todoCheckButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: palette.lime,
  },
  todoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  todoEditButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 4,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: 66,
  },
  todoEditButtonText: {
    color: palette.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  todoTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  todoDetail: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  doneTodoText: {
    color: palette.inkMuted,
    textDecorationLine: 'line-through',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  emptyCopy: {
    flex: 1,
    gap: 4,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: modalOverlay.backdrop,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
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
  modalPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxHeight: '88%',
    maxWidth: 390,
    overflow: 'hidden',
    padding: spacing.md,
    width: '100%',
  },
  scheduleComposerPanel: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    maxHeight: '86%',
  },
  scheduleComposerKeyboardAvoider: {
    flex: 1,
  },
  scheduleComposerPressGuard: {
    flex: 1,
    justifyContent: 'center',
  },
  scheduleComposerFormScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
  },
  scheduleComposerForm: {
    paddingBottom: spacing.xs,
    width: '100%',
  },
  scheduleComposerFooter: {
    gap: spacing.xs,
    width: '100%',
  },
  dialogPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxWidth: 390,
    padding: spacing.lg,
    width: '100%',
  },
  dialogIcon: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dialogDangerIcon: {
    backgroundColor: palette.coralSoft,
  },
  dialogNoticeIcon: {
    backgroundColor: palette.amberSoft,
  },
  dialogCopy: {
    gap: spacing.xs,
  },
  dialogBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dialogActionButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  dialogPrimaryButton: {
    backgroundColor: palette.primary,
  },
  dialogSecondaryButton: {
    backgroundColor: palette.paper,
  },
  dialogDangerButton: {
    backgroundColor: palette.coralSoft,
  },
  dialogActionText: {
    color: palette.primaryDeep,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  dialogPrimaryActionText: {
    color: palette.onLight,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
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
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  modalForm: {
    gap: spacing.xs,
  },
  recurringTodoKeyboardAvoider: {
    flex: 1,
  },
  recurringTodoPressGuard: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  recurringTodoPanel: {
    height: '62%',
    maxHeight: '86%',
    overflow: 'hidden',
  },
  recurringTodoFormPanel: {
    gap: spacing.sm,
    height: '86%',
    padding: spacing.sm,
  },
  recurringTodoScroll: {
    flex: 1,
    flexShrink: 1,
    width: '100%',
  },
  recurringTodoScrollContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  recurringTodoFooter: {
    width: '100%',
  },
  recurringTodoFormBody: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  recurringTodoList: {
    gap: spacing.sm,
  },
  recurringTodoRow: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.sm,
  },
  recurringTodoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  recurringTodoTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  recurringTodoMeta: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  recurringTodoDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 8,
  },
  recurringTodoDeleteText: {
    color: palette.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  recurringTodoEmptyText: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    padding: spacing.sm,
  },
  recurringTodoForm: {
    gap: spacing.xs,
    width: '100%',
  },
  compactTimeShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compactTimeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  compactTimeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 50,
  },
  compactTimeSummary: {
    alignItems: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  compactTimeValue: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  compactPickerControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  compactPickerButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  selectedCompactPickerButton: {
    backgroundColor: palette.primary,
  },
  compactPickerButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  selectedCompactPickerButtonText: {
    color: palette.onLight,
  },
  compactNativePicker: {
    alignSelf: 'stretch',
  },
  weekdayPickerShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recurringWeekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recurringWeekdayButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    width: 38,
  },
  selectedRecurringWeekdayButton: {
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderWidth: 2,
  },
  recurringWeekdayText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  selectedRecurringWeekdayText: {
    color: palette.onLight,
  },
  modalInputShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactModalInputShell: {
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modalInputLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  modalInput: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    minHeight: 34,
    padding: 0,
  },
  compactModalInput: {
    fontSize: 15,
    minHeight: 28,
  },
  colorPickerShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactColorPickerShell: {
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  compactColorOptions: {
    gap: 6,
  },
  colorOption: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  compactColorOption: {
    minHeight: 30,
    paddingHorizontal: spacing.xs,
  },
  selectedColorOption: {
    borderColor: palette.primaryDeep,
    borderWidth: 2,
  },
  colorSwatch: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  colorOptionText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  modalSubmitButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalActionButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
  },
  modalDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
  },
  disabledSubmitButton: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
  },
  modalSubmitText: {
    color: palette.onLight,
    fontSize: 15,
    fontWeight: '900',
  },
  modalDeleteText: {
    color: palette.primaryDeep,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledSubmitText: {
    color: palette.inkDisabled,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
