import type { PromiseCard } from '@/types/promise';

interface PreviewPublishResult {
  card: PromiseCard;
  persisted: boolean;
  saveFailed?: boolean;
}

interface ShareablePreviewCardResult extends PreviewPublishResult {
  publishFailed: boolean;
}

export const UNSHAREABLE_PREVIEW_CARD_MESSAGE =
  '카드를 저장하지 못했어요. 로그인과 네트워크 상태를 확인해 주세요.';
export const LOGIN_REQUIRED_PREVIEW_CARD_MESSAGE =
  '공유 링크를 만들려면 먼저 로그인해 주세요.';

function isLocalPreviewCard(card: PromiseCard) {
  return card.id.startsWith('local-') || /\/c\/local-[^/?#]*/.test(card.sharedUrl);
}

export function isShareablePublicCard(card: PromiseCard) {
  return !isLocalPreviewCard(card);
}

function getUnshareablePreviewCardMessage(result: PreviewPublishResult) {
  if (!result.persisted && !result.saveFailed) {
    return LOGIN_REQUIRED_PREVIEW_CARD_MESSAGE;
  }

  return UNSHAREABLE_PREVIEW_CARD_MESSAGE;
}

export async function getShareablePreviewCard(
  card: PromiseCard,
  publish: (card: PromiseCard) => Promise<PreviewPublishResult>,
): Promise<ShareablePreviewCardResult> {
  try {
    const result = await publish(card);

    if (!result.persisted || result.saveFailed || !isShareablePublicCard(result.card)) {
      throw new Error(getUnshareablePreviewCardMessage(result));
    }

    return {
      ...result,
      publishFailed: false,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === LOGIN_REQUIRED_PREVIEW_CARD_MESSAGE ||
        error.message === UNSHAREABLE_PREVIEW_CARD_MESSAGE)
    ) {
      throw error;
    }

    throw new Error(UNSHAREABLE_PREVIEW_CARD_MESSAGE);
  }
}
