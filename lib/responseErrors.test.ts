import { describe, expect, it } from 'vitest';

import {
  RECEIVED_CARD_RESPONSE_UNAVAILABLE_MESSAGE,
  createReceivedCardResponseUnavailableError,
  getReceivedCardResponseErrorMessage,
  isReceivedCardResponseUnavailableError,
} from './responseErrors';

describe('received card response errors', () => {
  it('marks stale or unavailable received-card responses with user-facing copy', () => {
    const error = createReceivedCardResponseUnavailableError('deleted');

    expect(isReceivedCardResponseUnavailableError(error)).toBe(true);
    expect(getReceivedCardResponseErrorMessage(error)).toBe(RECEIVED_CARD_RESPONSE_UNAVAILABLE_MESSAGE);
    expect(getReceivedCardResponseErrorMessage(error)).toBe('이 카드는 삭제되었거나 더 이상 응답할 수 없어요.');
    expect(getReceivedCardResponseErrorMessage(error)).not.toContain('받은 카드 목록을 새로고침했어요');
  });

  it('uses a retryable fallback for unexpected response failures', () => {
    expect(getReceivedCardResponseErrorMessage(new Error('network'))).toBe(
      '응답을 보내지 못했어요. 카드 상태를 새로고침한 뒤 다시 확인해 주세요.',
    );
  });
});
