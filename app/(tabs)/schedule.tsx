import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  MapPin,
  Plus,
  X,
} from 'lucide-react-native';

import { CandidateTimeFields } from '@/components/card-menu';
import { AppScreen, Card, Chip, SectionHeader, StorageModeNotice } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { usePromiseData } from '@/hooks/usePromiseData';
import { useSchedulePlanner } from '@/hooks/useSchedulePlanner';
import { getCandidateEndsAt } from '@/lib/cardMenu';
import {
  compareScheduleItems,
  formatMonthTitle,
  formatSelectedDate,
  getScheduleCounts,
  getScheduleDate,
  getVisibleCalendarRows,
  getWeekCells,
  startOfDay,
  toDateKey,
} from '@/lib/scheduleCalendar';
import type { DisplayScheduleItem, ScheduleColorKey, TodoItem } from '@/types/promise';

type ScheduleMode = 'SCHEDULE' | 'TODO';

const colorOptions: Array<{
  key: ScheduleColorKey;
  label: string;
  soft: string;
  accent: string;
}> = [
  { key: 'coral', label: '코랄', soft: palette.coralSoft, accent: palette.coral },
  { key: 'mint', label: '민트', soft: palette.mintSoft, accent: palette.mint },
  { key: 'lime', label: '라임', soft: palette.limeSoft, accent: palette.lime },
  { key: 'sky', label: '스카이', soft: palette.skySoft, accent: palette.sky },
  { key: 'amber', label: '앰버', soft: palette.amberSoft, accent: palette.amber },
];

