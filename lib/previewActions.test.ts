import { describe, expect, it, vi } from 'vitest';

import {
  LOGIN_REQUIRED_PREVIEW_CARD_MESSAGE,
  UNSHAREABLE_PREVIEW_CARD_MESSAGE,
  getShareablePreviewCard,
  isShareablePublicCard,
} from './previewActions';
import type { PromiseCard } from '@/types/promise';

const previewCard: PromiseCard = {
  id: 'local-preview',
  mode: 'DIRECT',
  status: 'DRAFT',
  title: 'Dinner plan',
  hostName: 'Host',
  location: 'Cafe',
  message: 'See you there',
  sharedUrl: 'https://whenbollae.app/c/local-preview',
  createdAt: '2026-06-17T16:00:00+09:00',
  candidates: [],
  participants: [],
};

describe('preview actions', () => {
  it('identifies only persisted-looking public cards as shareable', () => {
    expect(
      isShareablePublicCard({
        ...previewCard,
        id: 'saved-preview',
        sharedUrl: 'https://whenbollae.app/c/saved-preview',
      }),
    ).toBe(true);
    expect(isShareablePublicCard(previewCard)).toBe(false);
    expect(
      isShareablePublicCard({
        ...previewCard,
        id: 'saved-preview',
        sharedUrl: 'https://whenbollae.app/c/local-1781756316542',
      }),
    ).toBe(false);
  });

  it('uses the persisted card when publishing succeeds', async () => {
    const savedCard = {
      ...previewCard,
      id: 'saved-preview',
      sharedUrl: 'https://whenbollae.app/c/saved-preview',
    };

    const result = await getShareablePreviewCard(previewCard, async () => ({
      card: savedCard,
      persisted: true,
    }));

    expect(result.card).toBe(savedCard);
    expect(result.persisted).toBe(true);
    expect(result.publishFailed).toBe(false);
    expect(result.saveFailed).toBeUndefined();
  });

  it('blocks sharing when publishing falls back to a local card', async () => {
    const savedCard = {
      ...previewCard,
      status: 'PENDING' as const,
    };

    await expect(
      getShareablePreviewCard(previewCard, async () => ({
        card: savedCard,
        persisted: false,
        saveFailed: true,
      })),
    ).rejects.toThrow(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
  });

  it('explains that login is required when publishing only creates a local card', async () => {
    await expect(
      getShareablePreviewCard(previewCard, async () => ({
        card: previewCard,
        persisted: false,
      })),
    ).rejects.toThrow(LOGIN_REQUIRED_PREVIEW_CARD_MESSAGE);
  });

  it('blocks sharing when a publish result still has a local token URL', async () => {
    const savedCard = {
      ...previewCard,
      id: 'saved-preview',
      status: 'PENDING' as const,
      sharedUrl: 'https://whenbollae.app/c/local-1781756316542',
    };

    await expect(
      getShareablePreviewCard(previewCard, async () => ({
        card: savedCard,
        persisted: true,
      })),
    ).rejects.toThrow(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
  });

  it('blocks sharing when publishing fails', async () => {
    const publish = vi.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(getShareablePreviewCard(previewCard, publish)).rejects.toThrow(
      UNSHAREABLE_PREVIEW_CARD_MESSAGE,
    );

    expect(publish).toHaveBeenCalledWith(previewCard);
  });
});
