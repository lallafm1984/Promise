import { describe, expect, it, vi } from 'vitest';

import {
  cleanProfileUpdateInput,
  getGeneratedProfileHandle,
  getLegacyGeneratedProfileHandle,
  isLegacyGeneratedProfileHandle,
  normalizeProfileHandle,
} from './supabaseProfile';

vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

describe('Supabase profile helpers', () => {
  it('normalizes profile handles for the database constraint', () => {
    expect(normalizeProfileHandle('  @Min Seo.01!  ')).toBe('minseo');
    expect(normalizeProfileHandle('가나다ABC_123')).toBe('abc_12');
  });

  it('cleans valid profile name update input without changing the generated handle', () => {
    expect(cleanProfileUpdateInput({ displayName: '  민서  ' })).toEqual({
      displayName: '민서',
    });
  });

  it('rejects empty display names', () => {
    expect(() => cleanProfileUpdateInput({ displayName: '   ' })).toThrow('이름을 입력해 주세요.');
  });

  it('generates six-character profile handles from the user id', () => {
    expect(getGeneratedProfileHandle('a1b2c3d4-1111-2222-3333-444455556666')).toBe('a1b2c3');
    expect(getGeneratedProfileHandle('a1b2c3d4-1111-2222-3333-444455556666', 1)).toBe('d41111');
  });

  it('detects old automatically generated profile handles without touching custom handles', () => {
    expect(isLegacyGeneratedProfileHandle('minseo_a1b2c3d4')).toBe(true);
    expect(isLegacyGeneratedProfileHandle('minseo')).toBe(false);
    expect(isLegacyGeneratedProfileHandle('custom_handle')).toBe(false);
  });

  it('reconstructs the old generated handle format before compacting it', () => {
    expect(
      getLegacyGeneratedProfileHandle({
        id: 'a1b2c3d4-1111-2222-3333-444455556666',
        email: 'Min.Seo@example.com',
        user_metadata: {},
      }),
    ).toBe('min.seo_a1b2c3d4');
  });
});