function getScheduleColor(key: ScheduleColorKey = 'sky') {
  return colorOptions.find((option) => option.key === key) ?? colorOptions[3];
}

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
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
  const { scheduleItems } = usePromiseData();
  const {
    manualScheduleItems,
    todos,
    isLoading: plannerLoading,
    isMutating,
    persisted: plannerPersisted,
    error: plannerError,
    createManualScheduleItem,
    createTodo,
    toggleTodo: saveTodoToggle,
  } = useSchedulePlanner();
  const [activeMode, setActiveMode] = useState<ScheduleMode>('SCHEDULE');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [composerMode, setComposerMode] = useState<ScheduleMode | null>(null);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleColor, setScheduleColor] = useState<ScheduleColorKey>('sky');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDetail, setTodoDetail] = useState('');
  const [todoColor, setTodoColor] = useState<ScheduleColorKey>('coral');
  const [isWeekTransitioning, setIsWeekTransitioning] = useState(false);
  const calendarMotion = useRef(new Animated.Value(1)).current;
  const contentMotion = useRef(new Animated.Value(1)).current;
  const weekDragX = useRef(new Animated.Value(0)).current;
  const selectedDateKey = toDateKey(selectedDate);
  const visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const todoWeekCells = useMemo(() => getWeekCells(selectedDate), [selectedDate]);
  const cardScheduleItems = useMemo<DisplayScheduleItem[]>(
    () => scheduleItems.map((item) => ({ ...item, source: 'CARD' })),
    [scheduleItems],
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
      todos.reduce<Record<string, number>>((counts, todo) => {
        return {
          ...counts,
          [todo.dateKey]: (counts[todo.dateKey] ?? 0) + 1,
        };
      }, {}),
    [todos],
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
    () =>
      todos
        .filter((todo) => todo.dateKey === selectedDateKey)
        .sort((left, right) => Number(left.done) - Number(right.done)),
    [selectedDateKey, todos],
  );
  const openTodoCount = selectedTodos.filter((todo) => !todo.done).length;
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
    setScheduleTitle('');
    setScheduleTime(createScheduleTimeForDate(selectedDate));
    setScheduleLocation('');
    setScheduleColor('sky');
    setComposerMode('SCHEDULE');
  }

  async function submitScheduleItem() {
    const title = scheduleTitle.trim();

    if (title.length === 0) {
      return;
    }

    const startsAt = scheduleTime || createScheduleTimeForDate(selectedDate);

    try {
      await createManualScheduleItem({
        title,
        location: scheduleLocation.trim() || '장소 미정',
        startsAt,
        endsAt: getCandidateEndsAt(startsAt),
        colorKey: scheduleColor,
      });
      setComposerMode(null);
      runMotionFeedback(contentMotion);
    } catch {
      runMotionFeedback(contentMotion);
    }
  }

  function openTodoComposer() {
    setTodoTitle('');
    setTodoDetail('');
    setTodoColor('coral');
    setComposerMode('TODO');
  }

  async function submitTodoItem() {
    const title = todoTitle.trim();

    if (title.length === 0) {
      return;
    }

    try {
      await createTodo({
        dateKey: selectedDateKey,
        title,
        detail: todoDetail.trim() || '오늘 중',
        colorKey: todoColor,
      });
      setComposerMode(null);
      runMotionFeedback(contentMotion);
    } catch {
      runMotionFeedback(contentMotion);
    }
  }

  function toggleTodo(todoId: string) {
    void saveTodoToggle(todoId)
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
      <AppScreen>
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

      <StorageModeNotice persisted={plannerPersisted} surface="schedule" />

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
        {plannerError ? <Text style={styles.errorText}>{plannerError}</Text> : null}
        {activeMode === 'SCHEDULE' ? (
          <SchedulePanel selectedDate={selectedDate} selectedItems={selectedItems} onAdd={openScheduleComposer} />
        ) : (
          <TodoPanel
            openCount={openTodoCount}
            selectedDate={selectedDate}
            selectedTodos={selectedTodos}
            onAdd={openTodoComposer}
            onToggle={toggleTodo}
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
        isSubmitting={isMutating}
        selectedDate={selectedDate}
        todoColor={todoColor}
        todoDetail={todoDetail}
        todoTitle={todoTitle}
        onChangeScheduleColor={setScheduleColor}
        onChangeScheduleLocation={setScheduleLocation}
        onChangeScheduleTime={setScheduleTime}
        onChangeScheduleTitle={setScheduleTitle}
        onChangeTodoColor={setTodoColor}
        onChangeTodoDetail={setTodoDetail}
        onChangeTodoTitle={setTodoTitle}
        onClose={() => setComposerMode(null)}
        onSubmitSchedule={submitScheduleItem}
        onSubmitTodo={submitTodoItem}
      />
    </>
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
  selectedDate,
  selectedItems,
  onAdd,
}: {
  selectedDate: Date;
  selectedItems: DisplayScheduleItem[];
  onAdd: () => void;
}) {
  return (
    <>
      <SectionHeader title={`${formatSelectedDate(selectedDate)} 일정`} action={`${selectedItems.length}개`} />
      {selectedItems.length > 0 ? (
        <View style={styles.list}>
          {selectedItems.map((item) => (
            <ScheduleItemCard key={item.id} item={item} />
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
          </View>
        </Card>
      )}
      <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
        <Plus size={17} color={palette.primaryDeep} />
        <Text style={styles.addButtonText}>일정 추가</Text>
      </Pressable>
    </>
  );
}

function ScheduleItemCard({ item }: { item: DisplayScheduleItem }) {
  if (item.source === 'CARD') {
    return (
      <Card style={styles.cardScheduleCard}>
        <View style={styles.cardScheduleDateBlock}>
          <Text style={styles.cardScheduleDateMonth}>{item.dateLabel.split(' ')[0]}</Text>
          <Text style={styles.cardScheduleDateDay}>{item.dateLabel.split(' ')[1]}</Text>
        </View>
        <View style={styles.manualScheduleBody}>
          <View style={styles.manualScheduleTop}>
            <Text style={styles.manualScheduleTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Chip label="카드 생성" tone="lime" />
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

  const color = getScheduleColor(item.colorKey);

  return (
    <Card style={[styles.manualScheduleCard, { backgroundColor: color.soft }]}>
      <View style={[styles.manualDateBlock, { backgroundColor: color.accent }]}>
        <Text style={styles.manualDateMonth}>{item.dateLabel.split(' ')[0]}</Text>
        <Text style={styles.manualDateDay}>{item.dateLabel.split(' ')[1]}</Text>
      </View>
      <View style={styles.manualScheduleBody}>
        <View style={styles.manualScheduleTop}>
          <Text style={styles.manualScheduleTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Chip label="직접 추가" tone="sky" />
        </View>
        <View style={styles.manualInfoRow}>
          <Clock3 size={15} color={palette.primaryDeep} />
          <Text style={styles.manualInfoText}>{item.timeLabel}</Text>
        </View>
        <View style={styles.manualInfoRow}>
          <MapPin size={15} color={palette.primaryDeep} />
          <Text style={styles.manualInfoText}>{item.location}</Text>
        </View>
      </View>
    </Card>
  );
}

function TodoPanel({
  openCount,
  selectedDate,
  selectedTodos,
  onAdd,
  onToggle,
}: {
  openCount: number;
  selectedDate: Date;
  selectedTodos: TodoItem[];
  onAdd: () => void;
  onToggle: (todoId: string) => void;
}) {
  return (
    <View style={styles.todoPanel}>
      <View style={styles.todoDateHeader}>
        <Text style={styles.todoDateTitle}>{formatTodoDayTitle(selectedDate)}</Text>
        <Text style={styles.todoDateMeta}>{openCount > 0 ? `${openCount}개 남음` : ''}</Text>
      </View>
      <View style={styles.todoDivider} />

      {selectedTodos.length > 0 ? (
        <View style={styles.todoList}>
          {selectedTodos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onToggle={() => onToggle(todo.id)} />
          ))}
        </View>
      ) : (
        <Text style={styles.todoEmptyText}>이날의 할일이 없습니다.</Text>
      )}

      <Pressable
        accessibilityLabel="할일 추가"
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [styles.addButton, styles.todoAddButton, pressed && styles.pressed]}>
        <Plus size={17} color={palette.primaryDeep} />
        <Text style={styles.addButtonText}>할일 추가</Text>
      </Pressable>
    </View>
  );
}

function TodoRow({ todo, onToggle }: { todo: TodoItem; onToggle: () => void }) {
  const color = getScheduleColor(todo.colorKey);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: todo.done }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.todoRow,
        { backgroundColor: todo.done ? palette.mintSoft : color.soft },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.checkbox, todo.done && styles.checkedBox]}>
        {todo.done ? <Check size={16} color={palette.onLight} /> : null}
      </View>
      <View style={styles.todoCopy}>
        <Text style={[styles.todoTitle, todo.done && styles.doneTodoText]}>{todo.title}</Text>
        <Text style={[styles.todoDetail, todo.done && styles.doneTodoText]}>{todo.detail}</Text>
      </View>
    </Pressable>
  );
}

function ComposerModal({
  mode,
  scheduleColor,
  scheduleLocation,
  scheduleTime,
  scheduleTitle,
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
  onSubmitSchedule,
  onSubmitTodo,
}: {
  mode: ScheduleMode | null;
  scheduleColor: ScheduleColorKey;
  scheduleLocation: string;
  scheduleTime: string;
  scheduleTitle: string;
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
  onSubmitSchedule: () => void;
  onSubmitTodo: () => void;
}) {
  const isSchedule = mode === 'SCHEDULE';
  const title = isSchedule ? '일정 추가' : '할일 추가';
  const disabled = isSubmitting || (isSchedule ? scheduleTitle.trim().length === 0 : todoTitle.trim().length === 0);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={mode !== null}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalKicker}>{formatSelectedDate(selectedDate)}</Text>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <Pressable
              accessibilityLabel={`${title} 닫기`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
              <X size={19} color={palette.primaryDeep} />
            </Pressable>
          </View>

          {isSchedule ? (
            <View style={styles.modalForm}>
              <ModalInput
                label="일정 이름"
                placeholder="예: 저녁 약속"
                value={scheduleTitle}
                onChangeText={onChangeScheduleTitle}
              />
              <CandidateTimeFields
                mode="DIRECT"
                times={[scheduleTime || createScheduleTimeForDate(selectedDate)]}
                onChangeTime={(_, value) => onChangeScheduleTime(value)}
                onAdd={() => undefined}
                onRemove={() => undefined}
              />
              <ModalInput
                label="장소"
                placeholder="예: 성수 밥집"
                value={scheduleLocation}
                onChangeText={onChangeScheduleLocation}
              />
              <ColorPicker
                label="카드 색상"
                value={scheduleColor}
                onChange={onChangeScheduleColor}
              />
            </View>
          ) : (
            <View style={styles.modalForm}>
              <ModalInput
                label="할일"
                placeholder="예: 참석자에게 위치 보내기"
                value={todoTitle}
                onChangeText={onChangeTodoTitle}
              />
              <ModalInput
                label="메모"
                placeholder="예: 오늘 중"
                value={todoDetail}
                onChangeText={onChangeTodoDetail}
              />
              <ColorPicker
                label="카드 색상"
                value={todoColor}
                onChange={onChangeTodoColor}
              />
            </View>
          )}

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
              {isSubmitting ? '저장 중' : '등록'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ScheduleColorKey;
  onChange: (value: ScheduleColorKey) => void;
}) {
  return (
    <View style={styles.colorPickerShell}>
      <Text style={styles.modalInputLabel}>{label}</Text>
      <View style={styles.colorOptions}>
        {colorOptions.map((option) => {
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
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.modalInputShell}>
      <Text style={styles.modalInputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkSoft}
        style={styles.modalInput}
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
    bottom: 18,
    height: 38,
    left: -12,
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
  errorText: {
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
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
    backgroundColor: palette.mintSoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardScheduleDateBlock: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    minWidth: 64,
    padding: spacing.sm,
  },
  cardScheduleDateMonth: {
    color: palette.onLight,
    fontSize: 12,
    fontWeight: '900',
  },
  cardScheduleDateDay: {
    color: palette.onLight,
    fontSize: 24,
    fontWeight: '900',
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
  manualScheduleTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
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
  todoAddButton: {
    marginTop: spacing.xs,
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
  checkedBox: {
    backgroundColor: palette.lime,
  },
  todoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
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
    backgroundColor: 'rgba(75, 52, 40, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
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
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalForm: {
    gap: spacing.sm,
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
  colorPickerShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
  disabledSubmitButton: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
  },
  modalSubmitText: {
    color: palette.onLight,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledSubmitText: {
    color: palette.inkSoft,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
