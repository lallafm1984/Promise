import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRepositorySource() {
  return readFileSync(resolve(process.cwd(), 'data/supabasePromiseRepository.ts'), 'utf8');
}

describe('supabase promise repository card change reset', () => {
  it('deletes stale candidate responses before deleting respondents and candidates', () => {
    const source = readRepositorySource();
    const requestChangeStart = source.indexOf('async requestManagedCardChange(card)');
    const requestChangeEnd = source.indexOf('async deleteManagedCard', requestChangeStart);
    const requestChangeBlock = source.slice(requestChangeStart, requestChangeEnd);
    const responseDeleteStart = requestChangeBlock.indexOf(".from('appointment_candidate_responses')");
    const respondentDeleteStart = requestChangeBlock.indexOf('const { error: respondentDeleteError }');
    const candidateDeleteStart = requestChangeBlock.indexOf('const { error: candidateDeleteError }');

    expect(requestChangeStart).toBeGreaterThan(-1);
    expect(responseDeleteStart).toBeGreaterThan(-1);
    expect(respondentDeleteStart).toBeGreaterThan(-1);
    expect(candidateDeleteStart).toBeGreaterThan(-1);
    expect(responseDeleteStart).toBeLessThan(respondentDeleteStart);
    expect(responseDeleteStart).toBeLessThan(candidateDeleteStart);
    expect(requestChangeBlock).toContain(".in('respondent_id', respondentIds)");
  });
});

describe('supabase promise repository received replies', () => {
  it('saves the receiver one-line message with the respondent row', () => {
    const source = readRepositorySource();
    const responseStart = source.indexOf('async respondToReceivedCard(input)');
    const responseEnd = source.indexOf('const { error: responseError }', responseStart);
    const responseBlock = source.slice(responseStart, responseEnd);
    const cleanStart = source.indexOf('function cleanRespondToReceivedCardInput');
    const cleanEnd = source.indexOf('function mapCard', cleanStart);
    const cleanBlock = source.slice(cleanStart, cleanEnd);

    expect(cleanStart).toBeGreaterThan(-1);
    expect(responseStart).toBeGreaterThan(-1);
    expect(cleanBlock).toContain('respondentComment');
    expect(responseBlock).toContain('comment: cleanInput.respondentComment');
    expect(responseBlock).toContain('const respondentValues');
    expect(responseBlock).toContain('.update(respondentValues)');
    expect(responseBlock).toContain('.insert({');
    expect(responseBlock).toContain('comment: cleanInput.respondentComment ??');
  });
});
