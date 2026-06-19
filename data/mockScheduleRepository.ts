import { getCandidateEndsAt } from '@/lib/cardMenu';
import { formatSelectedDate } from '@/lib/scheduleCalendar';
import type {
  CreateManualScheduleInput,
  CreateTodoInput,
  DisplayScheduleItem,
  SchedulePlannerRepository,
  TodoItem,
} from '@/types/promise';

const fallbackTodos: TodoItem[] = [
  {
    id: 'todo-today-response',
    dateKey: '2026-06-15',
    title: '성수 밥집 후보 응답 확인',
    detail: '저녁 전까지',
    done: false,
    colorKey: 'coral',
  },
  {
    id: 'todo-seongsu-message',
    dateKey: '2026-06-14',
    title: '성수 카페 위치 링크 보내기',
    detail: '약속 30분 전',
    done: true,
    colorKey: 'mint',
  },
  {
    id: 'todo-gangnam-ticket',
    dateKey: '2026-06-20',
    title: '영화 예매 번호 챙기기',
    detail: '16:30까지',
    done: false,
    colorKey: 'sky',
  },
];

let manualScheduleItems: DisplayScheduleItem[] = [];
let todos = fallbackTodos;

function padTwo(value: number) {
  return String(value).padStart(2, '0');
}

function formatScheduleTimeLabel(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime())) {
    return '시간 미정';
  }

  if (Number.isNaN(end.getTime())) {
    return `${padTwo(start.getHours())}:${padTwo(start.getMinutes())}`;
  }

  return `${padTwo(start.getHours())}:${padTwo(start.getMinutes())} - ${padTwo(end.getHours())}:${padTwo(
    end.getMinutes(),
  )}`;
}

function mapManualSchedule(input: CreateManualScheduleInput, id = `local-schedule-${Date.now()}`): DisplayScheduleItem {
  const startsAt = input.startsAt;
  const endsAt = input.endsAt || getCandidateEndsAt(startsAt);
  const startsAtDate = new Date(startsAt);

  return {
    id,
    cardId: id,
    title: input.title.trim(),
    startsAt,
    endsAt,
    dateLabel: Number.isNaN(startsAtDate.getTime()) ? '날짜 미정' : formatSelectedDate(startsAtDate),
    timeLabel: formatScheduleTimeLabel(startsAt, endsAt),
    location: input.location.trim() || '장소 미정',
    status: 'READY',
    source: 'MANUAL',
    colorKey: input.colorKey,
  };
}

export const mockScheduleRepository: SchedulePlannerRepository = {
  async listManualScheduleItems() {
    return manualScheduleItems;
  },
  async createManualScheduleItem(input) {
    const item = mapManualSchedule(input);
    manualScheduleItems = [item, ...manualScheduleItems];
    return item;
  },
  async updateManualScheduleItem(scheduleId, input) {
    const item = mapManualSchedule(input, scheduleId);
    let updated = false;
    manualScheduleItems = manualScheduleItems.map((currentItem) => {
      if (currentItem.id !== scheduleId) {
        return currentItem;
      }

      updated = true;
      return item;
    });

    if (!updated) {
      throw new Error('일정을 찾지 못했어요.');
    }

    return item;
  },
  async deleteManualScheduleItem(scheduleId) {
    const previousLength = manualScheduleItems.length;
    manualScheduleItems = manualScheduleItems.filter((item) => item.id !== scheduleId);

    if (manualScheduleItems.length === previousLength) {
      throw new Error('일정을 찾지 못했어요.');
    }
  },
  async listTodos() {
    return todos;
  },
  async createTodo(input) {
    const todo: TodoItem = {
      id: `local-todo-${Date.now()}`,
      dateKey: input.dateKey,
      title: input.title.trim(),
      detail: input.detail.trim() || '오늘 중',
      done: false,
      colorKey: input.colorKey,
    };
    todos = [todo, ...todos];
    return todo;
  },
  async toggleTodo(todoId) {
    let toggledTodo: TodoItem | undefined;
    todos = todos.map((todo) => {
      if (todo.id !== todoId) {
        return todo;
      }

      toggledTodo = { ...todo, done: !todo.done };
      return toggledTodo;
    });

    if (!toggledTodo) {
      throw new Error('할일을 찾지 못했어요.');
    }

    return toggledTodo;
  },
};
