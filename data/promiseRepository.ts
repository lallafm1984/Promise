import { mockPromiseRepository } from '@/data/mockPromiseRepository';
import { isSupabasePromiseRepositoryAvailable, supabasePromiseRepository } from '@/data/supabasePromiseRepository';
import type { PromiseRepository } from '@/types/promise';

export async function getActivePromiseRepository(): Promise<{ persisted: boolean; repository: PromiseRepository }> {
  if (await isSupabasePromiseRepositoryAvailable()) {
    return {
      persisted: true,
      repository: supabasePromiseRepository,
    };
  }

  return {
    persisted: false,
    repository: mockPromiseRepository,
  };
}

export async function getActivePromiseRepositoryStatus() {
  return {
    persisted: await isSupabasePromiseRepositoryAvailable(),
  };
}
