import { describe, expect, it, vi } from 'vitest';

import { cleanProfileUpdateInput, normalizeProfileHandle } from './supabaseProfile';

vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

describe('Supabase profile helpers', () => {
  it('normalizes profile handles for the database constraint', () => {
    expect(normalizeProfileHandle('  @Min Seo.01!  ')).toBe('minseo.01');
    expect(normalizeProfileHandle('가나다ABC_123')).toBe('abc_123');
  });

  it('cleans valid profile update input', () => {
    expect(cleanProfileUpdateInput({ displayName: '  민서  ', handle: '  @Min_Seo  ' })).toEqual({
      displayName: '민서',
      handle: 'min_seo',
    });
  });

  it('rejects empty display names and short handles', () => {
    expect(() => cleanProfileUpdateInput({ displayName: '   ', handle: 'minseo' })).toThrow('이름을 입력해 주세요.');
    expect(() => cleanProfileUpdateInput({ displayName: '민서', handle: 'ab' })).toThrow('아이디는 3자 이상 입력해 주세요.');
  });
});
