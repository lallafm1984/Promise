import { describe, expect, it } from 'vitest';

import { mockPromiseRepository } from '@/data/mockPromiseRepository';

describe('mockPromiseRepository', () => {
  it('keeps a direct received card pending after a response so the creator can confirm it', async () => {
    const respondedCard = await mockPromiseRepository.respondToReceivedCard({
      cardId: 'card-seongsu-cafe',
      respondentComment: '조금 늦을 수 있어요',
      responses: [{ candidateId: 'slot-seongsu-cafe-1930', choice: 'YES' }],
    });

    expect(respondedCard.status).toBe('PENDING');
    expect(respondedCard.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'host-minseo',
          displayName: '민서',
          comment: '조금 늦을 수 있어요',
          choice: 'YES',
        }),
      ]),
    );
  });
});
