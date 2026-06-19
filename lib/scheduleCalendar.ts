import type { ScheduleItem } from '@/types/promise';

export interface CalendarCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function getScheduleDate(item: ScheduleItem, fallbackYear: number) {
  const match = item.dateLabel.match(/(\d+)\s*월\s*(\d+)\s*일/);

  if (!match) {
    return new Date(fallbackYear, 0, 1);
  }

  return new Date(fallbackYear, Number(match[1]) - 1, Number(match[2]));
}

export function getScheduleCounts(items: ScheduleItem[], fallbackYear: number) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = toDateKey(getScheduleDate(item, fallbackYear));

    return {
      ...counts,
      [key]: (counts[key] ?? 0) + 1,
    };
  }, {});
}

export function getCalendarRows(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: CalendarCell[] = Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(year, month, index - startOffset + 1);

    return {
      date,
      key: toDateKey(date),
      inCurrentMonth: date.getMonth() === month,
    };
  });
  const rows: CalendarCell[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }

  return rows;
}

export function getVisibleCalendarRows(monthDate: Date, selectedDate: Date, expanded: boolean) {
  const rows = getCalendarRows(monthDate);

  if (expanded) {
    return rows;
  }

  const selectedKey = toDateKey(selectedDate);
  return rows.filter((row) => row.some((cell) => cell.key === selectedKey)).slice(0, 1);
}

export function getWeekCells(selectedDate: Date) {
  const selectedDay = startOfDay(selectedDate);
  const weekStart = new Date(
    selectedDay.getFullYear(),
    selectedDay.getMonth(),
    selectedDay.getDate() - selectedDay.getDay(),
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);

    return {
      date,
      key: toDateKey(date),
      inCurrentMonth: date.getMonth() === selectedDay.getMonth(),
    };
  });
}

export function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatSelectedDate(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function compareScheduleItems(left: ScheduleItem, right: ScheduleItem) {
  return getScheduleStartMinute(left) - getScheduleStartMinute(right);
}

function getScheduleStartMinute(item: ScheduleItem) {
  const match = item.timeLabel.match(/(\d{1,2}):(\d{2})/);

  if (!match) {
    return 0;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}
