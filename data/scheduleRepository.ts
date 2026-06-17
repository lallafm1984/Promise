import { mockScheduleRepository } from '@/data/mockScheduleRepository';
import { isSupabaseScheduleRepositoryAvailable, supabaseScheduleRepository } from '@/data/supabaseScheduleRepository';
import type { SchedulePlannerRepository } from '@/types/promise';

export async function getActiveScheduleRepository(): Promise<{
  persisted: boolean;
  repository: SchedulePlannerRepository;
}> {
  if (await isSupabaseScheduleRepositoryAvailable()) {
    return {
      persisted: true,
      repository: supabaseScheduleRepository,
    };
  }

  return {
    persisted: false,
    repository: mockScheduleRepository,
  };
}
