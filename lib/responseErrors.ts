export const RECEIVED_CARD_RESPONSE_UNAVAILABLE_MESSAGE =
  '이 카드는 삭제되었거나 더 이상 응답할 수 없어요.';

const GENERIC_RECEIVED_CARD_RESPONSE_ERROR_MESSAGE =
  '응답을 보내지 못했어요. 카드 상태를 새로고침한 뒤 다시 확인해 주세요.';

export type ReceivedCardResponseUnavailableReason =
  | 'deleted'
  | 'closed'
  | 'expired'
  | 'changed'
  | 'mutation-stale';

export class ReceivedCardResponseUnavailableError extends Error {
  readonly code = 'RECEIVED_CARD_RESPONSE_UNAVAILABLE';
  readonly reason: ReceivedCardResponseUnavailableReason;

  constructor(reason: ReceivedCardResponseUnavailableReason) {
    super(RECEIVED_CARD_RESPONSE_UNAVAILABLE_MESSAGE);
    this.name = 'ReceivedCardResponseUnavailableError';
    this.reason = reason;
  }
}

export function createReceivedCardResponseUnavailableError(reason: ReceivedCardResponseUnavailableReason) {
  return new ReceivedCardResponseUnavailableError(reason);
}

export function isReceivedCardResponseUnavailableError(
  error: unknown,
): error is ReceivedCardResponseUnavailableError {
  return (
    error instanceof ReceivedCardResponseUnavailableError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'RECEIVED_CARD_RESPONSE_UNAVAILABLE')
  );
}

export function getReceivedCardResponseErrorMessage(error: unknown) {
  return isReceivedCardResponseUnavailableError(error)
    ? RECEIVED_CARD_RESPONSE_UNAVAILABLE_MESSAGE
    : GENERIC_RECEIVED_CARD_RESPONSE_ERROR_MESSAGE;
}
