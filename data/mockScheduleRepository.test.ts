import { describe, expect, it } from 'vitest';

import { mockScheduleRepository } from './mockScheduleRepository';

function getTestEndsAt(startsAt: string) {
  return new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
}

describe('mock schedule repository', () => {
  it('updates a manually registered schedule item without duplicating it', async () => {
    const created = await mockScheduleRepository.createManualScheduleItem({
      title: 'before',
      startsAt: '2026-06-19T10:00:00.000Z',
      endsAt: getTestEndsAt('2026-06-19T10:00:00.000Z'),
      location: 'old place',
      colorKey: 'sky',
    });

    const updated = await mockScheduleRepository.updateManualScheduleItem(created.id, {
      title: 'after',
      startsAt: '2026-06-20T11:00:00.000Z',
      endsAt: getTestEndsAt('2026-06-20T11:00:00.000Z'),
      location: 'new place',
      colorKey: 'coral',
    });
    const items = await mockScheduleRepository.listManualScheduleItems();

    expect(updated).toMatchObject({
      id: created.id,
      title: 'after',
      location: 'new place',
      colorKey: 'coral',
      source: 'MANUAL',
    });
    expect(items.filter((item) => item.id === created.id)).toHaveLength(1);
  });

  it('deletes a manually registered schedule item', async () => {
    const created = await mockScheduleRepository.createManualScheduleItem({
      title: 'delete me',
      startsAt: '2026-06-21T10:00:00.000Z',
      endsAt: getTestEndsAt('2026-06-21T10:00:00.000Z'),
      location: 'place',
      colorKey: 'mint',
    });

    await mockScheduleRepository.deleteManualScheduleItem(created.id);
    const items = await mockScheduleRepository.listManualScheduleItems();

    expect(items.some((item) => item.id === created.id)).toBe(false);
  });
});
