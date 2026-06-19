import { describe, expect, it } from 'vitest';

import { mockPromiseRepository } from '@/data/mockPromiseRepository';

describe('mockPromiseRepository', () => {
  it('keeps a direct received card pending after a response so the creator can confirm it', async () => {
    const respondedCard = await mockPromiseRepository.respondToReceivedCard({
      cardId: 'card-seongsu-cafe',
      responses: [{ candidateId: 'slot-seongsu-cafe-1930', choice: 'YES' }],
    });

    expect(respondedCard.status).toBe('PENDING');
    expect(respondedCard.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'host-minseo',
          displayName: '민서',
          choice: 'YES',
        }),
      ]),
    );
  });
});
