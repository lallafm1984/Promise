import { describe, expect, it } from 'vitest';

import { getCalendarRows, getVisibleCalendarRows, getWeekCells, parseDateKey, toDateKey } from './scheduleCalendar';

describe('schedule calendar', () => {
  it('stops at the final week needed for the visible month', () => {
    const rows = getCalendarRows(new Date(2026, 5, 1));
    const lastRow = rows.at(-1);

    expect(rows).toHaveLength(5);
    expect(lastRow?.map((cell) => toDateKey(cell.date))).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('returns only the selected week when collapsed', () => {
    const rows = getVisibleCalendarRows(new Date(2026, 5, 1), new Date(2026, 5, 20), false);

    expect(rows).toHaveLength(1);
    expect(rows[0].map((cell) => toDateKey(cell.date))).toEqual([
      '2026-06-14',
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
      '2026-06-18',
      '2026-06-19',
      '2026-06-20',
    ]);
  });

  it('builds a Sunday-start week strip around the selected date', () => {
    const cells = getWeekCells(new Date(2026, 6, 6));

    expect(cells.map((cell) => toDateKey(cell.date))).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
    ]);
  });

  it('parses route date keys without accepting invalid calendar dates', () => {
    const parsedDate = parseDateKey('2026-06-20');

    expect(parsedDate ? toDateKey(parsedDate) : null).toBe('2026-06-20');
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026/06/20')).toBeNull();
  });
});
