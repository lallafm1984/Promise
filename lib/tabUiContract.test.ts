import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readAppFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('bottom tab UI contract', () => {
  it('keeps visible bottom tabs in the requested product order', () => {
    const source = readAppFile('app/(tabs)/_layout.tsx');
    const visibleScreens = Array.from(source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g))
      .map((match) => match[1])
      .filter((name) => name !== 'index');

    expect(visibleScreens).toEqual(['create', 'manage', 'schedule', 'friends', 'profile']);
  });
});

describe('schedule and friends surface notices', () => {
  it('does not show the account-save notice on schedule or friends screens', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');

    expect(scheduleSource).not.toContain('StorageModeNotice');
    expect(friendsSource).not.toContain('StorageModeNotice');
  });
});

describe('friends empty state', () => {
  it('keeps the no-friends empty card informational without an inline add button', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const emptyStateStart = source.indexOf('title="아직 친구가 없어요"');
    const emptyStateEnd = source.indexOf('/>', emptyStateStart);
    const emptyStateBlock = source.slice(emptyStateStart, emptyStateEnd);

    expect(emptyStateStart).toBeGreaterThan(-1);
    expect(emptyStateBlock).not.toContain('actionLabel');
    expect(emptyStateBlock).not.toContain('onAction');
  });
});
